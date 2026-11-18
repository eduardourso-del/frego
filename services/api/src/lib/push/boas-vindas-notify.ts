import { prisma } from '@frego/db';
import type { MulticastMessage } from 'firebase-admin/messaging';
import { fcmAlertMessage, sendAndPruneFcm } from './send.js';

export const BOAS_VINDAS_BODY = 'Agora você faz parte desse estabelecimento.';

export type NoticeLog = (msg: string, extra?: Record<string, unknown>) => void;

export function boasVindasPushCopy(businessName: string) {
  const title = (businessName.trim() || 'Frego').slice(0, 60);
  return { title, body: BOAS_VINDAS_BODY };
}

export function buildBoasVindasPushMessage(input: {
  tokens: string[];
  businessName: string;
  businessId: string;
  logoUrl?: string | null;
}): MulticastMessage {
  const copy = boasVindasPushCopy(input.businessName);
  return fcmAlertMessage({
    tokens: input.tokens,
    title: copy.title,
    body: copy.body,
    data: {
      type: 'boas_vindas',
      businessId: input.businessId,
    },
    logoUrl: input.logoUrl,
  });
}

export async function notifyBoasVindasPush(input: {
  customerId: string;
  businessId: string;
}): Promise<{ sent: boolean; sentCount: number; skipped?: string; error?: string }> {
  try {
    const [customer, business] = await Promise.all([
      prisma.customer.findUnique({
        where: { id: input.customerId },
        select: {
          deletedAt: true,
          notificationsEnabled: true,
          boasVindasEnabled: true,
          deviceTokens: { select: { token: true } },
        },
      }),
      prisma.business.findUnique({
        where: { id: input.businessId },
        select: { name: true, logoUrl: true },
      }),
    ]);
    if (!customer || customer.deletedAt) {
      return { sent: false, sentCount: 0, skipped: 'customer_not_found' };
    }
    if (!business) {
      return { sent: false, sentCount: 0, skipped: 'business_not_found' };
    }
    if (!customer.notificationsEnabled) {
      return { sent: false, sentCount: 0, skipped: 'notifications_disabled' };
    }
    if (!customer.boasVindasEnabled) {
      return { sent: false, sentCount: 0, skipped: 'boas_vindas_disabled' };
    }
    const tokens = [...new Set(customer.deviceTokens.map((row) => row.token))];
    if (tokens.length === 0) {
      return { sent: false, sentCount: 0, skipped: 'no_device_tokens' };
    }

    const result = await sendAndPruneFcm(
      (batch) =>
        buildBoasVindasPushMessage({
          tokens: batch,
          businessName: business.name,
          businessId: input.businessId,
          logoUrl: business.logoUrl,
        }),
      tokens,
    );
    return {
      sent: result.sentCount > 0,
      sentCount: result.sentCount,
      skipped: result.sentCount === 0 ? 'all_failed' : undefined,
      error: result.errors[0],
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : 'push_failed';
    return { sent: false, sentCount: 0, error: message };
  }
}

/** Fire-and-forget. A missing app, or a switch off, skips the push. WhatsApp is untouched. */
export function queueBoasVindasPush(input: {
  customerId: string;
  businessId: string;
  log?: NoticeLog;
}): void {
  void notifyBoasVindasPush(input).then((result) => {
    if (result.sent) {
      input.log?.('boas_vindas_push_sent', {
        customerId: input.customerId,
        businessId: input.businessId,
        sent: result.sentCount,
      });
      return;
    }
    input.log?.('boas_vindas_push_skipped', {
      customerId: input.customerId,
      businessId: input.businessId,
      reason: result.skipped,
      error: result.error,
    });
  });
}
