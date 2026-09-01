import { prisma } from '@frego/db';

export type UnitKind = 'stamps' | 'points' | 'cashback_cents';

export type WalletPools = {
  stamps: number;
  points: number;
  cashbackCents: number;
};

export type BirthdayLockedReason =
  | 'no_birthday'
  | 'outside_window'
  | 'already_redeemed'
  | 'audience';

export type CampaignWalletEntry = {
  campaignId: string;
  campaignName: string;
  type: 'stamps' | 'spend' | 'visits' | 'birthday' | 'cashback';
  /** Meta da recompensa (carimbos ou pontos). */
  unitsNeeded: number;
  /** @deprecated use unitsNeeded */
  stampsNeeded: number;
  pointsPerReal: number | null;
  /** % desta campanha (só cashback). */
  cashbackPercent?: number | null;
  /** Saldo atual em centavos (só campanha cashback). */
  cashbackBalanceCents?: number;
  canRedeem: boolean;
  rewardTitle: string | null;
  rewardDescription: string | null;
  rewardImageUrl: string | null;
  /** Quantas recompensas cabem no pool atual (floor). */
  rewardsAvailable: number;
  /** Só em campanhas de aniversário / audiência. */
  lockedReason?: BirthdayLockedReason | null;
  /** Próxima data de desbloqueio (ISO date). */
  unlocksAt?: string | null;
  /** Dias até o aniversário (0 se na janela). */
  daysUntilBirthday?: number | null;
  audienceSegmentId?: string | null;
  audienceEligible?: boolean | null;
  audienceName?: string | null;
  audienceUnlockMessage?: string | null;
};

/** Snapshot completo: pools + campanhas elegíveis. */
export type WalletSnapshot = {
  pools: WalletPools;
  /** Política de validade da loja (null = não expira). */
  stampsExpireDays: number | null;
  pointsExpireDays: number | null;
  cashbackExpireDays: number | null;
  /** Maior % entre campanhas de cashback ativas (0 = nenhuma). */
  cashbackPercent: number;
  /** Lotes restantes no saldo (FIFO), com data de ganho e validade. */
  lots: WalletLot[];
  campaigns: CampaignWalletEntry[];
};

export type WalletLot = {
  unitKind: UnitKind;
  quantity: number;
  /** ISO datetime do ganho. */
  earnedAt: string;
  /** Data de validade (YYYY-MM-DD) ou null se não expira. */
  expiresAt: string | null;
  /** Dias restantes até expirar (0 = último dia). null se não expira. */
  daysLeft: number | null;
};

const LOYALTY_TYPES = ['stamps', 'spend'] as const;
const WALLET_CAMPAIGN_TYPES = ['stamps', 'spend', 'birthday', 'cashback'] as const;

/** Janela de resgate: dia do aniversário + 6 dias seguintes. */
export const BIRTHDAY_WINDOW_DAYS = 7;

function campaignUnitKind(type: string): UnitKind | null {
  if (type === 'spend') return 'points';
  if (type === 'stamps') return 'stamps';
  if (type === 'cashback') return 'cashback_cents';
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

type LedgerTx = {
  type: string;
  quantity: number;
  unitKind: string | null;
  campaignId: string | null;
  amountCents: number | null;
  createdAt: Date;
};

type Lot = {
  remaining: number;
  earnedAt: Date;
  expiresAt: Date | null;
};

/**
 * FIFO pool with optional TTL from earn date.
 * Redeems consume oldest non-expired lots first (as of redeem time).
 * With expireDays=N, units earned on day D remain valid through day D+N (UTC).
 */
export function poolLotsFifo(
  events: Array<{ kind: 'earn' | 'redeem'; quantity: number; at: Date }>,
  expireDays: number | null,
  now = new Date(),
): { balance: number; lots: Lot[] } {
  const lots: Lot[] = [];
  const sorted = [...events].sort((a, b) => a.at.getTime() - b.at.getTime());

  for (const event of sorted) {
    if (event.kind === 'earn') {
      const expiresAt =
        expireDays != null && expireDays > 0
          ? addUtcDays(utcDateOnly(event.at), expireDays)
          : null;
      lots.push({
        remaining: event.quantity,
        earnedAt: event.at,
        expiresAt,
      });
      continue;
    }

    let need = event.quantity;
    const redeemDay = utcDateOnly(event.at);
    for (const lot of lots) {
      if (need <= 0) break;
      if (lot.remaining <= 0) continue;
      if (lot.expiresAt && redeemDay > lot.expiresAt) continue;
      const take = Math.min(lot.remaining, need);
      lot.remaining -= take;
      need -= take;
    }
  }

  const today = utcDateOnly(now);
  const active: Lot[] = [];
  let balance = 0;
  for (const lot of lots) {
    if (lot.remaining <= 0) continue;
    if (lot.expiresAt && today > lot.expiresAt) continue;
    active.push(lot);
    balance += lot.remaining;
  }
  return { balance, lots: active };
}

/** @deprecated prefer poolLotsFifo — kept for callers that only need the number. */
export function poolBalanceFifo(
  events: Array<{ kind: 'earn' | 'redeem'; quantity: number; at: Date }>,
  expireDays: number | null,
  now = new Date(),
): number {
  return poolLotsFifo(events, expireDays, now).balance;
}

function lotDaysLeft(expiresAt: Date | null, now = new Date()): number | null {
  if (!expiresAt) return null;
  const today = utcDateOnly(now);
  return Math.max(
    0,
    Math.round((expiresAt.getTime() - today.getTime()) / 86_400_000),
  );
}

function toWalletLots(
  unitKind: UnitKind,
  lots: Lot[],
  now = new Date(),
): WalletLot[] {
  return lots.map((lot) => ({
    unitKind,
    quantity: lot.remaining,
    earnedAt: lot.earnedAt.toISOString(),
    expiresAt: lot.expiresAt
      ? lot.expiresAt.toISOString().slice(0, 10)
      : null,
    daysLeft: lotDaysLeft(lot.expiresAt, now),
  }));
}

/**
 * Derive wallet balances from the immutable transaction ledger.
 * Earns go to shared pools (stamps / points / cashback_cents); redeems consume
 * from the pool of the campaign's type (quantity × unitsNeeded), except
 * cashback apply which consumes `quantity` cents via unitKind.
 * Birthday gifts do not consume pools — once per calendar year in the window.
 * When the business sets expire days, unused units expire FIFO after that TTL.
 */
export async function deriveWallet(
  membershipId: string,
  businessId: string,
): Promise<WalletSnapshot> {
  const [campaigns, transactions, membership, business] = await Promise.all([
    prisma.campaign.findMany({
      where: {
        businessId,
        status: 'active',
        type: { in: [...WALLET_CAMPAIGN_TYPES] },
      },
      orderBy: { createdAt: 'asc' },
      select: {
        id: true,
        name: true,
        type: true,
        stampsNeeded: true,
        pointsPerReal: true,
        rewardTitle: true,
        rewardDescription: true,
        rewardImageUrl: true,
        audienceSegmentId: true,
        cashbackPercent: true,
      },
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
      orderBy: { createdAt: 'asc' },
    }),
    prisma.membership.findUnique({
      where: { id: membershipId },
      select: {
        customer: { select: { birthday: true } },
      },
    }),
    prisma.business.findUnique({
      where: { id: businessId },
      select: { stampsExpireDays: true, pointsExpireDays: true, cashbackExpireDays: true },
    }),
  ]);

  const birthday = membership?.customer.birthday ?? null;
  const stampsExpireDays = business?.stampsExpireDays ?? null;
  const pointsExpireDays = business?.pointsExpireDays ?? null;
  const cashbackExpireDays = business?.cashbackExpireDays ?? null;
  const cashbackPercent = Math.max(
    0,
    ...campaigns
      .filter((c) => c.type === 'cashback')
      .map((c) => c.cashbackPercent ?? 0),
  );

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

  const stampEvents: Array<{
    kind: 'earn' | 'redeem';
    quantity: number;
    at: Date;
  }> = [];
  const pointEvents: Array<{
    kind: 'earn' | 'redeem';
    quantity: number;
    at: Date;
  }> = [];
  const cashbackEvents: Array<{
    kind: 'earn' | 'redeem';
    quantity: number;
    at: Date;
  }> = [];

  for (const tx of transactions as LedgerTx[]) {
    if (tx.type === 'stamp') {
      const kind = resolveEarnUnitKind(tx, metaById);
      if (kind === 'points') {
        pointEvents.push({ kind: 'earn', quantity: tx.quantity, at: tx.createdAt });
      } else if (kind === 'cashback_cents') {
        cashbackEvents.push({ kind: 'earn', quantity: tx.quantity, at: tx.createdAt });
      } else if (kind === 'stamps') {
        stampEvents.push({ kind: 'earn', quantity: tx.quantity, at: tx.createdAt });
      }
      continue;
    }

    if (tx.type === 'redeem' && tx.unitKind === 'cashback_cents') {
      cashbackEvents.push({
        kind: 'redeem',
        quantity: tx.quantity,
        at: tx.createdAt,
      });
      continue;
    }

    if (tx.type === 'redeem' && tx.campaignId) {
      const campaign = metaById.get(tx.campaignId);
      if (!campaign) continue;
      const kind = campaignUnitKind(campaign.type);
      if (!kind) continue; // birthday / visits — sem consumo de pool
      if (kind === 'cashback_cents') {
        cashbackEvents.push({
          kind: 'redeem',
          quantity: tx.quantity,
          at: tx.createdAt,
        });
        continue;
      }
      const needed =
        campaign.stampsNeeded ?? (campaign.type === 'spend' ? 100 : 10);
      const cost = tx.quantity * needed;
      if (kind === 'points') {
        pointEvents.push({ kind: 'redeem', quantity: cost, at: tx.createdAt });
      } else {
        stampEvents.push({ kind: 'redeem', quantity: cost, at: tx.createdAt });
      }
    }
  }

  const stampPool = poolLotsFifo(stampEvents, stampsExpireDays);
  const pointPool = poolLotsFifo(pointEvents, pointsExpireDays);
  const cashbackPool = poolLotsFifo(cashbackEvents, cashbackExpireDays);

  const pools: WalletPools = {
    stamps: stampPool.balance,
    points: pointPool.balance,
    cashbackCents: cashbackPool.balance,
  };

  const lots: WalletLot[] = [
    ...toWalletLots('stamps', stampPool.lots),
    ...toWalletLots('points', pointPool.lots),
    ...toWalletLots('cashback_cents', cashbackPool.lots),
  ].sort((a, b) => {
    // Soonest expiry first; non-expiring last
    if (a.expiresAt == null && b.expiresAt == null) {
      return a.earnedAt.localeCompare(b.earnedAt);
    }
    if (a.expiresAt == null) return 1;
    if (b.expiresAt == null) return -1;
    return a.expiresAt.localeCompare(b.expiresAt);
  });

  const loyalty = campaigns.filter((c) =>
    (LOYALTY_TYPES as readonly string[]).includes(c.type),
  );
  const birthdayCampaigns = campaigns.filter((c) => c.type === 'birthday');
  const cashbackCampaigns = campaigns.filter((c) => c.type === 'cashback');

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
      audienceSegmentId: campaign.audienceSegmentId,
      audienceEligible: campaign.audienceSegmentId ? null : null,
      audienceName: null,
      audienceUnlockMessage: null,
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
      audienceSegmentId: campaign.audienceSegmentId,
      audienceEligible: null,
      audienceName: null,
      audienceUnlockMessage: null,
    });
  }

  for (const campaign of cashbackCampaigns) {
    entries.push({
      campaignId: campaign.id,
      campaignName: campaign.name,
      type: 'cashback',
      unitsNeeded: 0,
      stampsNeeded: 0,
      pointsPerReal: null,
      cashbackPercent: campaign.cashbackPercent ?? 0,
      cashbackBalanceCents: pools.cashbackCents,
      canRedeem: false,
      rewardsAvailable: 0,
      rewardTitle: campaign.rewardTitle,
      rewardDescription: campaign.rewardDescription,
      rewardImageUrl: campaign.rewardImageUrl,
      audienceSegmentId: campaign.audienceSegmentId,
      audienceEligible: null,
      audienceName: null,
      audienceUnlockMessage: null,
    });
  }

  return {
    pools,
    stampsExpireDays,
    pointsExpireDays,
    cashbackExpireDays,
    cashbackPercent,
    lots,
    campaigns: entries,
  };
}

/** Uma campanha elegível (maior %), cashback primeiro, travadas por último. */
export function presentCustomerCampaigns(
  campaigns: CampaignWalletEntry[],
): CampaignWalletEntry[] {
  const eligibleCashback = campaigns
    .filter((c) => c.type === 'cashback' && c.lockedReason !== 'audience')
    .sort((a, b) => (b.cashbackPercent ?? 0) - (a.cashbackPercent ?? 0));
  const winnerId = eligibleCashback[0]?.campaignId ?? null;

  const next = campaigns
    .filter((c) => {
      if (c.type !== 'cashback') return true;
      if (c.lockedReason === 'audience') return true;
      return winnerId != null && c.campaignId === winnerId;
    })
    .map((c) =>
      c.type === 'cashback' && c.lockedReason === 'audience'
        ? { ...c, cashbackBalanceCents: 0 }
        : c,
    );

  next.sort((a, b) => {
    const rank = (c: CampaignWalletEntry) => {
      if (c.type === 'cashback' && c.lockedReason !== 'audience') return 0;
      if (c.type !== 'cashback') return 1;
      return 2;
    };
    const ra = rank(a);
    const rb = rank(b);
    if (ra !== rb) return ra - rb;
    if (ra === 0) return (b.cashbackPercent ?? 0) - (a.cashbackPercent ?? 0);
    return 0;
  });
  return next;
}

function resolveEarnUnitKind(
  tx: {
    unitKind: string | null;
    amountCents: number | null;
    campaignId: string | null;
  },
  metaById: Map<string, CampaignMeta>,
): UnitKind | null {
  if (tx.unitKind === 'points' || tx.unitKind === 'stamps' || tx.unitKind === 'cashback_cents') {
    return tx.unitKind;
  }
  if (tx.campaignId) {
    const c = metaById.get(tx.campaignId);
    if (c) return campaignUnitKind(c.type);
  }
  if (tx.amountCents != null && tx.amountCents > 0) return 'points';
  return 'stamps';
}

/** Pontos a partir do valor em centavos. `reaisPerPoint` = reais para ganhar 1 pt. */
export function pointsFromAmountCents(
  amountCents: number,
  reaisPerPoint: number,
): number {
  if (amountCents <= 0 || reaisPerPoint <= 0) return 0;
  return Math.floor(amountCents / 100 / reaisPerPoint);
}

/** Cashback em centavos a partir do valor pago. */
export function cashbackCentsFromSale(
  paidCents: number,
  percent: number,
  maxCents?: number | null,
): number {
  if (paidCents <= 0 || percent <= 0) return 0;
  const raw = Math.floor((paidCents * percent) / 100);
  if (maxCents != null && maxCents > 0) return Math.min(raw, maxCents);
  return raw;
}
