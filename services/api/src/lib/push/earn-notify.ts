import { prisma } from '@frego/db';
import type { MulticastMessage } from 'firebase-admin/messaging';
import {
  buildEarnWhatsAppLines,
  earnPushCopy,
  type EarnNotifyInput,
} from '../whatsapp/earn-message.js';
import { apnsWithData, sendAndPruneFcm } from './send.js';

export function buildEarnPushMessage(input: {
  tokens: string[];
  title: string;
  body: string;
  businessId: string;
  unitKind: string;
  transactionId?: string | null;
  quantity?: number;
  conviteId?: string | null;
}): MulticastMessage {
  const data: Record<string, string> = {
    type: input.conviteId ? 'pesquisa' : 'earn',
    businessId: input.businessId,
    unitKind: input.unitKind,
  };
  if (input.transactionId) data.transactionId = input.transactionId;
  if (input.quantity != null) data.quantity = String(input.quantity);
  if (input.conviteId) data.conviteId = input.conviteId;
  return {
    tokens: input.tokens,
    notification: {
      title: input.title,
      body: input.body,
    },
    data,
    android: {
      priority: 'high',
      notification: {
        channelId: 'frego_campaigns',
      },
    },
    apns: apnsWithData(data),
  };
}

export async function notifyEarnPush(
  input: EarnNotifyInput,
): Promise<{ sent: boolean; sentCount: number; skipped?: string; error?: string }> {
  try {
    const customer = await prisma.customer.findUnique({
      where: { id: input.customerId },
      select: {
        notificationsEnabled: true,
        deviceTokens: { select: { token: true } },
      },
    });
    if (!customer) {
      return { sent: false, sentCount: 0, skipped: 'customer_not_found' };
    }
    if (!customer.notificationsEnabled) {
      return { sent: false, sentCount: 0, skipped: 'notifications_disabled' };
    }
    const tokens = [...new Set(customer.deviceTokens.map((row) => row.token))];
    if (tokens.length === 0) {
      return { sent: false, sentCount: 0, skipped: 'no_device_tokens' };
    }

    const copy = earnPushCopy(
      buildEarnWhatsAppLines({
        businessName: input.businessName,
        unitKind: input.unitKind,
        quantity: input.quantity,
        amountCents: input.amountCents,
        cashbackCents: input.cashbackCents,
        wallet: input.wallet,
        stampEarn: input.stampEarn,
      }),
    );
    const result = await sendAndPruneFcm(
      (batch) =>
        buildEarnPushMessage({
          tokens: batch,
          title: copy.title,
          body: copy.body,
          businessId: input.businessId,
          unitKind: input.unitKind,
          transactionId: input.transactionId,
          quantity: input.quantity,
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

export async function notifyPesquisaPush(input: {
  customerId: string;
  businessId: string;
  businessName: string;
  sentence: string;
  conviteId: string;
}): Promise<{ sent: boolean; sentCount: number; skipped?: string; error?: string }> {
  try {
    const customer = await prisma.customer.findUnique({
      where: { id: input.customerId },
      select: {
        notificationsEnabled: true,
        deviceTokens: { select: { token: true } },
      },
    });
    if (!customer) {
      return { sent: false, sentCount: 0, skipped: 'customer_not_found' };
    }
    if (!customer.notificationsEnabled) {
      return { sent: false, sentCount: 0, skipped: 'notifications_disabled' };
    }
    const tokens = [...new Set(customer.deviceTokens.map((row) => row.token))];
    if (tokens.length === 0) {
      return { sent: false, sentCount: 0, skipped: 'no_device_tokens' };
    }

    const result = await sendAndPruneFcm(
      (batch) =>
        buildEarnPushMessage({
          tokens: batch,
          title: input.businessName.slice(0, 60) || 'Frego',
          body: input.sentence.slice(0, 180),
          businessId: input.businessId,
          unitKind: 'stamps',
          conviteId: input.conviteId,
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

export function queuePesquisaPush(input: {
  customerId: string;
  businessId: string;
  businessName: string;
  sentence: string;
  conviteId: string;
  log?: (msg: string, extra?: Record<string, unknown>) => void;
}): void {
  void notifyPesquisaPush(input).then((result) => {
    if (result.sent) {
      input.log?.('pesquisa_push_sent', {
        businessId: input.businessId,
        customerId: input.customerId,
        sent: result.sentCount,
      });
      return;
    }
    if (result.skipped) {
      input.log?.('pesquisa_push_skipped', {
        businessId: input.businessId,
        customerId: input.customerId,
        reason: result.skipped,
      });
      return;
    }
    input.log?.('pesquisa_push_failed', {
      businessId: input.businessId,
      customerId: input.customerId,
      error: result.error,
    });
  });
}

export function queueEarnPush(input: EarnNotifyInput): void {
  void notifyEarnPush(input).then((result) => {
    if (result.sent) {
      input.log?.('earn_push_sent', {
        businessId: input.businessId,
        customerId: input.customerId,
        sent: result.sentCount,
      });
      return;
    }
    if (result.skipped) {
      input.log?.('earn_push_skipped', {
        businessId: input.businessId,
        customerId: input.customerId,
        reason: result.skipped,
      });
      return;
    }
    input.log?.('earn_push_failed', {
      businessId: input.businessId,
      customerId: input.customerId,
      error: result.error,
    });
  });
}
