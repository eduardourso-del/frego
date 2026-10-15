import { prisma } from '@frego/db';
import { sendWhatsAppTemplate } from './client.js';
import { whatsappSendingAllowed } from '../billing.js';
import {
  maintainStoredConnection,
  recordWhatsAppSendFailure,
} from './token-maintain.js';

export type WelcomeNotifyInput = {
  businessId: string;
  businessName: string;
  toE164: string;
  customerName?: string | null;
  log?: (msg: string, extra?: Record<string, unknown>) => void;
};

function firstName(displayName: string | null | undefined): string {
  const trimmed = (displayName ?? '').trim();
  if (!trimmed) return 'cliente';
  const part = trimmed.split(/\s+/)[0] ?? 'cliente';
  return part.slice(0, 40);
}

/**
 * Welcome WhatsApp when a store registers a customer phone.
 * No-op if not connected / template not approved. Never throws.
 */
export async function notifyWelcomeWhatsAppForBusiness(
  input: WelcomeNotifyInput,
): Promise<{ sent: boolean; skipped?: string; error?: string }> {
  if (!(await whatsappSendingAllowed(input.businessId))) {
    return { sent: false, skipped: 'plan' };
  }
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

  if (conn.templateWelcomeStatus !== 'approved') {
    return {
      sent: false,
      skipped: `template_${conn.templateWelcomeStatus}`,
    };
  }

  const result = await sendWhatsAppTemplate({
    accessToken,
    phoneNumberId: conn.phoneNumberId,
    toE164: input.toE164,
    templateName: conn.templateWelcomeName,
    languageCode: conn.templateWelcomeLang,
    bodyParams: [
      firstName(input.customerName),
      (input.businessName || 'Frego').slice(0, 60),
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

export function queueWelcomeWhatsAppForBusiness(
  input: WelcomeNotifyInput,
): void {
  void notifyWelcomeWhatsAppForBusiness(input).then((result) => {
    if (result.sent) {
      input.log?.('whatsapp_welcome_sent', { businessId: input.businessId });
      return;
    }
    if (result.skipped) {
      input.log?.('whatsapp_welcome_skipped', {
        businessId: input.businessId,
        reason: result.skipped,
      });
      return;
    }
    input.log?.('whatsapp_welcome_failed', {
      businessId: input.businessId,
      error: result.error,
    });
  });
}
