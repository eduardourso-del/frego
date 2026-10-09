import { prisma } from '@frego/db';
import { sendWhatsAppTemplate } from './client.js';
import { decryptToken } from './crypto.js';
import {
  buildEarnWhatsAppLines,
  type EarnNotifyInput,
} from './earn-message.js';
import { queueEarnPush, queuePesquisaPush } from '../push/earn-notify.js';

export type { EarnNotifyInput };

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
    stampEarn: input.stampEarn,
  });

  const pesquisaTemplate =
    input.pesquisa && conn.templatePesquisaStatus === 'approved';
  const result = await sendWhatsAppTemplate({
    accessToken,
    phoneNumberId: conn.phoneNumberId,
    toE164: input.toE164,
    templateName: pesquisaTemplate
      ? conn.templatePesquisaName
      : conn.templateEarnName,
    languageCode: pesquisaTemplate
      ? conn.templatePesquisaLang
      : conn.templateEarnLang,
    bodyParams: pesquisaTemplate
      ? [
          lines.businessName,
          lines.earnLine,
          lines.balanceLine,
          lines.hintLine || '—',
          input.pesquisa!.sentence,
          input.pesquisa!.url,
        ]
      : [
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

/** WhatsApp, the earn push, and a push for the Convite. Fire-and-forget. */
export function queueEarnNotify(input: EarnNotifyInput): void {
  queueEarnWhatsAppForBusiness(input);
  queueEarnPush(input);
  if (input.pesquisa) {
    queuePesquisaPush({
      customerId: input.customerId,
      businessId: input.businessId,
      businessName: input.businessName,
      sentence: input.pesquisa.sentence,
      conviteId: input.pesquisa.conviteId,
      log: input.log,
    });
  }
}
