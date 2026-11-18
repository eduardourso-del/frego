import { prisma } from '@frego/db';
import type { MulticastMessage } from 'firebase-admin/messaging';
import { cityKey } from '../city.js';
import {
  EXPLORATION_STATUSES,
  locationInExploration,
  type ExplorationLocation,
} from '../exploration.js';
import type { NoticeLog } from './boas-vindas-notify.js';
import { fcmAlertMessage, sendAndPruneFcm } from './send.js';

export const ENTRADA_BODY = 'Acabou de chegar na sua cidade.';

export function businessIsListed(input: {
  status: string;
  explorationVisible: boolean;
}): boolean {
  return (
    input.explorationVisible &&
    (EXPLORATION_STATUSES as readonly string[]).includes(input.status)
  );
}

/** First transition into Exploração. A previous Entrada, including one from before this notice existed, stays quiet. */
export function shouldQueueEntrada(input: {
  previousStatus: string;
  previousVisible: boolean;
  nextStatus: string;
  nextVisible: boolean;
  alreadySent: boolean;
}): boolean {
  if (input.alreadySent) return false;
  const wasListed = businessIsListed({
    status: input.previousStatus,
    explorationVisible: input.previousVisible,
  });
  const listed = businessIsListed({
    status: input.nextStatus,
    explorationVisible: input.nextVisible,
  });
  return !wasListed && listed;
}

export function cidadeSeesBusiness(
  cidade: { city: string; state: string },
  locations: ExplorationLocation[],
): boolean {
  return locations.some((location) => locationInExploration(location, cidade));
}

export function entradaPushCopy(businessName: string) {
  const title = (businessName.trim() || 'Frego').slice(0, 60);
  return { title, body: ENTRADA_BODY };
}

export function buildEntradaPushMessage(input: {
  tokens: string[];
  businessName: string;
  businessId: string;
  city: string;
  state: string;
  logoUrl?: string | null;
}): MulticastMessage {
  const copy = entradaPushCopy(input.businessName);
  return fcmAlertMessage({
    tokens: input.tokens,
    title: copy.title,
    body: copy.body,
    data: {
      type: 'entrada',
      businessId: input.businessId,
      city: input.city,
      state: input.state,
    },
    logoUrl: input.logoUrl,
  });
}

export async function notifyEntrada(input: {
  businessId: string;
}): Promise<{
  sent: boolean;
  sentCount: number;
  failedCount: number;
  skipped?: string;
  error?: string;
}> {
  const empty = { sent: false, sentCount: 0, failedCount: 0 };
  try {
    const claimed = await prisma.business.updateMany({
      where: {
        id: input.businessId,
        entradaSentAt: null,
        explorationVisible: true,
        status: { in: [...EXPLORATION_STATUSES] },
      },
      data: { entradaSentAt: new Date() },
    });
    if (claimed.count !== 1) {
      return { ...empty, skipped: 'already_sent_or_not_listed' };
    }

    const business = await prisma.business.findUnique({
      where: { id: input.businessId },
      select: {
        name: true,
        logoUrl: true,
        locations: {
          select: {
            id: true,
            city: true,
            state: true,
            latitude: true,
            longitude: true,
          },
        },
      },
    });
    if (!business) {
      return { ...empty, skipped: 'business_not_found' };
    }

    const customers = await prisma.customer.findMany({
      where: {
        deletedAt: null,
        notificationsEnabled: true,
        entradaEnabled: true,
        city: { not: null },
        state: { not: null },
        deviceTokens: { some: {} },
        memberships: { none: { businessId: input.businessId } },
      },
      select: {
        city: true,
        state: true,
        deviceTokens: { select: { token: true } },
      },
    });

    const groups = new Map<string, { city: string; state: string; tokens: string[] }>();
    for (const customer of customers) {
      if (!customer.city || !customer.state) continue;
      const key = cityKey(customer.city, customer.state);
      if (!key) continue;
      if (
        !cidadeSeesBusiness(
          { city: customer.city, state: customer.state },
          business.locations,
        )
      ) {
        continue;
      }
      const group = groups.get(key) ?? {
        city: customer.city.trim(),
        state: customer.state.trim().toUpperCase(),
        tokens: [],
      };
      for (const row of customer.deviceTokens) group.tokens.push(row.token);
      groups.set(key, group);
    }

    let sentCount = 0;
    let failedCount = 0;
    const errors: string[] = [];
    for (const group of groups.values()) {
      const tokens = [...new Set(group.tokens)];
      if (tokens.length === 0) continue;
      const result = await sendAndPruneFcm(
        (batch) =>
          buildEntradaPushMessage({
            tokens: batch,
            businessName: business.name,
            businessId: input.businessId,
            city: group.city,
            state: group.state,
            logoUrl: business.logoUrl,
          }),
        tokens,
      );
      sentCount += result.sentCount;
      failedCount += result.failedCount;
      for (const error of result.errors) {
        if (!errors.includes(error)) errors.push(error);
      }
    }

    return {
      sent: sentCount > 0,
      sentCount,
      failedCount,
      skipped: sentCount === 0 ? 'no_recipients' : undefined,
      error: errors[0],
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : 'push_failed';
    return { ...empty, error: message };
  }
}

/** Fire-and-forget. The claim inside the send keeps a second listing quiet. */
export function queueEntrada(input: {
  businessId: string;
  log?: NoticeLog;
}): void {
  void notifyEntrada(input).then((result) => {
    if (result.sent) {
      input.log?.('entrada_push_sent', {
        businessId: input.businessId,
        sent: result.sentCount,
        failed: result.failedCount,
      });
      return;
    }
    input.log?.('entrada_push_skipped', {
      businessId: input.businessId,
      reason: result.skipped,
      error: result.error,
    });
  });
}
