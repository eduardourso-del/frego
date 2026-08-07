import { graphBase } from './meta-oauth.js';

export type TemplateSendInput = {
  accessToken: string;
  phoneNumberId: string;
  toE164: string;
  templateName: string;
  languageCode: string;
  bodyParams: string[];
};

function digitsOnlyPhone(e164: string): string {
  return e164.replace(/\D/g, '');
}

export async function sendWhatsAppTemplate(
  input: TemplateSendInput,
): Promise<{ ok: boolean; error?: string; messageId?: string }> {
  const to = digitsOnlyPhone(input.toE164);
  if (to.length < 10) {
    return { ok: false, error: 'invalid_phone' };
  }

  const payload = {
    messaging_product: 'whatsapp',
    to,
    type: 'template',
    template: {
      name: input.templateName,
      language: { code: input.languageCode },
      components: [
        {
          type: 'body',
          parameters: input.bodyParams.map((text) => ({
            type: 'text',
            text: text.slice(0, 1024),
          })),
        },
      ],
    },
  };

  try {
    const res = await fetch(
      `${graphBase()}/${input.phoneNumberId}/messages`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${input.accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      },
    );
    const body = (await res.json().catch(() => ({}))) as {
      messages?: Array<{ id?: string }>;
      error?: { message?: string; code?: number };
    };
    if (!res.ok) {
      return {
        ok: false,
        error:
          body.error?.message ??
          `meta_${res.status}:${JSON.stringify(body).slice(0, 300)}`,
      };
    }
    return { ok: true, messageId: body.messages?.[0]?.id };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : 'network_error',
    };
  }
}
