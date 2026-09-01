import { prisma } from '@frego/db';
import { sendWhatsAppTemplate } from './client.js';
import { decryptToken } from './crypto.js';

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
  const conn = await prisma.businessWhatsAppConnection.findUnique({
    where: { businessId: input.businessId },
  });

  if (!conn || conn.status !== 'connected') {
    return { sent: false, skipped: 'not_connected' };
  }

  if (conn.templateWelcomeStatus !== 'approved') {
    return {
      sent: false,
      skipped: `template_${conn.templateWelcomeStatus}`,
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
