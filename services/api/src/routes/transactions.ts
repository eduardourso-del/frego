import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { prisma } from '@frego/db';
import { requireAuth } from '../plugins/auth.js';
import {
  cashbackCentsFromSale,
  deriveWallet,
  pointsFromAmountCents,
} from '../lib/wallet.js';
import { resolveCashbackEarn } from '../lib/cashback.js';
import { activeEarnKindsForBusiness } from '../lib/earn-kinds.js';
import { queueEarnWhatsAppForBusiness } from '../lib/whatsapp/earn-notify.js';

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
});

export const transactionRoutes: FastifyPluginAsync = async (app) => {
  /**
   * Append-only earn (staff). Redeem pelo app do cliente → POST /me/redeem.
   * Cashback apply é a exceção: staff desconta o saldo em R$ no caixa.
   */
  app.post('/transactions', async (request, reply) => {
    const auth = requireAuth(request);

    const business = await prisma.business.findUnique({
      where: { id: auth.businessId },
      select: {
        status: true,
        pointsPerReal: true,
        cashbackMaxCents: true,
        cashbackMinPurchaseCents: true,
        name: true,
      },
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

    const requestedApply = body.applyCashbackCents ?? 0;
    const earnKinds = await activeEarnKindsForBusiness(auth.businessId);
    if (
      (unitKind === 'stamps' || unitKind === 'points') &&
      !earnKinds.includes(unitKind)
    ) {
      const labels = { stamps: 'carimbos', points: 'pontos' } as const;
      return reply.code(400).send({
        error: 'EARN_KIND_INACTIVE',
        message: `Esta loja não tem campanha de ${labels[unitKind]} ativa.`,
      });
    }
    if (
      unitKind === 'cashback' &&
      !earnKinds.includes('cashback') &&
      requestedApply <= 0
    ) {
      return reply.code(400).send({
        error: 'EARN_KIND_INACTIVE',
        message: 'Esta loja não tem campanha de cashback ativa.',
      });
    }

    let quantity = body.quantity ?? 1;
    let amountCents: number | null = body.amountCents ?? null;

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

    if (unitKind === 'cashback') {
      if (body.amountCents == null) {
        return reply.code(400).send({ error: 'AMOUNT_REQUIRED' });
      }
      amountCents = body.amountCents;
      quantity = 0;
    }

    if (unitKind === 'stamps') {
      // Carimbo is visit/earn only — never a sale, never cashback.
      amountCents = null;
    }

    const applyRequested = unitKind === 'stamps' ? 0 : requestedApply;
    if (applyRequested > 0 && amountCents == null) {
      return reply.code(400).send({ error: 'AMOUNT_REQUIRED' });
    }

    const walletBefore = await deriveWallet(membership.id, auth.businessId);
    const applied = Math.min(
      applyRequested,
      walletBefore.pools.cashbackCents,
      amountCents ?? 0,
    );

    const cashbackEarn = await resolveCashbackEarn(
      membership.id,
      auth.businessId,
    );

    const paidCents = (amountCents ?? 0) - applied;
    const minPurchase = business.cashbackMinPurchaseCents ?? 0;
    let cashbackEarned = 0;
    if (
      unitKind === 'cashback' &&
      cashbackEarn &&
      amountCents != null &&
      paidCents >= minPurchase
    ) {
      cashbackEarned = cashbackCentsFromSale(
        paidCents,
        cashbackEarn.percent,
        business.cashbackMaxCents,
      );
    }

    if (unitKind === 'cashback' && applied === 0 && cashbackEarned === 0) {
      return reply.code(400).send({
        error: 'CASHBACK_NOTHING_TO_RECORD',
        message:
          'Ative uma campanha de cashback com porcentagem, ou aplique saldo existente.',
      });
    }

    const created = await prisma.$transaction(async (tx) => {
      const applyTx =
        applied > 0
          ? await tx.transaction.create({
              data: {
                businessId: auth.businessId,
                membershipId: membership.id,
                campaignId: cashbackEarn?.campaignId ?? null,
                locationId,
                actorTeamMemberId: auth.teamMemberId,
                type: 'redeem',
                quantity: applied,
                unitKind: 'cashback_cents',
                amountCents,
              },
            })
          : null;

      const earnTx =
        unitKind === 'cashback'
          ? null
          : await tx.transaction.create({
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

      const cashbackTx =
        cashbackEarned > 0
          ? await tx.transaction.create({
              data: {
                businessId: auth.businessId,
                membershipId: membership.id,
                campaignId: cashbackEarn!.campaignId,
                locationId,
                actorTeamMemberId: auth.teamMemberId,
                type: 'stamp',
                quantity: cashbackEarned,
                unitKind: 'cashback_cents',
                amountCents: paidCents,
              },
            })
          : null;

      return { applyTx, earnTx, cashbackTx };
    });

    const wallet = await deriveWallet(membership.id, auth.businessId);

    const cashbackLabel = (cents: number) =>
      (cents / 100).toLocaleString('pt-BR', {
        style: 'currency',
        currency: 'BRL',
      });

    let message: string;
    if (unitKind === 'points') {
      const reais = ((amountCents ?? 0) / 100).toLocaleString('pt-BR', {
        style: 'currency',
        currency: 'BRL',
      });
      message = `${reais} · +${quantity} pts — saldo ${wallet.pools.points} pts`;
    } else if (unitKind === 'cashback') {
      const reais = ((amountCents ?? 0) / 100).toLocaleString('pt-BR', {
        style: 'currency',
        currency: 'BRL',
      });
      message = `${reais} — saldo ${cashbackLabel(wallet.pools.cashbackCents)}`;
    } else {
      message = `+${quantity} carimbo${quantity > 1 ? 's' : ''} — saldo ${wallet.pools.stamps}`;
    }
    if (applied > 0) {
      message += ` · −${cashbackLabel(applied)} cashback`;
    }
    if (cashbackEarned > 0) {
      message += ` · +${cashbackLabel(cashbackEarned)} cashback`;
    }

    queueEarnWhatsAppForBusiness({
      businessId: auth.businessId,
      businessName: business.name,
      toE164: membership.customer.phoneE164,
      unitKind,
      quantity,
      amountCents,
      cashbackCents: cashbackEarned > 0 ? cashbackEarned : null,
      wallet,
      log: (msg, extra) => request.log.info(extra ?? {}, msg),
    });

    return reply.code(201).send({
      transaction: created.earnTx ?? created.cashbackTx ?? created.applyTx,
      cashback: {
        appliedCents: applied,
        earnedCents: cashbackEarned,
        balanceCents: wallet.pools.cashbackCents,
      },
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
