import { randomBytes } from 'node:crypto';
import { prisma, type Prisma } from '@frego/db';
import { DEFAULT_FUSO } from './br-fuso.js';
import { openClube } from './open-clube.js';
import {
  nextPeriodStart,
  startOfWeekMonday,
  type PromoPeriod,
} from './promo.js';
import { ymdInTimeZone } from './zoned-day.js';

export type CheckInPeriod = PromoPeriod;

const PERIODS = new Set<string>(['day', 'week', 'month', 'year', 'campaign']);

export function asCheckInPeriod(value: string | null | undefined): CheckInPeriod | null {
  if (!value || !PERIODS.has(value)) return null;
  return value as CheckInPeriod;
}

export function newCheckInToken() {
  return randomBytes(18).toString('base64url');
}

export function checkInPublicUrl(token: string) {
  const raw = process.env.PESQUISA_PUBLIC_ORIGIN ?? 'https://frego.app.br';
  const origin = /^https?:\/\//i.test(raw) ? raw : 'https://frego.app.br';
  return `${origin.replace(/\/$/, '')}/c/${token}`;
}

/** A periodic cap always has a later period. "Nesta campanha" does not. */
export function laterResgatePossible(input: {
  redeemMax: number | null | undefined;
  redeemPeriod: string | null | undefined;
  redeemedInCampaign: number;
}): boolean {
  const max =
    input.redeemMax == null || input.redeemMax < 1 ? null : input.redeemMax;
  const period = asCheckInPeriod(input.redeemPeriod);
  if (max == null || period == null) return true;
  if (period === 'campaign') return input.redeemedInCampaign < max;
  return true;
}

function ymdIn(at: Date, timeZone: string) {
  return ymdInTimeZone(at, timeZone);
}

export function redemptionInFusoPeriod(
  createdAt: Date,
  period: CheckInPeriod,
  now: Date,
  timeZone: string,
): boolean {
  if (period === 'campaign') return true;
  const txYmd = ymdIn(createdAt, timeZone);
  const today = ymdIn(now, timeZone);
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

export function evaluateCheckInQuota(
  campaign: {
    redeemMax: number | null | undefined;
    redeemPeriod: string | null | undefined;
  },
  redemptions: { createdAt: Date; quantity?: number }[],
  timeZone: string,
  now = new Date(),
) {
  const max =
    campaign.redeemMax == null || campaign.redeemMax < 1
      ? null
      : campaign.redeemMax;
  const period = asCheckInPeriod(campaign.redeemPeriod);
  if (max == null || period == null) {
    return {
      limited: false,
      remaining: null as number | null,
      exhausted: false,
      unlocksAt: null as string | null,
      redeemedInCampaign: redemptions.reduce(
        (sum, tx) => sum + Math.max(1, tx.quantity ?? 1),
        0,
      ),
    };
  }
  const redeemedInCampaign = redemptions.reduce(
    (sum, tx) => sum + Math.max(1, tx.quantity ?? 1),
    0,
  );
  const redeemedInPeriod = redemptions
    .filter((tx) => redemptionInFusoPeriod(tx.createdAt, period, now, timeZone))
    .reduce((sum, tx) => sum + Math.max(1, tx.quantity ?? 1), 0);
  const remaining = Math.max(0, max - redeemedInPeriod);
  const today = ymdIn(now, timeZone);
  return {
    limited: true,
    remaining,
    exhausted: remaining <= 0,
    unlocksAt: remaining <= 0 ? nextPeriodStart(period, today) : null,
    redeemedInCampaign,
  };
}

export function checkInRewards(counted: number, needed: number, quotaRemaining: number | null) {
  const sets = Math.floor(Math.max(0, counted) / Math.max(1, needed));
  if (quotaRemaining == null) return sets;
  return Math.min(sets, Math.max(0, quotaRemaining));
}

type RedeemTx = {
  type: string;
  campaignId: string | null;
  quantity: number;
  createdAt: Date;
  metadata?: unknown;
};

export function checkInRedeemTxs(transactions: RedeemTx[], campaignId: string) {
  return transactions.filter(
    (tx) => tx.type === 'redeem' && tx.campaignId === campaignId,
  );
}

export async function countedByCampaign(
  membershipId: string,
  campaignIds: string[],
) {
  const map = new Map<string, number>();
  if (campaignIds.length === 0) return map;
  const rows = await prisma.checkIn.groupBy({
    by: ['campaignId'],
    where: {
      membershipId,
      campaignId: { in: campaignIds },
      status: 'counted',
    },
    _count: { _all: true },
  });
  for (const row of rows) map.set(row.campaignId, row._count._all);
  return map;
}

export async function endOpenCheckIns(
  db: Prisma.TransactionClient | typeof prisma,
  campaignId: string,
) {
  await db.checkIn.updateMany({
    where: {
      campaignId,
      status: { in: ['counted', 'removed'] },
    },
    data: { status: 'ended' },
  });
}

export async function consumeCountedCheckIns(
  db: Prisma.TransactionClient,
  input: { campaignId: string; membershipId: string; count: number },
) {
  if (input.count < 1) return false;
  const rows = await db.checkIn.findMany({
    where: {
      campaignId: input.campaignId,
      membershipId: input.membershipId,
      status: 'counted',
    },
    orderBy: [{ civilDate: 'asc' }, { createdAt: 'asc' }],
    take: input.count,
    select: { id: true },
  });
  if (rows.length < input.count) return false;
  const updated = await db.checkIn.updateMany({
    where: { id: { in: rows.map((row) => row.id) }, status: 'counted' },
    data: { status: 'consumed' },
  });
  return updated.count === input.count;
}

export type RecordCheckInResult =
  | {
      ok: true;
      created: boolean;
      alreadyToday: boolean;
      openedClube: boolean;
      counted: number;
      needed: number;
      civilDate: string;
      campaignId: string;
      membershipId: string;
      businessId: string;
      businessName: string;
      rewardTitle: string | null;
      campaignName: string;
    }
  | {
      ok: false;
      error:
        | 'NOT_FOUND'
        | 'CHECKIN_CLOSED'
        | 'CHECKIN_CAP'
        | 'NO_PHONE';
      status?: string;
    };

export async function recordCheckIn(input: {
  token: string;
  customerId: string;
  now?: Date;
}): Promise<RecordCheckInResult> {
  const now = input.now ?? new Date();
  const campaign = await prisma.campaign.findUnique({
    where: { checkInToken: input.token },
    select: {
      id: true,
      name: true,
      type: true,
      status: true,
      stampsNeeded: true,
      rewardTitle: true,
      redeemMax: true,
      redeemPeriod: true,
      businessId: true,
      business: { select: { name: true, timeZone: true } },
    },
  });
  if (!campaign || campaign.type !== 'checkin') {
    return { ok: false, error: 'NOT_FOUND' };
  }
  if (campaign.status !== 'active') {
    return { ok: false, error: 'CHECKIN_CLOSED', status: campaign.status };
  }

  const customer = await prisma.customer.findUnique({
    where: { id: input.customerId },
    select: { phoneE164: true },
  });
  if (!customer?.phoneE164) return { ok: false, error: 'NO_PHONE' };

  const opened = await openClube({
    businessId: campaign.businessId,
    phone: customer.phoneE164,
  });
  const membershipId = opened.membership.id;
  const timeZone = campaign.business.timeZone ?? DEFAULT_FUSO;
  const civilDate = ymdIn(now, timeZone);
  const needed = campaign.stampsNeeded ?? 1;

  const redeems = await prisma.transaction.findMany({
    where: {
      membershipId,
      campaignId: campaign.id,
      type: 'redeem',
    },
    select: { quantity: true },
  });
  const redeemedInCampaign = redeems.reduce(
    (sum, tx) => sum + Math.max(1, tx.quantity),
    0,
  );
  if (
    !laterResgatePossible({
      redeemMax: campaign.redeemMax,
      redeemPeriod: campaign.redeemPeriod,
      redeemedInCampaign,
    })
  ) {
    return { ok: false, error: 'CHECKIN_CAP' };
  }

  const openToday = await prisma.checkIn.findFirst({
    where: {
      campaignId: campaign.id,
      membershipId,
      civilDate,
      status: { not: 'ended' },
    },
    select: { id: true },
  });

  let created = false;
  if (!openToday) {
    try {
      await prisma.checkIn.create({
        data: {
          businessId: campaign.businessId,
          campaignId: campaign.id,
          membershipId,
          civilDate,
          status: 'counted',
        },
      });
      created = true;
    } catch (err) {
      const code = (err as { code?: string }).code;
      if (code !== 'P2002') throw err;
    }
  }

  const counted = await prisma.checkIn.count({
    where: { campaignId: campaign.id, membershipId, status: 'counted' },
  });

  return {
    ok: true,
    created,
    alreadyToday: !created,
    openedClube: opened.created,
    counted,
    needed,
    civilDate,
    campaignId: campaign.id,
    membershipId,
    businessId: campaign.businessId,
    businessName: campaign.business.name,
    rewardTitle: campaign.rewardTitle,
    campaignName: campaign.name,
  };
}

export async function removeOneCheckIn(input: {
  businessId: string;
  campaignId: string;
  membershipId: string;
}) {
  const row = await prisma.checkIn.findFirst({
    where: {
      businessId: input.businessId,
      campaignId: input.campaignId,
      membershipId: input.membershipId,
      status: 'counted',
    },
    orderBy: [{ civilDate: 'desc' }, { createdAt: 'desc' }],
    select: { id: true },
  });
  if (!row) return null;
  await prisma.checkIn.update({
    where: { id: row.id },
    data: { status: 'removed' },
  });
  const counted = await prisma.checkIn.count({
    where: {
      campaignId: input.campaignId,
      membershipId: input.membershipId,
      status: 'counted',
    },
  });
  return { counted };
}

export async function rotateCheckInToken(campaignId: string) {
  const token = newCheckInToken();
  await prisma.campaign.update({
    where: { id: campaignId },
    data: { checkInToken: token },
  });
  return { token, url: checkInPublicUrl(token) };
}

export async function publicCheckIn(token: string) {
  const campaign = await prisma.campaign.findUnique({
    where: { checkInToken: token },
    select: {
      id: true,
      name: true,
      type: true,
      status: true,
      stampsNeeded: true,
      rewardTitle: true,
      rewardDescription: true,
      rewardImageUrl: true,
      business: {
        select: {
          name: true,
          logoUrl: true,
          primaryColor: true,
          slug: true,
        },
      },
    },
  });
  if (!campaign || campaign.type !== 'checkin') return null;
  return {
    campaignId: campaign.id,
    name: campaign.name,
    status: campaign.status,
    stampsNeeded: campaign.stampsNeeded ?? 1,
    rewardTitle: campaign.rewardTitle,
    rewardDescription: campaign.rewardDescription,
    rewardImageUrl: campaign.rewardImageUrl,
    businessName: campaign.business.name,
    logoUrl: campaign.business.logoUrl,
    primaryColor: campaign.business.primaryColor,
    slug: campaign.business.slug,
    url: checkInPublicUrl(token),
    appUrl: `frego://c/${token}`,
  };
}

export type CheckInStatRow = {
  campaignId: string;
  membershipId: string;
  status: string;
  civilDate: string;
};

/** Standing Check-ins in a period. A removed row was undone and does not count. */
export function foldCheckIns(rows: CheckInStatRow[]) {
  const byCampaign = new Map<
    string,
    { checkIns: number; people: Set<string> }
  >();
  const byDay = new Map<string, number>();
  const people = new Set<string>();
  let checkIns = 0;
  for (const row of rows) {
    if (row.status === 'removed') continue;
    checkIns += 1;
    people.add(row.membershipId);
    let bucket = byCampaign.get(row.campaignId);
    if (!bucket) {
      bucket = { checkIns: 0, people: new Set() };
      byCampaign.set(row.campaignId, bucket);
    }
    bucket.checkIns += 1;
    bucket.people.add(row.membershipId);
    byDay.set(row.civilDate, (byDay.get(row.civilDate) ?? 0) + 1);
  }
  return { checkIns, customers: people.size, byCampaign, byDay };
}
