import { prisma } from '@frego/db';
import { sendWhatsAppTemplate } from './client.js';
import { decryptToken } from './crypto.js';
import { campaignNotifyCopy } from '../notify/campaign-copy.js';

const WA_SEND_CONCURRENCY = 8;

async function mapPool<T>(
  items: T[],
  limit: number,
  fn: (item: T) => Promise<void>,
): Promise<void> {
  let i = 0;
  const workers = Array.from(
    { length: Math.min(limit, Math.max(items.length, 1)) },
    async () => {
      while (i < items.length) {
        const idx = i;
        i += 1;
        const item = items[idx];
        if (item !== undefined) await fn(item);
      }
    },
  );
  await Promise.all(workers);
}

export async function notifyCampaignAudienceWhatsApp(input: {
  businessId: string;
  businessName: string;
  campaignName: string;
  phones: string[];
}): Promise<{
  sent: boolean;
  sentCount: number;
  failedCount: number;
  skipped?: string;
  error?: string;
}> {
  const phones = [
    ...new Set(input.phones.map((p) => p.trim()).filter((p) => p.length >= 10)),
  ];
  if (phones.length === 0) {
    return {
      sent: false,
      sentCount: 0,
      failedCount: 0,
      skipped: 'no_phones',
    };
  }

  const conn = await prisma.businessWhatsAppConnection.findUnique({
    where: { businessId: input.businessId },
  });
  if (!conn || conn.status !== 'connected') {
    return {
      sent: false,
      sentCount: 0,
      failedCount: 0,
      skipped: 'not_connected',
    };
  }
  if (conn.templateCampaignStatus !== 'approved') {
    return {
      sent: false,
      sentCount: 0,
      failedCount: 0,
      skipped: `template_${conn.templateCampaignStatus}`,
    };
  }

  let accessToken: string;
  try {
    accessToken = decryptToken(conn.tokenCiphertext, conn.tokenKeyVersion);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'decrypt_failed';
    await prisma.businessWhatsAppConnection.update({
      where: { id: conn.id },
      data: { status: 'error', lastError: message },
    });
    return {
      sent: false,
      sentCount: 0,
      failedCount: 0,
      error: message,
    };
  }

  const copy = campaignNotifyCopy(input.businessName, input.campaignName);
  let sentCount = 0;
  let failedCount = 0;
  let lastError: string | undefined;

  await mapPool(phones, WA_SEND_CONCURRENCY, async (toE164) => {
    const result = await sendWhatsAppTemplate({
      accessToken,
      phoneNumberId: conn.phoneNumberId,
      toE164,
      templateName: conn.templateCampaignName,
      languageCode: conn.templateCampaignLang,
      bodyParams: [copy.title, copy.campaignName],
    });
    if (result.ok) {
      sentCount += 1;
    } else {
      failedCount += 1;
      lastError = result.error;
    }
  });

  await prisma.businessWhatsAppConnection.update({
    where: { id: conn.id },
    data: { lastError: sentCount > 0 ? null : (lastError ?? conn.lastError) },
  });

  return {
    sent: sentCount > 0,
    sentCount,
    failedCount,
    skipped: sentCount === 0 ? 'all_failed' : undefined,
    error: sentCount === 0 ? lastError : undefined,
  };
}
