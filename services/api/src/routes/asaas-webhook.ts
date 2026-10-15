import type { FastifyPluginAsync } from 'fastify';
import { asaasWebhookAuthorized } from '../lib/asaas.js';
import { applyAsaasPayment } from '../lib/billing.js';

type AsaasWebhookBody = {
  event?: string;
  payment?: {
    id?: string;
    status?: string;
    value?: number;
    dueDate?: string;
    invoiceUrl?: string | null;
    subscription?: string | null;
    customer?: string | null;
    externalReference?: string | null;
    billingType?: string | null;
  };
};

export const asaasWebhookRoutes: FastifyPluginAsync = async (app) => {
  app.post('/webhooks/asaas', async (request, reply) => {
    const token = request.headers['asaas-access-token'];
    if (!asaasWebhookAuthorized(typeof token === 'string' ? token : undefined)) {
      return reply.code(401).send({ error: 'INVALID_WEBHOOK_TOKEN' });
    }

    const body = request.body as AsaasWebhookBody;
    const payment = body.payment;
    if (!payment?.id || payment.value == null) return { ok: true };

    await applyAsaasPayment({
      id: payment.id,
      status: payment.status ?? '',
      value: payment.value,
      dueDate: payment.dueDate ?? '',
      invoiceUrl: payment.invoiceUrl ?? null,
      subscription: payment.subscription ?? null,
      customer: payment.customer ?? null,
      externalReference: payment.externalReference ?? null,
      billingType: payment.billingType ?? null,
    });
    return { ok: true };
  });
};
