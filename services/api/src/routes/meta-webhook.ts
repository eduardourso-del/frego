import type { FastifyPluginAsync } from 'fastify';
import { createHash } from 'node:crypto';
import { prisma } from '@frego/db';
import {
  EARN_TEMPLATE_LANG,
  EARN_TEMPLATE_NAME,
  WELCOME_TEMPLATE_LANG,
  WELCOME_TEMPLATE_NAME,
  mapWebhookTemplateEvent,
} from '../lib/whatsapp/templates.js';

function eventKeyFromPayload(payload: unknown): string {
  const raw = JSON.stringify(payload);
  return createHash('sha256').update(raw).digest('hex');
}

export const metaWebhookRoutes: FastifyPluginAsync = async (app) => {
  /** Meta hub challenge. */
  app.get('/webhooks/meta', async (request, reply) => {
    const q = request.query as Record<string, string | undefined>;
    const mode = q['hub.mode'];
    const token = q['hub.verify_token'];
    const challenge = q['hub.challenge'];
    const expected = process.env.WHATSAPP_WEBHOOK_VERIFY_TOKEN?.trim();

    if (mode === 'subscribe' && expected && token === expected && challenge) {
      return reply.type('text/plain').send(challenge);
    }
    return reply.code(403).send('Forbidden');
  });

  /**
   * Ingest status / template / coexistence (history, smb_*) updates.
   * Always 200 quickly; idempotent by event hash.
   */
  app.post('/webhooks/meta', async (request, reply) => {
    const payload = request.body as {
      object?: string;
      entry?: Array<{
        id?: string;
        changes?: Array<{
          field?: string;
          value?: {
            metadata?: { phone_number_id?: string };
            statuses?: Array<{
              id?: string;
              status?: string;
              errors?: unknown;
            }>;
            messages?: unknown[];
            event?: string;
            message_template_id?: string | number;
            message_template_name?: string;
            message_template_language?: string;
          };
        }>;
      }>;
    };

    try {
      if (payload.object === 'whatsapp_business_account' && payload.entry) {
        for (const entry of payload.entry) {
          for (const change of entry.changes ?? []) {
            const phoneNumberId =
              change.value?.metadata?.phone_number_id ?? null;
            let businessId: string | null = null;

            if (change.field === 'message_template_status_update') {
              const wabaId = entry.id;
              const templateName = change.value?.message_template_name;
              const templateLang = change.value?.message_template_language;
              const mapped = mapWebhookTemplateEvent(change.value?.event);
              const langOk =
                !templateLang ||
                templateLang === EARN_TEMPLATE_LANG ||
                templateLang === WELCOME_TEMPLATE_LANG ||
                templateLang === 'pt-BR';
              if (wabaId && mapped && langOk) {
                const conn = await prisma.businessWhatsAppConnection.findFirst({
                  where: { wabaId, status: 'connected' },
                });
                if (conn) {
                  businessId = conn.businessId;
                  if (templateName === WELCOME_TEMPLATE_NAME) {
                    await prisma.businessWhatsAppConnection.update({
                      where: { id: conn.id },
                      data: {
                        templateWelcomeStatus: mapped,
                        templateWelcomeId: change.value?.message_template_id
                          ? String(change.value.message_template_id)
                          : conn.templateWelcomeId,
                        templateWelcomeSyncedAt: new Date(),
                        ...(mapped === 'approved' ? { lastError: null } : {}),
                      },
                    });
                  } else if (
                    !templateName ||
                    templateName === EARN_TEMPLATE_NAME
                  ) {
                    await prisma.businessWhatsAppConnection.update({
                      where: { id: conn.id },
                      data: {
                        templateEarnStatus: mapped,
                        templateEarnId: change.value?.message_template_id
                          ? String(change.value.message_template_id)
                          : conn.templateEarnId,
                        templateEarnSyncedAt: new Date(),
                        ...(mapped === 'approved' ? { lastError: null } : {}),
                      },
                    });
                  }
                }
              }
            }

            if (phoneNumberId) {
              const conn =
                await prisma.businessWhatsAppConnection.findUnique({
                  where: { phoneNumberId },
                  select: { businessId: true, id: true },
                });
              businessId = conn?.businessId ?? businessId;

              for (const st of change.value?.statuses ?? []) {
                if (st.status === 'failed' && conn) {
                  const errMsg = JSON.stringify(st.errors ?? st).slice(0, 500);
                  await prisma.businessWhatsAppConnection.update({
                    where: { id: conn.id },
                    data: { lastError: errMsg },
                  });
                }
              }
            }

            const eventType = change.field ?? 'unknown';
            const key = eventKeyFromPayload({
              entryId: entry.id,
              field: change.field,
              value: change.value,
            });

            await prisma.whatsAppWebhookEvent
              .create({
                data: {
                  businessId,
                  eventKey: key,
                  phoneNumberId,
                  eventType,
                  payload: change as object,
                },
              })
              .catch((err: { code?: string }) => {
                if (err?.code !== 'P2002') throw err;
              });
          }
        }
      }
    } catch (err) {
      request.log.error({ err }, 'whatsapp_webhook_ingest_error');
    }

    return reply.code(200).send('EVENT_RECEIVED');
  });
};
