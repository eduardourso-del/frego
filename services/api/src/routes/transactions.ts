import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { prisma } from '@frego/db';
import { requireAuth } from '../plugins/auth.js';
import { recordSaleEarn, type RecordSaleMode } from '../lib/record-sale.js';
import { reverseLedgerSale } from '../lib/reverse-sale.js';

const createTxBody = z.object({
  membershipId: z.string().min(1),
  type: z.enum(['stamp', 'redeem']),
  /** Ignorado no earn (pool). Redeem só via app do cliente. */
  campaignId: z.string().optional(),
  locationId: z.string().optional(),
  quantity: z.number().int().positive().max(50).optional(),
  /** 'stamps' | 'points' | 'cashback' — default stamps; amountCents implica points. */
  unitKind: z.enum(['stamps', 'points', 'cashback']).optional(),
  /** Valor da venda em centavos. Obrigatório para pontos; usado no cashback. */
  amountCents: z.number().int().positive().max(10_000_000).optional(),
  /** Desconto de cashback a aplicar nesta venda (centavos). */
  applyCashbackCents: z.number().int().min(0).max(10_000_000).optional(),
  /** Quando false, a compra não gera cashback novo. O saldo só sai se houver apply. */
  earnCashback: z.boolean().optional(),
});

function modeFromBody(body: z.infer<typeof createTxBody>): RecordSaleMode {
  const unitKind =
    body.unitKind ?? (body.amountCents != null ? 'points' : 'stamps');
  if (unitKind === 'stamps') {
    return {
      kind: 'stamps',
      campaignId: body.campaignId,
      quantity: body.quantity,
    };
  }
  if (unitKind === 'cashback') {
    return {
      kind: 'cashback',
      amountCents: body.amountCents,
      applyCashbackCents: body.applyCashbackCents,
      earnCashback: body.earnCashback,
    };
  }
  return {
    kind: 'points',
    amountCents: body.amountCents,
    applyCashbackCents: body.applyCashbackCents,
  };
}

export const transactionRoutes: FastifyPluginAsync = async (app) => {
  /**
   * Append-only earn (staff). Redeem pelo app do cliente → POST /me/redeem.
   * Cashback apply é a exceção: staff desconta o saldo em R$ no caixa.
   */
  app.post('/transactions', async (request, reply) => {
    const auth = requireAuth(request);
    const body = createTxBody.parse(request.body);

    if (body.type === 'redeem') {
      return reply.code(403).send({
        error: 'REDEEM_CUSTOMER_ONLY',
        message: 'O cliente resgata no app, escolhendo a campanha.',
      });
    }

    const membership = await prisma.membership.findFirst({
      where: { id: body.membershipId, businessId: auth.businessId },
      select: { id: true },
    });
    if (!membership) {
      return reply.code(404).send({ error: 'MEMBERSHIP_NOT_FOUND' });
    }

    const locationId = body.locationId ?? auth.locationId;
    if (!locationId) {
      return reply.code(400).send({ error: 'LOCATION_REQUIRED' });
    }

    const result = await recordSaleEarn({
      businessId: auth.businessId,
      membershipId: membership.id,
      locationId,
      actorTeamMemberId: auth.teamMemberId,
      mode: modeFromBody(body),
      log: (msg, extra) => request.log.info(extra ?? {}, msg),
    });
    if (!result.ok) {
      return reply.code(result.status).send({
        error: result.error,
        message: result.message,
      });
    }
    return reply.code(201).send(result.body);
  });

  /**
   * Undo a staff counter sale (earn + optional cashback apply).
   * Original rows stay in the ledger, marked reversed, so balances drop as if
   * they never happened — as long as the earned units are still unused.
   */
  app.post('/transactions/:id/reverse', async (request, reply) => {
    const auth = requireAuth(request);
    const { id } = request.params as { id: string };
    const result = await reverseLedgerSale({
      businessId: auth.businessId,
      transactionId: id,
      actorTeamMemberId: auth.teamMemberId,
      log: (msg, extra) => request.log.error(extra ?? {}, msg),
    });
    if (!result.ok) {
      return reply.code(result.status).send({
        error: result.error,
        message: result.message,
      });
    }
    const { ok: _ok, ...body } = result;
    return body;
  });
};
