import { prisma } from '@frego/db';

export type UnitKind = 'stamps' | 'points';

export type WalletPools = {
  stamps: number;
  points: number;
};

export type BirthdayLockedReason =
  | 'no_birthday'
  | 'outside_window'
  | 'already_redeemed';

export type CampaignWalletEntry = {
  campaignId: string;
  campaignName: string;
  type: 'stamps' | 'spend' | 'visits' | 'birthday';
  /** Meta da recompensa (carimbos ou pontos). */
  unitsNeeded: number;
  /** @deprecated use unitsNeeded */
  stampsNeeded: number;
  pointsPerReal: number | null;
  canRedeem: boolean;
  rewardTitle: string | null;
  rewardDescription: string | null;
  rewardImageUrl: string | null;
  /** Quantas recompensas cabem no pool atual (floor). */
  rewardsAvailable: number;
  /** Só em campanhas de aniversário. */
  lockedReason?: BirthdayLockedReason | null;
  /** Próxima data de desbloqueio (ISO date). */
  unlocksAt?: string | null;
  /** Dias até o aniversário (0 se na janela). */
  daysUntilBirthday?: number | null;
};

/** Snapshot completo: pools + campanhas elegíveis. */
export type WalletSnapshot = {
  pools: WalletPools;
  campaigns: CampaignWalletEntry[];
};

const LOYALTY_TYPES = ['stamps', 'spend'] as const;
const WALLET_CAMPAIGN_TYPES = ['stamps', 'spend', 'birthday'] as const;

/** Janela de resgate: dia do aniversário + 6 dias seguintes. */
export const BIRTHDAY_WINDOW_DAYS = 7;

function campaignUnitKind(type: string): UnitKind | null {
  if (type === 'spend') return 'points';
  if (type === 'stamps') return 'stamps';
  return null;
}

type CampaignMeta = {
  id: string;
  type: string;
  stampsNeeded: number | null;
};

function utcDateOnly(d: Date): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
}

function addUtcDays(d: Date, days: number): Date {
  return new Date(d.getTime() + days * 86_400_000);
}

/**
 * Status da janela de aniversário (UTC, alinhado ao campo Date do Prisma).
 */
export function birthdayWindowStatus(
  birthday: Date | null | undefined,
  now = new Date(),
): {
  inWindow: boolean;
  lockedReason: BirthdayLockedReason | null;
  unlocksAt: Date | null;
  daysUntil: number | null;
  windowYear: number | null;
} {
  if (!birthday) {
    return {
      inWindow: false,
      lockedReason: 'no_birthday',
      unlocksAt: null,
      daysUntil: null,
      windowYear: null,
    };
  }

  const bMonth = birthday.getUTCMonth();
  const bDay = birthday.getUTCDate();
  const today = utcDateOnly(now);
  const year = today.getUTCFullYear();

  const candidates = [
    new Date(Date.UTC(year - 1, bMonth, bDay)),
    new Date(Date.UTC(year, bMonth, bDay)),
    new Date(Date.UTC(year + 1, bMonth, bDay)),
  ];

  for (const start of candidates) {
    const end = addUtcDays(start, BIRTHDAY_WINDOW_DAYS - 1);
    if (today >= start && today <= end) {
      return {
        inWindow: true,
        lockedReason: null,
        unlocksAt: start,
        daysUntil: 0,
        windowYear: start.getUTCFullYear(),
      };
    }
  }

  let next = new Date(Date.UTC(year, bMonth, bDay));
  if (next < today) {
    next = new Date(Date.UTC(year + 1, bMonth, bDay));
  }
  const daysUntil = Math.round(
    (next.getTime() - today.getTime()) / 86_400_000,
  );

  return {
    inWindow: false,
    lockedReason: 'outside_window',
    unlocksAt: next,
    daysUntil,
    windowYear: next.getUTCFullYear(),
  };
}

function redeemedInYear(
  transactions: Array<{
    type: string;
    campaignId: string | null;
    createdAt?: Date;
  }>,
  campaignId: string,
  year: number,
): boolean {
  return transactions.some((tx) => {
    if (tx.type !== 'redeem' || tx.campaignId !== campaignId) return false;
    if (!tx.createdAt) return true;
    return tx.createdAt.getUTCFullYear() === year;
  });
}

/**
 * Derive wallet balances from the immutable transaction ledger.
 * Earns go to shared pools (stamps / points); redeems consume from the pool
 * of the campaign's type (quantity × unitsNeeded).
 * Birthday gifts do not consume pools — once per calendar year in the window.
 */
export async function deriveWallet(
  membershipId: string,
  businessId: string,
): Promise<WalletSnapshot> {
  const [campaigns, transactions, membership] = await Promise.all([
    prisma.campaign.findMany({
      where: {
        businessId,
        status: 'active',
        type: { in: [...WALLET_CAMPAIGN_TYPES] },
      },
      orderBy: { createdAt: 'asc' },
    }),
    prisma.transaction.findMany({
      where: { membershipId, businessId },
      select: {
        type: true,
        quantity: true,
        unitKind: true,
        campaignId: true,
        amountCents: true,
        createdAt: true,
      },
    }),
    prisma.membership.findUnique({
      where: { id: membershipId },
      select: {
        customer: { select: { birthday: true } },
      },
    }),
  ]);

  const birthday = membership?.customer.birthday ?? null;

  const metaById = new Map<string, CampaignMeta>();
  for (const c of campaigns) {
    metaById.set(c.id, {
      id: c.id,
      type: c.type,
      stampsNeeded: c.stampsNeeded,
    });
  }

  const missingIds = [
    ...new Set(
      transactions
        .map((t) => t.campaignId)
        .filter((id): id is string => id != null && !metaById.has(id)),
    ),
  ];
  if (missingIds.length > 0) {
    const extra = await prisma.campaign.findMany({
      where: { id: { in: missingIds }, businessId },
      select: { id: true, type: true, stampsNeeded: true },
    });
    for (const c of extra) metaById.set(c.id, c);
  }

  let stampsEarned = 0;
  let pointsEarned = 0;
  let stampsSpent = 0;
  let pointsSpent = 0;

  for (const tx of transactions) {
    if (tx.type === 'stamp') {
      const kind = resolveEarnUnitKind(tx, metaById);
      if (kind === 'points') pointsEarned += tx.quantity;
      else if (kind === 'stamps') stampsEarned += tx.quantity;
      continue;
    }

    if (tx.type === 'redeem' && tx.campaignId) {
      const campaign = metaById.get(tx.campaignId);
      if (!campaign) continue;
      const kind = campaignUnitKind(campaign.type);
      if (!kind) continue; // birthday / visits — sem consumo de pool
      const needed =
        campaign.stampsNeeded ?? (campaign.type === 'spend' ? 100 : 10);
      const cost = tx.quantity * needed;
      if (kind === 'points') pointsSpent += cost;
      else stampsSpent += cost;
    }
  }

  const pools: WalletPools = {
    stamps: Math.max(0, stampsEarned - stampsSpent),
    points: Math.max(0, pointsEarned - pointsSpent),
  };

  const loyalty = campaigns.filter((c) =>
    (LOYALTY_TYPES as readonly string[]).includes(c.type),
  );
  const birthdayCampaigns = campaigns.filter((c) => c.type === 'birthday');

  const entries: CampaignWalletEntry[] = loyalty.map((campaign) => {
    const needed =
      campaign.stampsNeeded ?? (campaign.type === 'spend' ? 100 : 10);
    const kind = campaignUnitKind(campaign.type) ?? 'stamps';
    const pool = kind === 'points' ? pools.points : pools.stamps;
    const rewardsAvailable = Math.floor(pool / needed);
    return {
      campaignId: campaign.id,
      campaignName: campaign.name,
      type: campaign.type,
      unitsNeeded: needed,
      stampsNeeded: needed,
      pointsPerReal: campaign.pointsPerReal,
      canRedeem: rewardsAvailable >= 1,
      rewardsAvailable,
      rewardTitle: campaign.rewardTitle,
      rewardDescription: campaign.rewardDescription,
      rewardImageUrl: campaign.rewardImageUrl,
    };
  });

  const window = birthdayWindowStatus(birthday);

  for (const campaign of birthdayCampaigns) {
    let lockedReason = window.lockedReason;
    let canRedeem = window.inWindow;
    let rewardsAvailable = canRedeem ? 1 : 0;

    if (
      canRedeem &&
      window.windowYear != null &&
      redeemedInYear(transactions, campaign.id, window.windowYear)
    ) {
      lockedReason = 'already_redeemed';
      canRedeem = false;
      rewardsAvailable = 0;
    }

    entries.push({
      campaignId: campaign.id,
      campaignName: campaign.name,
      type: 'birthday',
      unitsNeeded: 1,
      stampsNeeded: 1,
      pointsPerReal: null,
      canRedeem,
      rewardsAvailable,
      rewardTitle: campaign.rewardTitle,
      rewardDescription: campaign.rewardDescription,
      rewardImageUrl: campaign.rewardImageUrl,
      lockedReason,
      unlocksAt: window.unlocksAt
        ? window.unlocksAt.toISOString().slice(0, 10)
        : null,
      daysUntilBirthday: window.daysUntil,
    });
  }

  return { pools, campaigns: entries };
}

function resolveEarnUnitKind(
  tx: {
    unitKind: string | null;
    amountCents: number | null;
    campaignId: string | null;
  },
  metaById: Map<string, CampaignMeta>,
): UnitKind | null {
  if (tx.unitKind === 'points' || tx.unitKind === 'stamps') {
    return tx.unitKind;
  }
  if (tx.campaignId) {
    const c = metaById.get(tx.campaignId);
    if (c) return campaignUnitKind(c.type);
  }
  if (tx.amountCents != null && tx.amountCents > 0) return 'points';
  return 'stamps';
}

/** Pontos a partir do valor em centavos. */
export function pointsFromAmountCents(
  amountCents: number,
  pointsPerReal: number,
): number {
  if (amountCents <= 0 || pointsPerReal <= 0) return 0;
  return Math.floor(amountCents / 100) * pointsPerReal;
}
