import { prisma } from '@frego/db';
import { deriveWallet, type CampaignWalletEntry, type WalletSnapshot } from './wallet.js';

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
  redeemableNow: number;
  /** Campanha mais próxima de um prêmio (ou já resgatável). */
  nextReward: CustomerProgress | null;
};

function primaryCampaign(
  wallet: WalletSnapshot,
): CampaignWalletEntry | null {
  return (
    wallet.campaigns.find((c) => c.type !== 'birthday' && c.canRedeem) ??
    wallet.campaigns.find((c) => c.type !== 'birthday') ??
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
    },
  });

  const visitDays = new Set<string>();
  let lastVisitAt: Date | null = null;
  let stampsEarned = 0;
  let pointsEarned = 0;
  let redeems = 0;
  let spendCents = 0;

  for (const tx of transactions) {
    if (!lastVisitAt || tx.createdAt > lastVisitAt) {
      lastVisitAt = tx.createdAt;
    }
    visitDays.add(tx.createdAt.toISOString().slice(0, 10));

    if (tx.type === 'redeem') {
      redeems += tx.quantity;
      continue;
    }
    const kind =
      tx.unitKind === 'points' ||
      (tx.amountCents != null && tx.amountCents > 0)
        ? 'points'
        : 'stamps';
    if (kind === 'points') {
      pointsEarned += tx.quantity;
      if (tx.amountCents) spendCents += tx.amountCents;
    } else {
      stampsEarned += tx.quantity;
    }
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
    stampsEarned,
    pointsEarned,
    redeems,
    spendCents,
    redeemableNow,
    nextReward,
  };
}
