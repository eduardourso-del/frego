import { prisma, type Prisma } from '@frego/db';
import { resolveCashbackEarn } from './cashback.js';
import { maxCashbackUseCents } from './cashback-use.js';
import { activeEarnKindsForBusiness } from './earn-kinds.js';
import { openConviteForEarn } from './pesquisa-flow.js';
import {
  loadEarnStampDestinations,
  resolveStampEarnCampaignId,
} from './stamp-destination.js';
import { newSaleId, groupCounterSales } from './tx-reverse.js';
import {
  cashbackCentsFromSale,
  deriveWallet,
  pointsFromAmountCents,
  type WalletSnapshot,
} from './wallet.js';
import { queueEarnNotify } from './whatsapp/earn-notify-hold.js';

export type SaleLog = (msg: string, extra?: Record<string, unknown>) => void;

export type RecordSaleMode =
  | { kind: 'stamps'; campaignId?: string; quantity?: number }
  | { kind: 'points'; amountCents?: number; applyCashbackCents?: number }
  | {
      kind: 'cashback';
      amountCents?: number;
      applyCashbackCents?: number;
      earnCashback?: boolean;
    }
  | {
      kind: 'amount';
      amountCents: number;
      saiposSaleId: string;
    };

export type RecordSaleFailure = {
  ok: false;
  status: number;
  error: string;
  message?: string;
};

type StampEarn = { cartela: boolean; label: string; balance: number };

export type RecordSaleSuccess = {
  ok: true;
  saleId: string;
  membershipId: string;
  customerId: string;
  points: number;
  stamps: number;
  cashbackCents: number;
  body: {
    transaction: { id: string } | null;
    sale: ReturnType<typeof groupCounterSales>[number] | null;
    cashback: {
      appliedCents: number;
      earnedCents: number;
      balanceCents: number;
    };
    customer: {
      id: string;
      displayName: string | null;
      phoneE164: string;
    };
    wallet: WalletSnapshot;
    rewardUnlocked: false;
    message: string;
  };
};

function fail(
  status: number,
  error: string,
  message?: string,
): RecordSaleFailure {
  return { ok: false, status, error, message };
}

function money(cents: number): string {
  return (cents / 100).toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  });
}

function ledgerMeta(input: {
  saleId: string;
  role: 'earn' | 'apply' | 'cashback';
  saiposSaleId?: string;
}): Prisma.InputJsonValue {
  if (!input.saiposSaleId) {
    return { saleId: input.saleId, role: input.role };
  }
  return {
    saleId: input.saleId,
    role: input.role,
    source: 'saipos',
    saiposSaleId: input.saiposSaleId,
  };
}

/**
 * The till earn, and a Saipos amount earn. Pontos, cashback, the Convite,
 * and the WhatsApp message stay one implementation.
 * `amount` credits every open amount Campanha and does not Usar cashback.
 */
export async function recordSaleEarn(input: {
  businessId: string;
  membershipId: string;
  locationId: string;
  actorTeamMemberId: string;
  mode: RecordSaleMode;
  log?: SaleLog;
}): Promise<RecordSaleFailure | RecordSaleSuccess> {
  const business = await prisma.business.findUnique({
    where: { id: input.businessId },
    select: {
      status: true,
      pointsPerReal: true,
      cashbackMaxCents: true,
      cashbackMinPurchaseCents: true,
      cashbackUseMultiple: true,
      name: true,
    },
  });
  if (
    !business ||
    business.status === 'pending' ||
    business.status === 'suspended'
  ) {
    return fail(403, 'BUSINESS_NOT_ACTIVE');
  }

  const membership = await prisma.membership.findFirst({
    where: { id: input.membershipId, businessId: input.businessId },
    include: { customer: true },
  });
  if (!membership) return fail(404, 'MEMBERSHIP_NOT_FOUND');

  const location = await prisma.location.findFirst({
    where: { id: input.locationId, businessId: input.businessId },
  });
  if (!location) return fail(400, 'INVALID_LOCATION');

  const mode = input.mode;
  const saiposSaleId = mode.kind === 'amount' ? mode.saiposSaleId : undefined;
  const earnKinds = await activeEarnKindsForBusiness(input.businessId);

  if (mode.kind === 'stamps' && !earnKinds.includes('stamps')) {
    return fail(
      400,
      'EARN_KIND_INACTIVE',
      'Esta loja não tem campanha de carimbos ativa.',
    );
  }
  if (mode.kind === 'points' && !earnKinds.includes('points')) {
    return fail(
      400,
      'EARN_KIND_INACTIVE',
      'Esta loja não tem campanha de pontos ativa.',
    );
  }
  const requestedApply =
    mode.kind === 'points' || mode.kind === 'cashback'
      ? (mode.applyCashbackCents ?? 0)
      : 0;
  if (
    mode.kind === 'cashback' &&
    !earnKinds.includes('cashback') &&
    requestedApply <= 0
  ) {
    return fail(
      400,
      'EARN_KIND_INACTIVE',
      'Esta loja não tem campanha de cashback ativa.',
    );
  }
  if (
    mode.kind === 'amount' &&
    !earnKinds.includes('points') &&
    !earnKinds.includes('cashback')
  ) {
    return fail(400, 'NOTHING_TO_RECORD', 'Nenhuma campanha de pontos ou cashback ativa.');
  }

  let quantity = mode.kind === 'stamps' ? (mode.quantity ?? 1) : 1;
  let amountCents: number | null =
    mode.kind === 'stamps' ? null : (mode.amountCents ?? null);

  if (mode.kind === 'points' || mode.kind === 'amount') {
    if (mode.amountCents == null) return fail(400, 'AMOUNT_REQUIRED');
    amountCents = mode.amountCents;
  }
  if (mode.kind === 'cashback') {
    if (mode.amountCents == null) return fail(400, 'AMOUNT_REQUIRED');
    amountCents = mode.amountCents;
    quantity = 0;
  }

  let pointsQuantity = 0;
  if (mode.kind === 'points' || (mode.kind === 'amount' && earnKinds.includes('points'))) {
    const perReal = business.pointsPerReal ?? 1;
    pointsQuantity = pointsFromAmountCents(amountCents ?? 0, perReal);
    if (mode.kind === 'points' && pointsQuantity < 1) {
      return fail(400, 'AMOUNT_TOO_SMALL');
    }
    if (mode.kind === 'points') quantity = pointsQuantity;
  }

  let stampCampaignId: string | null = null;
  let stampEarn: StampEarn | null = null;
  if (mode.kind === 'stamps') {
    amountCents = null;
    const destinations = await loadEarnStampDestinations(input.businessId);
    const resolved = resolveStampEarnCampaignId(destinations, mode.campaignId);
    if (!resolved.ok) {
      return fail(400, resolved.error, resolved.message);
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

  const applyRequested = mode.kind === 'stamps' ? 0 : requestedApply;
  if (applyRequested > 0 && amountCents == null) {
    return fail(400, 'AMOUNT_REQUIRED');
  }

  const walletBefore = await deriveWallet(membership.id, input.businessId);
  const ceiling = maxCashbackUseCents(
    amountCents,
    walletBefore.pools.cashbackCents,
    business.cashbackUseMultiple,
  );
  const applied = Math.min(applyRequested, ceiling);

  const wantCashback =
    mode.kind === 'cashback' ||
    (mode.kind === 'amount' && earnKinds.includes('cashback'));
  const cashbackEarn = wantCashback || applied > 0
    ? await resolveCashbackEarn(membership.id, input.businessId)
    : null;

  const paidCents = (amountCents ?? 0) - applied;
  const minPurchase = business.cashbackMinPurchaseCents ?? 0;
  const earnCashback = mode.kind === 'cashback' ? mode.earnCashback !== false : true;
  let cashbackEarned = 0;
  if (
    earnCashback &&
    wantCashback &&
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

  if (mode.kind === 'cashback' && applied === 0 && cashbackEarned === 0) {
    return fail(
      400,
      'CASHBACK_NOTHING_TO_RECORD',
      earnCashback
        ? 'Ative uma campanha de cashback com porcentagem, ou aplique saldo existente.'
        : 'Para não entrar cashback, use o saldo nesta compra.',
    );
  }
  if (mode.kind === 'amount' && pointsQuantity < 1 && cashbackEarned === 0) {
    return fail(400, 'NOTHING_TO_RECORD', 'Esta compra não gerou pontos nem cashback.');
  }

  const saleId = newSaleId();
  const creditPoints = mode.kind === 'points' || (mode.kind === 'amount' && pointsQuantity >= 1);

  const created = await prisma.$transaction(async (tx) => {
    const applyTx =
      applied > 0
        ? await tx.transaction.create({
            data: {
              businessId: input.businessId,
              membershipId: membership.id,
              campaignId: cashbackEarn?.campaignId ?? null,
              locationId: input.locationId,
              actorTeamMemberId: input.actorTeamMemberId,
              type: 'redeem',
              quantity: applied,
              unitKind: 'cashback_cents',
              amountCents,
              metadata: ledgerMeta({ saleId, role: 'apply', saiposSaleId }),
            },
          })
        : null;

    const earnTx =
      mode.kind === 'cashback' || (mode.kind === 'amount' && !creditPoints)
        ? null
        : await tx.transaction.create({
            data: {
              businessId: input.businessId,
              membershipId: membership.id,
              campaignId: mode.kind === 'stamps' ? stampCampaignId : null,
              locationId: input.locationId,
              actorTeamMemberId: input.actorTeamMemberId,
              type: 'stamp',
              quantity: mode.kind === 'amount' ? pointsQuantity : quantity,
              unitKind: mode.kind === 'amount' ? 'points' : mode.kind,
              amountCents,
              metadata: ledgerMeta({ saleId, role: 'earn', saiposSaleId }),
            },
          });

    const cashbackTx =
      cashbackEarned > 0
        ? await tx.transaction.create({
            data: {
              businessId: input.businessId,
              membershipId: membership.id,
              campaignId: cashbackEarn!.campaignId,
              locationId: input.locationId,
              actorTeamMemberId: input.actorTeamMemberId,
              type: 'stamp',
              quantity: cashbackEarned,
              unitKind: 'cashback_cents',
              amountCents: paidCents,
              metadata: ledgerMeta({ saleId, role: 'cashback', saiposSaleId }),
            },
          })
        : null;

    return { applyTx, earnTx, cashbackTx };
  });

  const wallet = await deriveWallet(membership.id, input.businessId);

  if (mode.kind === 'stamps' && stampEarn) {
    const row = wallet.stampDestinations.find((d) =>
      stampEarn!.cartela
        ? d.campaignId === stampCampaignId
        : !d.cartela,
    );
    if (row) {
      stampEarn = {
        cartela: row.cartela,
        label: row.label,
        balance: row.balance,
      };
    }
  }

  const notifyKind =
    mode.kind === 'amount'
      ? creditPoints
        ? 'points'
        : 'cashback'
      : mode.kind;
  const notifyQuantity =
    mode.kind === 'amount'
      ? creditPoints
        ? pointsQuantity
        : 0
      : mode.kind === 'cashback'
        ? 0
        : quantity;

  let message: string;
  if (notifyKind === 'points') {
    const reais = money(amountCents ?? 0);
    const pts = mode.kind === 'amount' ? pointsQuantity : quantity;
    message = `${reais} · +${pts} pts — saldo ${wallet.pools.points} pts`;
  } else if (notifyKind === 'cashback') {
    const reais = money(amountCents ?? 0);
    message = `${reais} — saldo ${money(wallet.pools.cashbackCents)}`;
  } else {
    const qty = quantity === 1 ? '+1 carimbo' : `+${quantity} carimbos`;
    const saldo = stampEarn?.balance ?? wallet.pools.stamps;
    message = stampEarn?.cartela
      ? `${qty} · ${stampEarn.label} — saldo ${saldo}`
      : `${qty} — saldo ${saldo}`;
  }
  if (applied > 0) message += ` · −${money(applied)} cashback`;
  if (cashbackEarned > 0) message += ` · +${money(cashbackEarned)} cashback`;

  const anchorId = created.earnTx?.id ?? created.cashbackTx?.id ?? null;
  const credited =
    (created.earnTx != null && notifyQuantity > 0) ||
    cashbackEarned > 0 ||
    (mode.kind === 'stamps' && created.earnTx != null);
  let pesquisa: {
    sentence: string;
    url: string;
    conviteId: string;
  } | null = null;
  if (credited && anchorId) {
    try {
      pesquisa = await openConviteForEarn({
        businessId: input.businessId,
        membershipId: membership.id,
        customerId: membership.customer.id,
        earnTransactionId: anchorId,
        saleId,
        earnedStamps: mode.kind === 'stamps' ? quantity : 0,
        earnedPoints:
          notifyKind === 'points'
            ? mode.kind === 'amount'
              ? pointsQuantity
              : quantity
            : 0,
        earnedCashbackCents: cashbackEarned,
      });
    } catch (err) {
      input.log?.('pesquisa_convite_failed', { err: String(err) });
    }
  }

  await queueEarnNotify({
    businessId: input.businessId,
    businessName: business.name,
    customerId: membership.customer.id,
    toE164: membership.customer.phoneE164,
    unitKind: notifyKind,
    quantity: notifyQuantity,
    amountCents,
    cashbackCents: cashbackEarned > 0 ? cashbackEarned : null,
    saleId,
    transactionId: anchorId,
    wallet,
    stampEarn: mode.kind === 'stamps' ? stampEarn : null,
    pesquisa,
    log: input.log,
  });

  const saleRows = [created.applyTx, created.earnTx, created.cashbackTx].filter(
    (row): row is NonNullable<typeof row> => row != null,
  );
  const sale = groupCounterSales(saleRows, 1)[0] ?? null;

  return {
    ok: true,
    saleId,
    membershipId: membership.id,
    customerId: membership.customer.id,
    points: notifyKind === 'points' ? (mode.kind === 'amount' ? pointsQuantity : quantity) : 0,
    stamps: mode.kind === 'stamps' ? quantity : 0,
    cashbackCents: cashbackEarned,
    body: {
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
    },
  };
}
