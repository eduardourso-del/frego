import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { prisma, type Prisma } from '@frego/db';
import { requireAuth } from '../plugins/auth.js';
import {
  cashbackCentsFromSale,
  deriveWallet,
  ledgerPoolEvents,
  pointsFromAmountCents,
  poolLotsFifo,
} from '../lib/wallet.js';
import { resolveCashbackEarn } from '../lib/cashback.js';
import { activeEarnKindsForBusiness } from '../lib/earn-kinds.js';
import { queueEarnNotify } from '../lib/whatsapp/earn-notify.js';
import {
  closeConvitesForSale,
  openConviteForEarn,
} from '../lib/pesquisa-flow.js';
import { voucherFromMetadata } from '../lib/voucher.js';
import {
  isReversalMarker,
  isReversedTx,
  mergeLedgerMeta,
  saleIdFromMeta,
} from '../lib/ledger-meta.js';
import {
  earnLotStateFromPools,
  groupCounterSales,
  newSaleId,
  reverseBlockForEarn,
  reverseBlockMessage,
} from '../lib/tx-reverse.js';
import {
  loadEarnStampDestinations,
  resolveStampEarnCampaignId,
} from '../lib/stamp-destination.js';

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

    let stampCampaignId: string | null = null;
    let stampEarn: { cartela: boolean; label: string; balance: number } | null =
      null;
    if (unitKind === 'stamps') {
      // Carimbo is visit/earn only — never a sale, never cashback.
      amountCents = null;
      const destinations = await loadEarnStampDestinations(auth.businessId);
      const resolved = resolveStampEarnCampaignId(
        destinations,
        body.campaignId,
      );
      if (!resolved.ok) {
        return reply.code(400).send({
          error: resolved.error,
          message: resolved.message,
        });
      }
      stampCampaignId = resolved.campaignId;
      const chosen =
        destinations.find((d) =>
          stampCampaignId
            ? d.campaignId === stampCampaignId
            : !d.cartela && d.earnable,
        ) ?? null;
      stampEarn = chosen
        ? { cartela: chosen.cartela, label: chosen.label, balance: 0 }
        : null;
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

    const saleId = newSaleId();

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
                metadata: { saleId, role: 'apply' },
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
                campaignId: unitKind === 'stamps' ? stampCampaignId : null,
                locationId,
                actorTeamMemberId: auth.teamMemberId,
                type: 'stamp',
                quantity,
                unitKind,
                amountCents,
                metadata: { saleId, role: 'earn' },
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
                metadata: { saleId, role: 'cashback' },
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
      const earned = stampEarn;
      const row = earned
        ? wallet.stampDestinations.find((d) =>
            earned.cartela
              ? d.campaignId === stampCampaignId
              : !d.cartela,
          )
        : undefined;
      if (stampEarn && row) {
        stampEarn = {
          cartela: row.cartela,
          label: row.label,
          balance: row.balance,
        };
      }
      const qty =
        quantity === 1 ? '+1 carimbo' : `+${quantity} carimbos`;
      const saldo = stampEarn?.balance ?? wallet.pools.stamps;
      message = stampEarn?.cartela
        ? `${qty} · ${stampEarn.label} — saldo ${saldo}`
        : `${qty} — saldo ${saldo}`;
    }
    if (applied > 0) {
      message += ` · −${cashbackLabel(applied)} cashback`;
    }
    if (cashbackEarned > 0) {
      message += ` · +${cashbackLabel(cashbackEarned)} cashback`;
    }

    const anchorId = created.earnTx?.id ?? created.cashbackTx?.id ?? null;
    const credited =
      (created.earnTx != null && quantity > 0) || cashbackEarned > 0;
    let pesquisa: {
      sentence: string;
      url: string;
      conviteId: string;
    } | null = null;
    if (credited && anchorId) {
      try {
        pesquisa = await openConviteForEarn({
          businessId: auth.businessId,
          membershipId: membership.id,
          customerId: membership.customer.id,
          earnTransactionId: anchorId,
          saleId,
          earnedStamps: unitKind === 'stamps' ? quantity : 0,
          earnedPoints: unitKind === 'points' ? quantity : 0,
          earnedCashbackCents: cashbackEarned,
        });
      } catch (err) {
        request.log.error({ err }, 'pesquisa_convite_failed');
      }
    }

    queueEarnNotify({
      businessId: auth.businessId,
      businessName: business.name,
      customerId: membership.customer.id,
      toE164: membership.customer.phoneE164,
      unitKind,
      quantity,
      amountCents,
      cashbackCents: cashbackEarned > 0 ? cashbackEarned : null,
      transactionId: anchorId,
      wallet,
      stampEarn: unitKind === 'stamps' ? stampEarn : null,
      pesquisa,
      log: (msg, extra) => request.log.info(extra ?? {}, msg),
    });

    const saleRows = [
      created.applyTx,
      created.earnTx,
      created.cashbackTx,
    ].filter((row): row is NonNullable<typeof row> => row != null);
    const sale = groupCounterSales(saleRows, 1)[0] ?? null;

    return reply.code(201).send({
      transaction: created.earnTx ?? created.cashbackTx ?? created.applyTx,
      sale,
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

  /**
   * Undo a staff counter sale (earn + optional cashback apply).
   * Original rows stay in the ledger, marked reversed, so balances drop as if
   * they never happened — as long as the earned units are still unused.
   */
  app.post('/transactions/:id/reverse', async (request, reply) => {
    const auth = requireAuth(request);
    const { id } = request.params as { id: string };

    const business = await prisma.business.findUnique({
      where: { id: auth.businessId },
      select: {
        status: true,
        stampsExpireDays: true,
        pointsExpireDays: true,
        cashbackExpireDays: true,
      },
    });
    if (
      !business ||
      business.status === 'pending' ||
      business.status === 'suspended'
    ) {
      return reply.code(403).send({ error: 'BUSINESS_NOT_ACTIVE' });
    }

    const target = await prisma.transaction.findFirst({
      where: { id, businessId: auth.businessId },
    });
    if (!target) {
      return reply.code(404).send({ error: 'TRANSACTION_NOT_FOUND' });
    }

    if (isReversalMarker(target.metadata) || isReversedTx(target.metadata)) {
      return reply.code(409).send({
        error: 'ALREADY_REVERSED',
        message: 'Este lançamento já foi desfeito.',
      });
    }

    const allTxs = await prisma.transaction.findMany({
      where: {
        membershipId: target.membershipId,
        businessId: auth.businessId,
      },
      orderBy: { createdAt: 'asc' },
    });

    const saleId = saleIdFromMeta(target.metadata);
    const siblings = saleId
      ? allTxs.filter(
          (tx) =>
            saleIdFromMeta(tx.metadata) === saleId &&
            !isReversalMarker(tx.metadata),
        )
      : [target];
    const toReverse = siblings.filter((tx) => !isReversedTx(tx.metadata));
    if (toReverse.length === 0) {
      return reply.code(409).send({
        error: 'ALREADY_REVERSED',
        message: 'Este lançamento já foi desfeito.',
      });
    }

    for (const tx of toReverse) {
      if (voucherFromMetadata(tx.metadata, { createdAt: tx.createdAt })) {
        return reply.code(400).send({
          error: 'REVERSE_VOUCHER',
          message: reverseBlockMessage('voucher'),
        });
      }
      if (!tx.actorTeamMemberId) {
        return reply.code(400).send({
          error: 'REVERSE_NOT_STAFF',
          message: reverseBlockMessage('not_staff'),
        });
      }
    }

    const campaigns = await prisma.campaign.findMany({
      where: { businessId: auth.businessId },
      select: {
        id: true,
        name: true,
        type: true,
        cartela: true,
        stampsNeeded: true,
      },
    });
    const metaById = new Map(
      campaigns.map((c) => [c.id, c]),
    );
    const events = ledgerPoolEvents(allTxs, metaById);
    const stampPool = poolLotsFifo(events.stamps, business.stampsExpireDays);
    const pointPool = poolLotsFifo(events.points, business.pointsExpireDays);
    const cashbackPool = poolLotsFifo(
      events.cashback,
      business.cashbackExpireDays,
    );
    const cartelaPools = [...events.cartelas.values()].map((cartelaEvents) =>
      poolLotsFifo(cartelaEvents, business.stampsExpireDays),
    );

    for (const tx of toReverse) {
      if (tx.type !== 'stamp') continue;
      const state = earnLotStateFromPools(
        [stampPool, pointPool, cashbackPool, ...cartelaPools],
        tx.id,
      );
      const block = reverseBlockForEarn(state, tx.quantity);
      if (block) {
        return reply.code(409).send({
          error: block === 'expired' ? 'REVERSE_EXPIRED' : 'REVERSE_USED',
          message: reverseBlockMessage(block),
        });
      }
    }

    const now = new Date();
    await prisma.$transaction(async (db) => {
      const marker = await db.transaction.create({
        data: {
          businessId: auth.businessId,
          membershipId: target.membershipId,
          campaignId: null,
          locationId: target.locationId,
          actorTeamMemberId: auth.teamMemberId,
          type: 'stamp',
          quantity: 0,
          unitKind: toReverse[0]?.unitKind ?? 'stamps',
          metadata: {
            reversalOf: toReverse.map((tx) => tx.id),
            saleId: saleId ?? target.id,
          },
        },
      });
      for (const tx of toReverse) {
        await db.transaction.update({
          where: { id: tx.id },
          data: {
            metadata: mergeLedgerMeta(tx.metadata, {
              reversedAt: now.toISOString(),
              reversedByTeamMemberId: auth.teamMemberId,
              reversedByTxId: marker.id,
            }) as Prisma.InputJsonValue,
          },
        });
      }
    });

    await closeConvitesForSale(saleId ?? target.id);

    const wallet = await deriveWallet(target.membershipId, auth.businessId);
    return {
      reversedIds: toReverse.map((tx) => tx.id),
      saleId: saleId ?? target.id,
      wallet,
      pools: wallet.pools,
      cashback: {
        balanceCents: wallet.pools.cashbackCents,
      },
      message: 'Lançamento desfeito.',
    };
  });
};
