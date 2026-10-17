import type { MulticastMessage } from 'firebase-admin/messaging';
import { apnsWithData, sendAndPruneFcm } from './send.js';

export type AccountNoticePushType = 'wallet_expiry' | 'campaign_ending';

export function buildAccountNoticePush(input: {
  tokens: string[];
  title: string;
  body: string;
  type: AccountNoticePushType;
  businessId: string;
  campaignId?: string | null;
}): MulticastMessage {
  const data: Record<string, string> = {
    type: input.type,
    businessId: input.businessId,
  };
  if (input.campaignId) data.campaignId = input.campaignId;
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

export async function sendAccountNoticePush(input: {
  tokens: string[];
  notificationsEnabled: boolean;
  title: string;
  body: string;
  type: AccountNoticePushType;
  businessId: string;
  campaignId?: string | null;
}): Promise<{ sent: boolean; skipped?: string; error?: string }> {
  if (!input.notificationsEnabled) {
    return { sent: false, skipped: 'notifications_disabled' };
  }
  const tokens = [...new Set(input.tokens.filter((token) => token.length > 0))];
  if (tokens.length === 0) {
    return { sent: false, skipped: 'no_device_tokens' };
  }
  try {
    const result = await sendAndPruneFcm(
      (batch) =>
        buildAccountNoticePush({
          tokens: batch,
          title: input.title,
          body: input.body,
          type: input.type,
          businessId: input.businessId,
          campaignId: input.campaignId,
        }),
      tokens,
    );
    return {
      sent: result.sentCount > 0,
      skipped: result.sentCount === 0 ? 'all_failed' : undefined,
      error: result.errors[0],
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : 'push_failed';
    return { sent: false, error: message };
  }
}
