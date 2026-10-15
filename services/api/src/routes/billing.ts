import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { prisma } from '@frego/db';
import { requireAuth } from '../plugins/auth.js';
import {
  changePlan,
  isBillingType,
  isSubscriptionTier,
  loadBilling,
  presentBilling,
  scheduleCancel,
  updatePaymentMethod,
} from '../lib/billing.js';

const changeBody = z.object({
  tier: z.enum(['starter', 'growth', 'enterprise']),
  billingType: z.enum(['CREDIT_CARD', 'PIX', 'BOLETO', 'UNDEFINED']).optional(),
});

const methodBody = z.object({
  billingType: z.enum(['CREDIT_CARD', 'PIX', 'BOLETO']),
});

export const billingRoutes: FastifyPluginAsync = async (app) => {
  app.get('/billing', async (request, reply) => {
    const auth = requireAuth(request);
    const loaded = await loadBilling(auth.businessId);
    if (!loaded) return reply.code(404).send({ error: 'NOT_FOUND' });
    return { billing: presentBilling(loaded.account, loaded.access) };
  });

  app.post('/billing/plan', async (request, reply) => {
    const auth = requireAuth(request);
    if (auth.role !== 'owner') {
      return reply.code(403).send({ error: 'OWNER_ONLY' });
    }
    const body = changeBody.parse(request.body);
    const billingType = body.billingType ?? 'UNDEFINED';
    if (!isSubscriptionTier(body.tier) || !isBillingType(billingType)) {
      return reply.code(400).send({ error: 'INVALID_PLAN' });
    }
    const member = await prisma.teamMember.findUnique({
      where: { id: auth.teamMemberId },
      select: { email: true },
    });
    const result = await changePlan({
      businessId: auth.businessId,
      tier: body.tier,
      billingType,
      ownerEmail: member?.email ?? null,
    });
    if (!result.ok) {
      return reply.code(result.status).send({
        error: result.error,
        message: result.message,
      });
    }
    const loaded = await loadBilling(auth.businessId);
    return {
      result,
      billing: loaded ? presentBilling(loaded.account, loaded.access) : null,
    };
  });

  app.post('/billing/cancel', async (request, reply) => {
    const auth = requireAuth(request);
    if (auth.role !== 'owner') {
      return reply.code(403).send({ error: 'OWNER_ONLY' });
    }
    const result = await scheduleCancel(auth.businessId);
    if (!result.ok) return reply.code(409).send({ error: result.error });
    const loaded = await loadBilling(auth.businessId);
    return {
      appliesAt: result.appliesAt,
      billing: loaded ? presentBilling(loaded.account, loaded.access) : null,
    };
  });

  app.post('/billing/payment-method', async (request, reply) => {
    const auth = requireAuth(request);
    if (auth.role !== 'owner') {
      return reply.code(403).send({ error: 'OWNER_ONLY' });
    }
    const body = methodBody.parse(request.body);
    const result = await updatePaymentMethod(auth.businessId, body.billingType);
    if (!result.ok) return reply.code(result.status).send({ error: result.error });
    return result;
  });
};
