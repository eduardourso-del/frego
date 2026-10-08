import { prisma } from '@frego/db';
import { shouldOmitFromLedger } from './ledger-meta.js';
import {
  civilYmd,
  evaluatePromoEntitlement,
  evaluateRedeemQuota,
  normalizeWeekdays,
} from './promo.js';
import {
  buildStampDestinations,
  isCartelaCampaign,
  type StampDestination,
} from './stamp-destination.js';

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

export type PromoLockedReason =
  | 'outside_dates'
  | 'wrong_weekday'
  | 'open_voucher'
  | 'quota_exhausted'
  | 'audience';

export type CampaignLockedReason = BirthdayLockedReason | PromoLockedReason;

export type CampaignWalletEntry = {
  campaignId: string;
  campaignName: string;
  type: 'stamps' | 'spend' | 'visits' | 'birthday' | 'cashback' | 'promo';
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
  /** Só em campanhas de aniversário / Promoção / audiência. */
  lockedReason?: CampaignLockedReason | null;
  /** Próxima data de desbloqueio (ISO date). */
  unlocksAt?: string | null;
  /** Dias até o aniversário (0 se na janela). */
  daysUntilBirthday?: number | null;
  /** Promoção: civil YYYY-MM-DD in America/Sao_Paulo. */
  startsOn?: string | null;
  endsOn?: string | null;
  weekdays?: number[];
  redeemMax?: number | null;
  redeemPeriod?: string | null;
  audienceSegmentId?: string | null;
  audienceEligible?: boolean | null;
  audienceName?: string | null;
  audienceUnlockMessage?: string | null;
  /** Units this Campanha spends. Shared stamp Campanhas share one balance. */
  balance: number;
  /** Stamp Campanha whose carimbos do not join the shared pile. */
  cartela: boolean;
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
  /** Shared pile and each active Cartela. One row keeps a single carimbo total. */
  stampDestinations: StampDestination[];
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
  /** Cartela name, or Carimbos / the single shared Campanha. Null for points and cashback. */
  destinationLabel: string | null;
};

const LOYALTY_TYPES = ['stamps', 'spend'] as const;
const WALLET_CAMPAIGN_TYPES = [
  'stamps',
  'spend',
  'birthday',
  'cashback',
  'promo',
] as const;

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
  cartela: boolean;
  name: string;
};

export function campaignSpendableUnits(
  campaign: { type: string; cartela?: boolean; balance?: number },
  pools: { stamps: number; points: number },
): number {
  if (campaign.type === 'spend') return pools.points;
  if (campaign.type !== 'stamps') return 0;
  if (campaign.cartela) return campaign.balance ?? 0;
  return pools.stamps;
}

/** Perto do prêmio: 80% of the way on the balance that Campanha spends. */
export function isNearRewardCampaign(
  campaign: {
    type: string;
    unitsNeeded: number;
    cartela?: boolean;
    balance?: number;
  },
  pools: { stamps: number; points: number },
): boolean {
  if (campaign.type !== 'stamps' && campaign.type !== 'spend') return false;
  if (campaign.unitsNeeded <= 0) return false;
  const current = campaignSpendableUnits(campaign, pools);
  const inCycle = current % campaign.unitsNeeded;
  const progress =
    inCycle === 0 && current > 0 ? 1 : inCycle / campaign.unitsNeeded;
  return progress >= 0.8 || current >= campaign.unitsNeeded;
}

export type { CampaignMeta as CampaignKindMeta };

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
  id?: string;
  type: string;
  quantity: number;
  unitKind: string | null;
  campaignId: string | null;
  amountCents: number | null;
  createdAt: Date;
  metadata?: unknown;
};

export type PoolEvent = {
  kind: 'earn' | 'redeem';
  quantity: number;
  at: Date;
  id?: string;
};

type Lot = {
  remaining: number;
  earnedAt: Date;
  expiresAt: Date | null;
  sourceId?: string;
  originalQuantity: number;
};

/**
 * FIFO pool with optional TTL from earn date.
 * Redeems consume oldest non-expired lots first (as of redeem time).
 * With expireDays=N, units earned on day D remain valid through day D+N (UTC).
 */
export function poolLotsFifo(
  events: Array<PoolEvent>,
  expireDays: number | null,
  now = new Date(),
): { balance: number; lots: Lot[]; expiredLots: Lot[] } {
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
        sourceId: event.id,
        originalQuantity: event.quantity,
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
  const expiredLots: Lot[] = [];
  let balance = 0;
  for (const lot of lots) {
    if (lot.remaining <= 0) continue;
    if (lot.expiresAt && today > lot.expiresAt) {
      expiredLots.push(lot);
      continue;
    }
    active.push(lot);
    balance += lot.remaining;
  }
  return { balance, lots: active, expiredLots };
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
  destinationLabel: string | null,
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
    destinationLabel,
  }));
}

/**
 * Derive wallet balances from the immutable transaction ledger.
 * Earns go to shared pools (stamps / points / cashback_cents); redeems consume
 * from the pool of the campaign's type (quantity × unitsNeeded), except
 * cashback apply which consumes `quantity` cents via unitKind.
 * Birthday gifts and Promoção do not consume pools.
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
        cartela: true,
        stampsNeeded: true,
        pointsPerReal: true,
        rewardTitle: true,
        rewardDescription: true,
        rewardImageUrl: true,
        audienceSegmentId: true,
        cashbackPercent: true,
        startsOn: true,
        endsOn: true,
        weekdays: true,
        redeemMax: true,
        redeemPeriod: true,
      },
    }),
    prisma.transaction.findMany({
      where: { membershipId, businessId },
      select: {
        id: true,
        type: true,
        quantity: true,
        unitKind: true,
        campaignId: true,
        amountCents: true,
        createdAt: true,
        metadata: true,
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
      name: c.name,
      type: c.type,
      stampsNeeded: c.stampsNeeded,
      cartela: c.cartela,
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
      select: { id: true, name: true, type: true, cartela: true, stampsNeeded: true },
    });
    for (const c of extra) metaById.set(c.id, c);
  }

  const {
    stamps: stampEvents,
    points: pointEvents,
    cashback: cashbackEvents,
    cartelas: cartelaEvents,
  } = ledgerPoolEvents(transactions as LedgerTx[], metaById);

  const stampPool = poolLotsFifo(stampEvents, stampsExpireDays);
  const pointPool = poolLotsFifo(pointEvents, pointsExpireDays);
  const cashbackPool = poolLotsFifo(cashbackEvents, cashbackExpireDays);
  const cartelaPools = new Map<
    string,
    { balance: number; lots: Lot[] }
  >();
  for (const [campaignId, events] of cartelaEvents) {
    const pooled = poolLotsFifo(events, stampsExpireDays);
    cartelaPools.set(campaignId, {
      balance: pooled.balance,
      lots: pooled.lots,
    });
  }

  const pools: WalletPools = {
    stamps: stampPool.balance,
    points: pointPool.balance,
    cashbackCents: cashbackPool.balance,
  };

  const sharedLabel =
    campaigns.filter(
      (c) =>
        (c.type === 'stamps' || c.type === 'visits') && !c.cartela,
    ).length === 1
      ? campaigns.find(
          (c) =>
            (c.type === 'stamps' || c.type === 'visits') && !c.cartela,
        )!.name
      : 'Carimbos';

  const lots: WalletLot[] = [
    ...toWalletLots('stamps', stampPool.lots, sharedLabel),
    ...[...cartelaPools.entries()].flatMap(([campaignId, pooled]) =>
      toWalletLots(
        'stamps',
        pooled.lots,
        metaById.get(campaignId)?.name ?? 'Cartela',
      ),
    ),
    ...toWalletLots('points', pointPool.lots, null),
    ...toWalletLots('cashback_cents', cashbackPool.lots, null),
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
  const promoCampaigns = campaigns.filter((c) => c.type === 'promo');

  const entries: CampaignWalletEntry[] = loyalty.map((campaign) => {
    const needed =
      campaign.stampsNeeded ?? (campaign.type === 'spend' ? 100 : 10);
    const kind = campaignUnitKind(campaign.type) ?? 'stamps';
    const cartela = isCartelaCampaign(campaign);
    const balance = cartela
      ? (cartelaPools.get(campaign.id)?.balance ?? 0)
      : kind === 'points'
        ? pools.points
        : pools.stamps;
    const poolRewards = Math.floor(balance / needed);
    const quota =
      campaign.type === 'stamps'
        ? evaluateRedeemQuota(
            campaign,
            transactions.filter(
              (tx) =>
                tx.type === 'redeem' &&
                tx.campaignId === campaign.id &&
                !shouldOmitFromLedger(tx.metadata),
            ),
          )
        : null;
    const rewardsAvailable =
      quota?.limited === true
        ? Math.min(poolRewards, quota.remaining ?? 0)
        : poolRewards;
    const quotaBlocked = quota?.exhausted === true && poolRewards >= 1;
    return {
      campaignId: campaign.id,
      campaignName: campaign.name,
      type: campaign.type,
      unitsNeeded: needed,
      stampsNeeded: needed,
      pointsPerReal: campaign.pointsPerReal,
      canRedeem: rewardsAvailable >= 1 && !quotaBlocked,
      rewardsAvailable: quotaBlocked ? 0 : rewardsAvailable,
      rewardTitle: campaign.rewardTitle,
      rewardDescription: campaign.rewardDescription,
      rewardImageUrl: campaign.rewardImageUrl,
      lockedReason: quotaBlocked ? 'quota_exhausted' : null,
      unlocksAt: quotaBlocked ? quota?.unlocksAt ?? null : null,
      redeemMax: campaign.type === 'stamps' ? campaign.redeemMax : undefined,
      redeemPeriod: campaign.type === 'stamps' ? campaign.redeemPeriod : undefined,
      audienceSegmentId: campaign.audienceSegmentId,
      audienceEligible: campaign.audienceSegmentId ? null : null,
      audienceName: null,
      audienceUnlockMessage: null,
      balance,
      cartela,
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
      balance: 0,
      cartela: false,
    });
  }

  for (const campaign of promoCampaigns) {
    const entitlement = evaluatePromoEntitlement(
      campaign,
      transactions.filter(
        (tx) => tx.type === 'redeem' && tx.campaignId === campaign.id,
      ),
    );
    entries.push({
      campaignId: campaign.id,
      campaignName: campaign.name,
      type: 'promo',
      unitsNeeded: 1,
      stampsNeeded: 1,
      pointsPerReal: null,
      canRedeem: entitlement.canRedeem,
      rewardsAvailable: entitlement.rewardsAvailable,
      rewardTitle: campaign.rewardTitle,
      rewardDescription: campaign.rewardDescription,
      rewardImageUrl: campaign.rewardImageUrl,
      lockedReason: entitlement.lockedReason,
      unlocksAt: entitlement.unlocksAt,
      startsOn: civilYmd(campaign.startsOn),
      endsOn: civilYmd(campaign.endsOn),
      weekdays: normalizeWeekdays(campaign.weekdays),
      redeemMax: campaign.redeemMax,
      redeemPeriod: campaign.redeemPeriod,
      audienceSegmentId: campaign.audienceSegmentId,
      audienceEligible: null,
      audienceName: null,
      audienceUnlockMessage: null,
      balance: 0,
      cartela: false,
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
      balance: 0,
      cartela: false,
    });
  }

  const activeShared = campaigns
    .filter((c) => c.type === 'stamps' && !c.cartela)
    .map((c) => ({ id: c.id, name: c.name }));
  const activeCartelas = campaigns
    .filter((c) => isCartelaCampaign(c))
    .map((c) => ({
      id: c.id,
      name: c.name,
      balance: cartelaPools.get(c.id)?.balance ?? 0,
    }));

  return {
    pools,
    stampsExpireDays,
    pointsExpireDays,
    cashbackExpireDays,
    cashbackPercent,
    lots,
    campaigns: entries,
    stampDestinations: buildStampDestinations({
      sharedBalance: pools.stamps,
      activeShared,
      activeCartelas,
    }),
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

export function ledgerPoolEvents(
  transactions: LedgerTx[],
  metaById: Map<string, CampaignMeta>,
): {
  stamps: PoolEvent[];
  points: PoolEvent[];
  cashback: PoolEvent[];
  cartelas: Map<string, PoolEvent[]>;
} {
  const stamps: PoolEvent[] = [];
  const points: PoolEvent[] = [];
  const cashback: PoolEvent[] = [];
  const cartelas = new Map<string, PoolEvent[]>();

  const pushCartela = (campaignId: string, event: PoolEvent) => {
    const list = cartelas.get(campaignId) ?? [];
    list.push(event);
    cartelas.set(campaignId, list);
  };

  for (const tx of transactions) {
    if (shouldOmitFromLedger(tx.metadata)) continue;

    if (tx.type === 'stamp') {
      const kind = resolveEarnUnitKind(tx, metaById);
      const event: PoolEvent = {
        kind: 'earn',
        quantity: tx.quantity,
        at: tx.createdAt,
        id: tx.id,
      };
      if (kind === 'points') points.push(event);
      else if (kind === 'cashback_cents') cashback.push(event);
      else if (kind === 'stamps') {
        const campaign = tx.campaignId
          ? metaById.get(tx.campaignId)
          : undefined;
        if (campaign && isCartelaCampaign(campaign)) {
          pushCartela(campaign.id, event);
        } else {
          stamps.push(event);
        }
      }
      continue;
    }

    if (tx.type === 'redeem' && tx.unitKind === 'cashback_cents') {
      cashback.push({
        kind: 'redeem',
        quantity: tx.quantity,
        at: tx.createdAt,
        id: tx.id,
      });
      continue;
    }

    if (tx.type === 'redeem' && tx.campaignId) {
      const campaign = metaById.get(tx.campaignId);
      if (!campaign) continue;
      const kind = campaignUnitKind(campaign.type);
      if (!kind) continue;
      if (kind === 'cashback_cents') {
        cashback.push({
          kind: 'redeem',
          quantity: tx.quantity,
          at: tx.createdAt,
          id: tx.id,
        });
        continue;
      }
      const needed =
        campaign.stampsNeeded ?? (campaign.type === 'spend' ? 100 : 10);
      const cost = tx.quantity * needed;
      const event: PoolEvent = {
        kind: 'redeem',
        quantity: cost,
        at: tx.createdAt,
        id: tx.id,
      };
      if (kind === 'points') points.push(event);
      else if (isCartelaCampaign(campaign)) pushCartela(campaign.id, event);
      else stamps.push(event);
    }
  }

  return { stamps, points, cashback, cartelas };
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
