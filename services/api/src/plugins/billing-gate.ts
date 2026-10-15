import type { FastifyPluginAsync } from 'fastify';
import fp from 'fastify-plugin';
import { loadBilling } from '../lib/billing.js';
import type { Feature } from '../lib/plan-access.js';

const FEATURE_PREFIXES: Array<[string, Feature]> = [
  ['/audiences', 'audiences'],
  ['/pesquisas', 'pesquisas'],
  ['/reports', 'reports'],
  ['/whatsapp', 'whatsapp'],
];

function allowedWhenLocked(method: string, path: string) {
  if (path === '/me/businesses' || path.startsWith('/billing')) return true;
  if (method === 'GET' && (path === '/business' || path === '/business/locations')) {
    return true;
  }
  return false;
}

const billingGateImpl: FastifyPluginAsync = async (app) => {
  app.addHook('preHandler', async (request, reply) => {
    if (!request.auth) return;
    const path = request.url.split('?')[0] ?? '';
    const loaded = await loadBilling(request.auth.businessId);
    if (!loaded) return;

    if (loaded.access.mode === 'pending' || loaded.access.mode === 'suspended') {
      return;
    }

    if (loaded.access.mode === 'locked' && !allowedWhenLocked(request.method, path)) {
      return reply.code(403).send({ error: 'BILLING_LOCKED' });
    }

    if (loaded.access.mode !== 'open') return;
    const feature = FEATURE_PREFIXES.find(([prefix]) => path.startsWith(prefix))?.[1];
    if (feature && !loaded.access.features[feature] && request.method !== 'GET') {
      return reply.code(403).send({
        error: 'PLAN_REQUIRED',
        feature,
        tier: loaded.access.tier,
      });
    }
  });
};

export const billingGate = fp(billingGateImpl, {
  name: 'billing-gate',
  dependencies: ['auth'],
});
