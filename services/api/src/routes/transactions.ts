import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { prisma } from '@frego/db';
import { requireAuth } from '../plugins/auth.js';
import { deriveWallet, pointsFromAmountCents } from '../lib/wallet.js';
import { queueEarnWhatsAppForBusiness } from '../lib/whatsapp/earn-notify.js';

const createTxBody = z.object({
  membershipId: z.string().min(1),
  type: z.enum(['stamp', 'redeem']),
  /** Ignorado no earn (pool). Redeem só via app do cliente. */
  campaignId: z.string().optional(),
  locationId: z.string().optional(),
  quantity: z.number().int().positive().max(50).optional(),
  /** 'stamps' | 'points' — default stamps; amountCents implica points. */
  unitKind: z.enum(['stamps', 'points']).optional(),
  /** Obrigatório para acúmulo de pontos (valor cobrado). */
  amountCents: z.number().int().positive().max(10_000_000).optional(),
});

export const transactionRoutes: FastifyPluginAsync = async (app) => {
  /**
   * Append-only earn (staff). Redeem pelo app do cliente → POST /me/redeem.
   * Earn grava campaignId null e alimenta o pool stamps|points.
   */
  app.post('/transactions', async (request, reply) => {
    const auth = requireAuth(request);

    const business = await prisma.business.findUnique({
      where: { id: auth.businessId },
      select: { status: true, pointsPerReal: true, name: true },
    });
    if (
      !business ||
      business.status === 'pending' ||
      business.status === 'suspended'
    ) {
      return reply.code(403).send({ error: 'BUSINESS_NOT_ACTIVE' });
    }

    const body = createTxBody.parse(request.body);

    if (body.type === 'redeem') {
      return reply.code(403).send({
        error: 'REDEEM_CUSTOMER_ONLY',
        message: 'O cliente resgata no app, escolhendo a campanha.',
      });
    }

    const membership = await prisma.membership.findFirst({
      where: { id: body.membershipId, businessId: auth.businessId },
      include: { customer: true },
    });
    if (!membership) {
      return reply.code(404).send({ error: 'MEMBERSHIP_NOT_FOUND' });
    }

    const locationId = body.locationId ?? auth.locationId;
    if (!locationId) {
      return reply.code(400).send({ error: 'LOCATION_REQUIRED' });
    }

    const location = await prisma.location.findFirst({
      where: { id: locationId, businessId: auth.businessId },
    });
    if (!location) {
      return reply.code(400).send({ error: 'INVALID_LOCATION' });
    }

    const unitKind =
      body.unitKind ?? (body.amountCents != null ? 'points' : 'stamps');

    let quantity = body.quantity ?? 1;
    let amountCents: number | null = null;

    if (unitKind === 'points') {
      if (body.amountCents == null) {
        return reply.code(400).send({ error: 'AMOUNT_REQUIRED' });
      }
      const perReal = business.pointsPerReal ?? 1;
      quantity = pointsFromAmountCents(body.amountCents, perReal);
      if (quantity < 1) {
        return reply.code(400).send({ error: 'AMOUNT_TOO_SMALL' });
      }
      amountCents = body.amountCents;
    }

    const tx = await prisma.transaction.create({
      data: {
        businessId: auth.businessId,
        membershipId: membership.id,
        campaignId: null,
        locationId,
        actorTeamMemberId: auth.teamMemberId,
        type: 'stamp',
        quantity,
        unitKind,
        amountCents,
      },
    });

    const wallet = await deriveWallet(membership.id, auth.businessId);

    let message: string;
    if (unitKind === 'points') {
      const reais = ((amountCents ?? 0) / 100).toLocaleString('pt-BR', {
        style: 'currency',
        currency: 'BRL',
      });
      message = `${reais} · +${quantity} pts — saldo ${wallet.pools.points} pts`;
    } else {
      message = `+${quantity} carimbo${quantity > 1 ? 's' : ''} — saldo ${wallet.pools.stamps}`;
    }

    // WhatsApp summary via this business's connected WABA — never blocks earn
    queueEarnWhatsAppForBusiness({
      businessId: auth.businessId,
      businessName: business.name,
      toE164: membership.customer.phoneE164,
      unitKind,
      quantity,
      amountCents,
      wallet,
      log: (msg, extra) => request.log.info(extra ?? {}, msg),
    });

    return reply.code(201).send({
      transaction: tx,
      customer: {
        id: membership.customer.id,
        displayName: membership.customer.displayName,
        phoneE164: membership.customer.phoneE164,
      },
      wallet,
      rewardUnlocked: false,
      message,
    });
  });
};
