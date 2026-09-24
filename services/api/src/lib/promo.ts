import { voucherFromMetadata } from './voucher.js';

export const PROMO_TZ = 'America/Sao_Paulo';

export const PROMO_PERIODS = [
  'day',
  'week',
  'month',
  'year',
  'campaign',
] as const;

export type PromoPeriod = (typeof PROMO_PERIODS)[number];

export type PromoLockedReason =
  | 'outside_dates'
  | 'wrong_weekday'
  | 'open_voucher'
  | 'quota_exhausted';

export type PromoCampaignInput = {
  startsOn: Date | string | null | undefined;
  endsOn: Date | string | null | undefined;
  weekdays: number[] | null | undefined;
  redeemMax: number | null | undefined;
  redeemPeriod: PromoPeriod | string | null | undefined;
};

export type PromoRedemption = {
  createdAt: Date;
  metadata?: unknown;
};

export type PromoEntitlement = {
  canRedeem: boolean;
  rewardsAvailable: number;
  lockedReason: PromoLockedReason | null;
  unlocksAt: string | null;
  redeemedInPeriod: number;
};

const ymdFmt = new Intl.DateTimeFormat('en-CA', {
  timeZone: PROMO_TZ,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});

export function civilYmd(value: Date | string | null | undefined): string | null {
  if (value == null) return null;
  if (typeof value === 'string') {
    const s = value.trim();
    return s.length >= 10 ? s.slice(0, 10) : null;
  }
  if (Number.isNaN(value.getTime())) return null;
  return value.toISOString().slice(0, 10);
}

export function ymdInSaoPaulo(at: Date): string {
  return ymdFmt.format(at);
}

export function weekdayFromYmd(ymd: string): number {
  return new Date(`${ymd}T00:00:00.000Z`).getUTCDay();
}

export function addCivilDays(ymd: string, days: number): string {
  const [y, m, d] = ymd.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d + days)).toISOString().slice(0, 10);
}

/** Monday of the ISO-style week that contains `ymd` (Mon–Sun). */
export function startOfWeekMonday(ymd: string): string {
  const dow = weekdayFromYmd(ymd);
  const daysFromMonday = (dow + 6) % 7;
  return addCivilDays(ymd, -daysFromMonday);
}

export function normalizeWeekdays(raw: number[] | null | undefined): number[] {
  const unique = [...new Set((raw ?? []).filter((n) => n >= 0 && n <= 6))];
  unique.sort((a, b) => a - b);
  return unique;
}

function nextMonthStart(ymd: string): string {
  const [y, m] = ymd.split('-').map(Number);
  if (m === 12) return `${y + 1}-01-01`;
  return `${y}-${String(m + 1).padStart(2, '0')}-01`;
}

export function nextPeriodStart(
  period: PromoPeriod,
  todayYmd: string,
): string | null {
  switch (period) {
    case 'day':
      return addCivilDays(todayYmd, 1);
    case 'week':
      return addCivilDays(startOfWeekMonday(todayYmd), 7);
    case 'month':
      return nextMonthStart(todayYmd);
    case 'year':
      return `${Number(todayYmd.slice(0, 4)) + 1}-01-01`;
    case 'campaign':
      return null;
  }
}

export function redemptionInPeriod(
  createdAt: Date,
  period: PromoPeriod,
  now: Date,
): boolean {
  if (period === 'campaign') return true;
  const txYmd = ymdInSaoPaulo(createdAt);
  const today = ymdInSaoPaulo(now);
  switch (period) {
    case 'day':
      return txYmd === today;
    case 'week':
      return startOfWeekMonday(txYmd) === startOfWeekMonday(today);
    case 'month':
      return txYmd.slice(0, 7) === today.slice(0, 7);
    case 'year':
      return txYmd.slice(0, 4) === today.slice(0, 4);
  }
}

function nextAllowedWeekday(
  fromYmd: string,
  allowed: number[],
  endsOn: string | null,
): string | null {
  for (let i = 0; i < 14; i += 1) {
    const d = addCivilDays(fromYmd, i);
    if (endsOn && d > endsOn) return null;
    if (allowed.includes(weekdayFromYmd(d))) return d;
  }
  return null;
}

function asPeriod(raw: string | null | undefined): PromoPeriod | null {
  if (!raw) return null;
  return (PROMO_PERIODS as readonly string[]).includes(raw)
    ? (raw as PromoPeriod)
    : null;
}

export type RedeemQuota = {
  limited: boolean;
  redeemedInPeriod: number;
  /** Null when the Campanha does not cap Resgatar. */
  remaining: number | null;
  exhausted: boolean;
  unlocksAt: string | null;
};

/** How many Resgates fit in the current period. Counts quantity, skips nothing itself. */
export function evaluateRedeemQuota(
  campaign: {
    redeemMax: number | null | undefined;
    redeemPeriod: PromoPeriod | string | null | undefined;
  },
  redemptions: { createdAt: Date; quantity?: number }[],
  now = new Date(),
): RedeemQuota {
  const redeemMax =
    campaign.redeemMax == null || campaign.redeemMax < 1
      ? null
      : campaign.redeemMax;
  const period = asPeriod(campaign.redeemPeriod ?? null);
  if (redeemMax == null || period == null) {
    return {
      limited: false,
      redeemedInPeriod: 0,
      remaining: null,
      exhausted: false,
      unlocksAt: null,
    };
  }

  const redeemedInPeriod = redemptions
    .filter((tx) => redemptionInPeriod(tx.createdAt, period, now))
    .reduce((sum, tx) => sum + Math.max(1, tx.quantity ?? 1), 0);
  const remaining = Math.max(0, redeemMax - redeemedInPeriod);
  const exhausted = remaining <= 0;
  return {
    limited: true,
    redeemedInPeriod,
    remaining,
    exhausted,
    unlocksAt: exhausted ? nextPeriodStart(period, ymdInSaoPaulo(now)) : null,
  };
}

export function hasOpenPromoVoucher(
  redemptions: PromoRedemption[],
  now: Date,
): boolean {
  return redemptions.some((tx) => {
    const voucher = voucherFromMetadata(tx.metadata, {
      createdAt: tx.createdAt,
      now,
    });
    return voucher?.status === 'open';
  });
}

export function evaluatePromoEntitlement(
  campaign: PromoCampaignInput,
  redemptions: PromoRedemption[],
  now = new Date(),
): PromoEntitlement {
  const today = ymdInSaoPaulo(now);
  const startsOn = civilYmd(campaign.startsOn);
  const endsOn = civilYmd(campaign.endsOn);
  const weekdays = normalizeWeekdays(campaign.weekdays);
  const allowed = weekdays.length > 0 ? weekdays : [0, 1, 2, 3, 4, 5, 6];
  const redeemMax =
    campaign.redeemMax == null || campaign.redeemMax < 1
      ? null
      : campaign.redeemMax;
  const period = asPeriod(campaign.redeemPeriod ?? null) ?? 'campaign';

  const none: PromoEntitlement = {
    canRedeem: false,
    rewardsAvailable: 0,
    lockedReason: null,
    unlocksAt: null,
    redeemedInPeriod: 0,
  };

  if (startsOn && today < startsOn) {
    return { ...none, lockedReason: 'outside_dates', unlocksAt: startsOn };
  }
  if (endsOn && today > endsOn) {
    return { ...none, lockedReason: 'outside_dates' };
  }

  const dow = weekdayFromYmd(today);
  if (!allowed.includes(dow)) {
    return {
      ...none,
      lockedReason: 'wrong_weekday',
      unlocksAt: nextAllowedWeekday(addCivilDays(today, 1), allowed, endsOn),
    };
  }

  if (hasOpenPromoVoucher(redemptions, now)) {
    return { ...none, lockedReason: 'open_voucher' };
  }

  const inPeriod =
    redeemMax == null
      ? []
      : redemptions.filter((tx) => redemptionInPeriod(tx.createdAt, period, now));
  const redeemedInPeriod = redeemMax == null ? 0 : inPeriod.length;

  if (redeemMax != null && redeemedInPeriod >= redeemMax) {
    return {
      ...none,
      lockedReason: 'quota_exhausted',
      unlocksAt: nextPeriodStart(period, today),
      redeemedInPeriod,
    };
  }

  return {
    canRedeem: true,
    rewardsAvailable: 1,
    lockedReason: null,
    unlocksAt: null,
    redeemedInPeriod,
  };
}
