import type { FastifyPluginAsync } from 'fastify';
import { createHash } from 'node:crypto';
import { prisma } from '@frego/db';

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
   * Ingest status / template updates. Always 200 quickly; idempotent by event hash.
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
          };
        }>;
      }>;
    };

    // ACK immediately semantics: process then 200 (sync is fine for v1 volume)
    try {
      if (payload.object === 'whatsapp_business_account' && payload.entry) {
        for (const entry of payload.entry) {
          for (const change of entry.changes ?? []) {
            const phoneNumberId =
              change.value?.metadata?.phone_number_id ?? null;
            let businessId: string | null = null;
            if (phoneNumberId) {
              const conn =
                await prisma.businessWhatsAppConnection.findUnique({
                  where: { phoneNumberId },
                  select: { businessId: true, id: true },
                });
              businessId = conn?.businessId ?? null;

              // Persist last delivery failure on connection
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
                // Unique violation = duplicate webhook — ignore
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
