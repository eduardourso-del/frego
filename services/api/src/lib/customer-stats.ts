import { prisma } from '@frego/db';
import { deriveWallet, type CampaignWalletEntry, type WalletSnapshot } from './wallet.js';

import { shouldOmitFromLedger } from './ledger-meta.js';

export type CustomerProgress = {
  campaignId: string;
  campaignName: string;
  type: CampaignWalletEntry['type'];
  current: number;
  needed: number;
  /** Unidades até o próximo prêmio (0 se já pode resgatar). */
  remaining: number;
  canRedeem: boolean;
  rewardTitle: string | null;
  businessId?: string;
  businessName?: string;
};

export type CustomerLifetimeStats = {
  shops: number;
  visits: number;
  lastVisitAt: Date | null;
  stampsEarned: number;
  pointsEarned: number;
  redeems: number;
  spendCents: number;
  cashbackEarnedCents: number;
  cashbackSpentCents: number;
  redeemableNow: number;
  /** Campanha mais próxima de um prêmio (ou já resgatável). */
  nextReward: CustomerProgress | null;
};

type LedgerTx = {
  type: string;
  quantity: number;
  unitKind: string | null;
  amountCents: number | null;
  metadata?: unknown;
};

/** Classifica uma linha do ledger sem misturar cashback (centavos) com carimbos/pontos. */
export function isCashbackUnit(unitKind: string | null | undefined) {
  return unitKind === 'cashback_cents';
}

export function foldLedgerTx(
  acc: {
    stampsEarned: number;
    pointsEarned: number;
    redeems: number;
    spendCents: number;
    cashbackEarnedCents: number;
    cashbackSpentCents: number;
  },
  tx: LedgerTx,
) {
  if (shouldOmitFromLedger(tx.metadata)) return;
  if (tx.unitKind === 'cashback_cents') {
    if (tx.type === 'redeem') acc.cashbackSpentCents += tx.quantity;
    else acc.cashbackEarnedCents += tx.quantity;
    return;
  }
  if (tx.type === 'redeem') {
    acc.redeems += tx.quantity;
    return;
  }
  const isPoints =
    tx.unitKind === 'points' ||
    (tx.unitKind == null && (tx.amountCents ?? 0) > 0);
  if (isPoints) {
    acc.pointsEarned += tx.quantity;
    if (tx.amountCents) acc.spendCents += tx.amountCents;
  } else {
    acc.stampsEarned += tx.quantity;
    if (tx.amountCents) acc.spendCents += tx.amountCents;
  }
}

function primaryCampaign(
  wallet: WalletSnapshot,
): CampaignWalletEntry | null {
  return (
    wallet.campaigns.find((c) => c.type !== 'birthday' && c.type !== 'cashback' && c.canRedeem) ??
    wallet.campaigns.find((c) => c.type !== 'birthday' && c.type !== 'cashback') ??
    wallet.campaigns.find((c) => c.canRedeem) ??
    wallet.campaigns[0] ??
    null
  );
}

export function progressFromWallet(
  wallet: WalletSnapshot,
  extras?: { businessId?: string; businessName?: string },
): CustomerProgress | null {
  const primary = primaryCampaign(wallet);
  if (!primary || primary.unitsNeeded <= 0) return null;

  const current =
    primary.type === 'spend' ? wallet.pools.points : wallet.pools.stamps;
  const needed = primary.unitsNeeded;
  const inCycle = current % needed;
  const remaining = primary.canRedeem
    ? 0
    : inCycle === 0
      ? needed
      : needed - inCycle;

  return {
    campaignId: primary.campaignId,
    campaignName: primary.campaignName,
    type: primary.type,
    current,
    needed,
    remaining,
    canRedeem: primary.canRedeem,
    rewardTitle: primary.rewardTitle,
    ...extras,
  };
}

/** Agrega visitas / ganhos / resgates do cliente em todas as lojas. */
export async function aggregateCustomerStats(
  customerId: string,
): Promise<CustomerLifetimeStats> {
  const memberships = await prisma.membership.findMany({
    where: { customerId },
    select: {
      id: true,
      businessId: true,
      business: { select: { name: true } },
    },
  });

  if (memberships.length === 0) {
    return {
      shops: 0,
      visits: 0,
      lastVisitAt: null,
      stampsEarned: 0,
      pointsEarned: 0,
      redeems: 0,
      spendCents: 0,
      cashbackEarnedCents: 0,
      cashbackSpentCents: 0,
      redeemableNow: 0,
      nextReward: null,
    };
  }

  const membershipIds = memberships.map((m) => m.id);
  const transactions = await prisma.transaction.findMany({
    where: { membershipId: { in: membershipIds } },
    select: {
      type: true,
      quantity: true,
      unitKind: true,
      amountCents: true,
      createdAt: true,
      metadata: true,
    },
  });

  const visitDays = new Set<string>();
  let lastVisitAt: Date | null = null;
  const fold = {
    stampsEarned: 0,
    pointsEarned: 0,
    redeems: 0,
    spendCents: 0,
    cashbackEarnedCents: 0,
    cashbackSpentCents: 0,
  };

  for (const tx of transactions) {
    if (shouldOmitFromLedger(tx.metadata)) continue;
    if (!lastVisitAt || tx.createdAt > lastVisitAt) {
      lastVisitAt = tx.createdAt;
    }
    visitDays.add(tx.createdAt.toISOString().slice(0, 10));
    foldLedgerTx(fold, tx);
  }

  const wallets = await Promise.all(
    memberships.map(async (m) => {
      const wallet = await deriveWallet(m.id, m.businessId);
      return {
        businessId: m.businessId,
        businessName: m.business.name,
        wallet,
      };
    }),
  );

  let redeemableNow = 0;
  let nextReward: CustomerProgress | null = null;

  for (const { businessId, businessName, wallet } of wallets) {
    redeemableNow += wallet.campaigns.filter((c) => c.canRedeem).length;
    const progress = progressFromWallet(wallet, {
      businessId,
      businessName,
    });
    if (!progress) continue;

    if (!nextReward) {
      nextReward = progress;
      continue;
    }
    // Prefer already-redeemable, then smallest remaining.
    if (progress.canRedeem && !nextReward.canRedeem) {
      nextReward = progress;
    } else if (progress.canRedeem === nextReward.canRedeem) {
      if (progress.remaining < nextReward.remaining) {
        nextReward = progress;
      }
    }
  }

  return {
    shops: memberships.length,
    visits: visitDays.size,
    lastVisitAt,
    stampsEarned: fold.stampsEarned,
    pointsEarned: fold.pointsEarned,
    redeems: fold.redeems,
    spendCents: fold.spendCents,
    cashbackEarnedCents: fold.cashbackEarnedCents,
    cashbackSpentCents: fold.cashbackSpentCents,
    redeemableNow,
    nextReward,
  };
}
