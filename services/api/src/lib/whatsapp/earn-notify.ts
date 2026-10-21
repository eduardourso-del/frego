import { prisma } from '@frego/db';
import { sendWhatsAppTemplate } from './client.js';
import {
  buildEarnWhatsAppLines,
  type EarnNotifyInput,
} from './earn-message.js';
import { queueEarnPush, queuePesquisaPush } from '../push/earn-notify.js';
import {
  maintainStoredConnection,
  recordWhatsAppSendFailure,
} from './token-maintain.js';

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

  const ready = await maintainStoredConnection(conn.id, { log: input.log });
  if (ready.grantLost) {
    return { sent: false, skipped: 'grant_lost' };
  }
  if (!ready.accessToken) {
    return { sent: false, error: ready.error ?? 'decrypt_failed' };
  }
  const accessToken = ready.accessToken;

  if (conn.templateEarnStatus !== 'approved') {
    return {
      sent: false,
      skipped: `template_${conn.templateEarnStatus}`,
    };
  }

  const lines = buildEarnWhatsAppLines({
    businessName: input.businessName,
    unitKind: input.unitKind,
    quantity: input.quantity,
    amountCents: input.amountCents,
    cashbackCents: input.cashbackCents,
    wallet: input.wallet,
    stampEarn: input.stampEarn,
    summaryLine: input.summaryLine,
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
          lines.accountLine,
          input.pesquisa!.url,
        ]
      : [
          lines.businessName,
          lines.earnLine,
          lines.balanceLine,
          lines.accountLine,
        ],
  });

  if (!result.ok) {
    const failure = await recordWhatsAppSendFailure(conn.id, result, input.log);
    return {
      sent: false,
      error: result.error,
      skipped: failure === 'grant_lost' ? 'grant_lost' : undefined,
    };
  }

  await prisma.businessWhatsAppConnection.update({
    where: { id: conn.id },
    data: { lastError: null },
  });

  return { sent: true };
}

export function queueEarnWhatsAppForBusiness(
  input: EarnNotifyInput,
): Promise<void> {
  return notifyEarnWhatsAppForBusiness(input).then((result) => {
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

/** WhatsApp, the earn push, and a push for the Convite. */
export async function deliverEarnNotify(input: EarnNotifyInput): Promise<void> {
  const tasks: Promise<void>[] = [
    queueEarnWhatsAppForBusiness(input),
    queueEarnPush(input),
  ];
  if (input.pesquisa) {
    tasks.push(
      queuePesquisaPush({
        customerId: input.customerId,
        businessId: input.businessId,
        businessName: input.businessName,
        sentence: input.pesquisa.sentence,
        conviteId: input.pesquisa.conviteId,
        log: input.log,
      }),
    );
  }
  await Promise.all(tasks);
}
