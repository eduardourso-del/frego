import { prisma } from '@frego/db';
import type { WalletSnapshot } from '../wallet.js';
import { sendWhatsAppTemplate } from './client.js';
import { decryptToken } from './crypto.js';
import { buildEarnWhatsAppLines } from './earn-message.js';

export type EarnNotifyInput = {
  businessId: string;
  businessName: string;
  toE164: string;
  unitKind: 'stamps' | 'points' | 'cashback';
  quantity: number;
  amountCents?: number | null;
  cashbackCents?: number | null;
  wallet: WalletSnapshot;
  log?: (msg: string, extra?: Record<string, unknown>) => void;
};

/**
 * Send earn summary via the business's connected WABA phone.
 * No-op if not connected. Never throws to earn path.
 */
export async function notifyEarnWhatsAppForBusiness(
  input: EarnNotifyInput,
): Promise<{ sent: boolean; skipped?: string; error?: string }> {
  const conn = await prisma.businessWhatsAppConnection.findUnique({
    where: { businessId: input.businessId },
  });

  if (!conn || conn.status !== 'connected') {
    return { sent: false, skipped: 'not_connected' };
  }

  if (conn.templateEarnStatus !== 'approved') {
    return {
      sent: false,
      skipped: `template_${conn.templateEarnStatus}`,
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
    return { sent: false, error: message };
  }

  const lines = buildEarnWhatsAppLines({
    businessName: input.businessName,
    unitKind: input.unitKind,
    quantity: input.quantity,
    amountCents: input.amountCents,
    cashbackCents: input.cashbackCents,
    wallet: input.wallet,
  });

  const result = await sendWhatsAppTemplate({
    accessToken,
    phoneNumberId: conn.phoneNumberId,
    toE164: input.toE164,
    templateName: conn.templateEarnName,
    languageCode: conn.templateEarnLang,
    bodyParams: [
      lines.businessName,
      lines.earnLine,
      lines.balanceLine,
      lines.hintLine || '—',
    ],
  });

  if (!result.ok) {
    await prisma.businessWhatsAppConnection.update({
      where: { id: conn.id },
      data: { lastError: result.error ?? 'send_failed' },
    });
    return { sent: false, error: result.error };
  }

  await prisma.businessWhatsAppConnection.update({
    where: { id: conn.id },
    data: { lastError: null },
  });

  return { sent: true };
}

export function queueEarnWhatsAppForBusiness(input: EarnNotifyInput): void {
  void notifyEarnWhatsAppForBusiness(input).then((result) => {
    if (result.sent) {
      input.log?.('whatsapp_earn_sent', { businessId: input.businessId });
      return;
    }
    if (result.skipped) {
      input.log?.('whatsapp_earn_skipped', {
        businessId: input.businessId,
        reason: result.skipped,
      });
      return;
    }
    input.log?.('whatsapp_earn_failed', {
      businessId: input.businessId,
      error: result.error,
    });
  });
}
