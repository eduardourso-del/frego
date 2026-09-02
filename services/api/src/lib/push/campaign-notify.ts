import { prisma, type CampaignStatus } from '@frego/db';
import type { MulticastMessage } from 'firebase-admin/messaging';
import {
  filterMembershipsByRules,
  parseAudienceRules,
} from '../audience.js';
import { campaignNotifyCopy } from '../notify/campaign-copy.js';
import { notifyCampaignAudienceWhatsApp } from '../whatsapp/campaign-notify.js';
import { apnsWithData, sendAndPruneFcm } from './send.js';

export { chunkTokens, isStaleFcmTokenError } from './send.js';
export { campaignPushCopy } from '../notify/campaign-copy.js';

export type CampaignPushLog = (
  msg: string,
  extra?: Record<string, unknown>,
) => void;

export function shouldQueueCampaignAudiencePush(input: {
  previousStatus: CampaignStatus | string | null;
  nextStatus: CampaignStatus | string;
  audienceSegmentId: string | null | undefined;
  alreadySent?: boolean;
}): boolean {
  if (input.nextStatus !== 'active') return false;
  if (!input.audienceSegmentId) return false;
  if (input.previousStatus === 'active') return false;
  if (input.alreadySent) return false;
  return true;
}

export function buildCampaignPushMessage(input: {
  tokens: string[];
  businessName: string;
  campaignName: string;
  businessId: string;
  campaignId: string;
}): MulticastMessage {
  const copy = campaignNotifyCopy(input.businessName, input.campaignName);
  return {
    tokens: input.tokens,
    notification: {
      title: copy.title,
      body: copy.body,
    },
    data: {
      type: 'campaign_new',
      businessId: input.businessId,
      campaignId: input.campaignId,
    },
    android: {
      priority: 'high',
      notification: {
        channelId: 'frego_campaigns',
      },
    },
    apns: apnsWithData({
      type: 'campaign_new',
      businessId: input.businessId,
      campaignId: input.campaignId,
    }),
  };
}

export type CampaignAudiencePushInput = {
  campaignId: string;
  businessId: string;
  log?: CampaignPushLog;
};

/**
 * Fire-and-forget. Never throws to the campaign write path.
 * Sends the same campaign copy on push and WhatsApp.
 */
export function queueCampaignAudiencePush(
  input: CampaignAudiencePushInput,
): void {
  void notifyCampaignAudiencePush(input).then((result) => {
    if (result.push.sent) {
      input.log?.('campaign_push_sent', {
        campaignId: input.campaignId,
        businessId: input.businessId,
        sent: result.push.sentCount,
        failed: result.push.failedCount,
        skipped: result.push.skipped,
      });
    } else {
      input.log?.('campaign_push_skipped', {
        campaignId: input.campaignId,
        businessId: input.businessId,
        reason: result.push.skipped,
        error: result.push.error,
      });
    }

    if (result.whatsapp.sent) {
      input.log?.('campaign_whatsapp_sent', {
        campaignId: input.campaignId,
        businessId: input.businessId,
        sent: result.whatsapp.sentCount,
        failed: result.whatsapp.failedCount,
      });
    } else {
      input.log?.('campaign_whatsapp_skipped', {
        campaignId: input.campaignId,
        businessId: input.businessId,
        reason: result.whatsapp.skipped,
        error: result.whatsapp.error,
      });
    }
  });
}

export async function notifyCampaignAudiencePush(
  input: CampaignAudiencePushInput,
): Promise<{
  push: {
    sent: boolean;
    sentCount: number;
    failedCount: number;
    skipped?: string;
    error?: string;
  };
  whatsapp: {
    sent: boolean;
    sentCount: number;
    failedCount: number;
    skipped?: string;
    error?: string;
  };
}> {
  const empty = {
    sent: false,
    sentCount: 0,
    failedCount: 0,
  };
  try {
    const claimed = await prisma.campaign.updateMany({
      where: {
        id: input.campaignId,
        businessId: input.businessId,
        status: 'active',
        audiencePushSentAt: null,
        audienceSegmentId: { not: null },
      },
      data: { audiencePushSentAt: new Date() },
    });
    if (claimed.count !== 1) {
      const skipped = 'already_sent_or_ineligible';
      return {
        push: { ...empty, skipped },
        whatsapp: { ...empty, skipped },
      };
    }

    const campaign = await prisma.campaign.findFirst({
      where: { id: input.campaignId, businessId: input.businessId },
      select: {
        id: true,
        name: true,
        audienceSegment: { select: { rules: true } },
        business: { select: { name: true } },
      },
    });

    if (!campaign?.audienceSegment) {
      const skipped = 'no_audience';
      return {
        push: { ...empty, skipped },
        whatsapp: { ...empty, skipped },
      };
    }

    const matched = await filterMembershipsByRules(
      input.businessId,
      parseAudienceRules(campaign.audienceSegment.rules),
    );
    const customerIds = [...new Set(matched.map((m) => m.customerId))];
    if (customerIds.length === 0) {
      const skipped = 'empty_audience';
      return {
        push: { ...empty, skipped },
        whatsapp: { ...empty, skipped },
      };
    }

    const rows = await prisma.deviceToken.findMany({
      where: {
        customerId: { in: customerIds },
        customer: { notificationsEnabled: true },
      },
      select: { token: true },
    });
    const tokens = [...new Set(rows.map((r) => r.token))];

    let push: {
      sent: boolean;
      sentCount: number;
      failedCount: number;
      skipped?: string;
      error?: string;
    };
    if (tokens.length === 0) {
      push = { ...empty, skipped: 'no_device_tokens' };
    } else {
      const result = await sendAndPruneFcm(
        (batch) =>
          buildCampaignPushMessage({
            tokens: batch,
            businessName: campaign.business.name,
            campaignName: campaign.name,
            businessId: input.businessId,
            campaignId: input.campaignId,
          }),
        tokens,
      );
      push = {
        sent: result.sentCount > 0,
        sentCount: result.sentCount,
        failedCount: result.failedCount,
        skipped: result.sentCount === 0 ? 'all_failed' : undefined,
        error: result.errors[0],
      };
    }

    const whatsapp = await notifyCampaignAudienceWhatsApp({
      businessId: input.businessId,
      businessName: campaign.business.name,
      campaignName: campaign.name,
      phones: matched.map((m) => m.phoneE164),
    });

    return { push, whatsapp };
  } catch (err) {
    const message = err instanceof Error ? err.message : 'notify_failed';
    input.log?.('campaign_notify_failed', {
      campaignId: input.campaignId,
      businessId: input.businessId,
      error: message,
    });
    return {
      push: { ...empty, error: message },
      whatsapp: { ...empty, error: message },
    };
  }
}
