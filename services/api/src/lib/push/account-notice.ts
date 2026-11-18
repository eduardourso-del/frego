import type { MulticastMessage } from 'firebase-admin/messaging';
import { fcmAlertMessage, sendAndPruneFcm } from './send.js';

export type AccountNoticePushType = 'wallet_expiry' | 'campaign_ending';

export function buildAccountNoticePush(input: {
  tokens: string[];
  title: string;
  body: string;
  type: AccountNoticePushType;
  businessId: string;
  campaignId?: string | null;
  logoUrl?: string | null;
}): MulticastMessage {
  const data: Record<string, string> = {
    type: input.type,
    businessId: input.businessId,
  };
  if (input.campaignId) data.campaignId = input.campaignId;
  return fcmAlertMessage({
    tokens: input.tokens,
    title: input.title,
    body: input.body,
    data,
    logoUrl: input.logoUrl,
  });
}

export async function sendAccountNoticePush(input: {
  tokens: string[];
  notificationsEnabled: boolean;
  title: string;
  body: string;
  type: AccountNoticePushType;
  businessId: string;
  campaignId?: string | null;
  logoUrl?: string | null;
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
          logoUrl: input.logoUrl,
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
