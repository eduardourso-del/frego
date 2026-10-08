import { z } from 'zod';
import { prisma } from '@frego/db';
import {
  deriveWallet,
  isNearRewardCampaign,
  presentCustomerCampaigns,
  type CampaignWalletEntry,
  type WalletSnapshot,
} from './wallet.js';
import { foldCampaignReturn, type CampaignReturnCoverage, voucherBelongsToPeriod, voucherEventAt, voucherLookbackStart } from './campaign-return.js';
import { shouldOmitFromLedger } from './ledger-meta.js';
import { voucherFromMetadata } from './voucher.js';

function parseTagIds(value: unknown): unknown {
  if (value == null || value === '') return undefined;
  if (typeof value === 'string') {
    return value
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
  }
  return value;
}

/** Audience rules v1 — stored as Campaign/AudienceSegment.rules JSON. */
export const audienceRulesSchema = z.object({
  version: z.literal(1).default(1),
  spendCentsMin: z.number().int().nonnegative().nullable().optional(),
  spendCentsMax: z.number().int().nonnegative().nullable().optional(),
  /** null/undefined = lifetime spend & visits */
  windowDays: z.number().int().positive().max(3650).nullable().optional(),
  inactiveDaysMin: z.number().int().nonnegative().nullable().optional(),
  visitsMin: z.number().int().nonnegative().nullable().optional(),
  visitsMax: z.number().int().nonnegative().nullable().optional(),
  nearReward: z.boolean().nullable().optional(),
  isVip: z.boolean().nullable().optional(),
  /** Optional house tags — empty/omitted means no tag filter. */
  tagIds: z.preprocess(
    parseTagIds,
    z.array(z.string().min(1)).max(40).optional(),
  ),
  tagMatch: z.enum(['any', 'all']).optional(),
});

export type AudienceRules = z.infer<typeof audienceRulesSchema>;

export type MembershipAudienceStats = {
  membershipId: string;
  customerId: string;
  displayName: string | null;
  phoneE164: string;
  isVip: boolean;
  tagIds: string[];
  spendCents: number;
  visits: number;
  lastVisitAt: Date | null;
  nearReward: boolean;
  stampsEarned: number;
  pointsEarned: number;
  redeems: number;
};

function startOfDay(d: Date) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

function addDays(d: Date, n: number) {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  return x;
}

function dayKey(d: Date) {
  return d.toISOString().slice(0, 10);
}

export function parseAudienceRules(raw: unknown): AudienceRules {
  return audienceRulesSchema.parse(raw ?? { version: 1 });
}

export function evaluateAudience(
  stats: Pick<
    MembershipAudienceStats,
    'spendCents' | 'visits' | 'lastVisitAt' | 'isVip' | 'nearReward' | 'tagIds'
  >,
  rules: AudienceRules,
  now = new Date(),
): boolean {
  if (rules.spendCentsMin != null && stats.spendCents < rules.spendCentsMin) {
    return false;
  }
  if (rules.spendCentsMax != null && stats.spendCents > rules.spendCentsMax) {
    return false;
  }
  if (rules.visitsMin != null && stats.visits < rules.visitsMin) {
    return false;
  }
  if (rules.visitsMax != null && stats.visits > rules.visitsMax) {
    return false;
  }
  if (rules.isVip === true && !stats.isVip) return false;
  if (rules.isVip === false && stats.isVip) return false;
  if (rules.nearReward === true && !stats.nearReward) return false;
  if (rules.nearReward === false && stats.nearReward) return false;

  const requiredTags = rules.tagIds?.filter(Boolean) ?? [];
  if (requiredTags.length > 0) {
    const held = new Set(stats.tagIds ?? []);
    if (rules.tagMatch === 'all') {
      if (!requiredTags.every((id) => held.has(id))) return false;
    } else if (!requiredTags.some((id) => held.has(id))) {
      return false;
    }
  }

  if (rules.inactiveDaysMin != null) {
    if (!stats.lastVisitAt) {
      // Never visited — treat as infinitely inactive
      if (rules.inactiveDaysMin > 0) return true;
      return false;
    }
    const cutoff = addDays(startOfDay(now), -rules.inactiveDaysMin);
    if (stats.lastVisitAt > cutoff) return false;
  }

  return true;
}

export function rulesNeedNearReward(rules: AudienceRules): boolean {
  return rules.nearReward === true || rules.nearReward === false;
}

function windowFrom(rules: AudienceRules, now = new Date()): Date | null {
  if (rules.windowDays == null) return null;
  return addDays(startOfDay(now), -(rules.windowDays - 1));
}

type TxLite = {
  membershipId: string;
  type: string;
  quantity: number;
  unitKind: string | null;
  amountCents: number | null;
  createdAt: Date;
};

function aggregateFromTxs(
  membershipId: string,
  txs: TxLite[],
  from: Date | null,
) {
  const visitDays = new Set<string>();
  let spendCents = 0;
  let stampsEarned = 0;
  let pointsEarned = 0;
  let redeems = 0;
  let lastVisitAt: Date | null = null;

  for (const tx of txs) {
    if (tx.membershipId !== membershipId) continue;
    if (from && tx.createdAt < from) {
      // still track last visit for inactivity across lifetime
      continue;
    }
    if (!lastVisitAt || tx.createdAt > lastVisitAt) {
      lastVisitAt = tx.createdAt;
    }
    visitDays.add(dayKey(tx.createdAt));

    if (tx.unitKind === 'cashback_cents') {
      continue;
    }

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

  // Lifetime last visit (for inactivity) — scan all txs
  let lifetimeLast: Date | null = null;
  for (const tx of txs) {
    if (tx.membershipId !== membershipId) continue;
    if (!lifetimeLast || tx.createdAt > lifetimeLast) {
      lifetimeLast = tx.createdAt;
    }
  }

  return {
    spendCents,
    visits: visitDays.size,
    lastVisitAt: lifetimeLast,
    stampsEarned,
    pointsEarned,
    redeems,
  };
}

function isNearRewardFromCampaigns(
  campaigns: CampaignWalletEntry[],
  pools: { stamps: number; points: number },
): boolean {
  return campaigns.some((c) => isNearRewardCampaign(c, pools));
}

/**
 * Build audience stats for all memberships of a business.
 * When `nearReward` is needed, derives wallets (heavier).
 */
export async function loadMembershipAudienceStats(
  businessId: string,
  rules: AudienceRules,
  opts?: { membershipIds?: string[]; now?: Date },
): Promise<MembershipAudienceStats[]> {
  const now = opts?.now ?? new Date();
  const from = windowFrom(rules, now);
  const needNear = rulesNeedNearReward(rules);

  const requiredTags = rules.tagIds?.filter(Boolean) ?? [];
  let membershipIdFilter = opts?.membershipIds;
  const tagsByMember = new Map<string, string[]>();

  if (requiredTags.length > 0) {
    const taggedRows = await prisma.membershipTag.findMany({
      where: {
        tagId: { in: requiredTags },
        membership: { businessId },
        ...(opts?.membershipIds
          ? { membershipId: { in: opts.membershipIds } }
          : {}),
      },
      select: { membershipId: true, tagId: true },
    });
    const byMember = new Map<string, Set<string>>();
    for (const row of taggedRows) {
      const set = byMember.get(row.membershipId) ?? new Set<string>();
      set.add(row.tagId);
      byMember.set(row.membershipId, set);
      const list = tagsByMember.get(row.membershipId) ?? [];
      list.push(row.tagId);
      tagsByMember.set(row.membershipId, list);
    }
    const matchedIds: string[] = [];
    for (const [id, held] of byMember) {
      const ok =
        rules.tagMatch === 'all'
          ? requiredTags.every((tagId) => held.has(tagId))
          : requiredTags.some((tagId) => held.has(tagId));
      if (ok) matchedIds.push(id);
    }
    membershipIdFilter = matchedIds;
    if (membershipIdFilter.length === 0) return [];
  }

  const memberships = await prisma.membership.findMany({
    where: {
      businessId,
      ...(membershipIdFilter ? { id: { in: membershipIdFilter } } : {}),
    },
    select: {
      id: true,
      isVip: true,
      customer: {
        select: {
          id: true,
          displayName: true,
          phoneE164: true,
        },
      },
    },
  });

  if (memberships.length === 0) return [];

  const membershipIds = memberships.map((m) => m.id);
  const txs = await prisma.transaction.findMany({
    where: {
      businessId,
      membershipId: { in: membershipIds },
    },
    select: {
      membershipId: true,
      type: true,
      quantity: true,
      unitKind: true,
      amountCents: true,
      createdAt: true,
    },
  });

  let nearByMember = new Map<string, boolean>();
  if (needNear) {
    const wallets = await Promise.all(
      memberships.map(async (m) => {
        const wallet = await deriveWallet(m.id, businessId);
        return [m.id, isNearRewardFromCampaigns(wallet.campaigns, wallet.pools)] as const;
      }),
    );
    nearByMember = new Map(wallets);
  }

  return memberships.map((m) => {
    const agg = aggregateFromTxs(m.id, txs, from);
    return {
      membershipId: m.id,
      customerId: m.customer.id,
      displayName: m.customer.displayName,
      phoneE164: m.customer.phoneE164,
      isVip: m.isVip,
      tagIds: tagsByMember.get(m.id) ?? [],
      spendCents: agg.spendCents,
      visits: agg.visits,
      lastVisitAt: agg.lastVisitAt,
      nearReward: nearByMember.get(m.id) ?? false,
      stampsEarned: agg.stampsEarned,
      pointsEarned: agg.pointsEarned,
      redeems: agg.redeems,
    };
  });
}

export async function filterMembershipsByRules(
  businessId: string,
  rules: AudienceRules,
  opts?: { membershipIds?: string[]; now?: Date },
): Promise<MembershipAudienceStats[]> {
  const all = await loadMembershipAudienceStats(businessId, rules, opts);
  const now = opts?.now ?? new Date();
  return all.filter((s) => evaluateAudience(s, rules, now));
}

export async function countMembershipsByRules(
  businessId: string,
  rules: AudienceRules,
): Promise<number> {
  const matched = await filterMembershipsByRules(businessId, rules);
  return matched.length;
}

export async function membershipMatchesAudience(
  membershipId: string,
  businessId: string,
  rules: AudienceRules,
): Promise<boolean> {
  const stats = await loadMembershipAudienceStats(businessId, rules, {
    membershipIds: [membershipId],
  });
  const row = stats[0];
  if (!row) return false;
  return evaluateAudience(row, rules);
}

/** Preset audience definitions for Relatórios. */
export const AUDIENCE_PRESETS = [
  {
    key: 'high_value',
    name: 'Alto valor',
    description: 'Gastaram R$ 300 ou mais nos últimos 90 dias',
    rules: {
      version: 1 as const,
      spendCentsMin: 30_000,
      windowDays: 90,
    },
  },
  {
    key: 'at_risk',
    name: 'Em risco',
    description: 'Gastaram R$ 200 ou mais e estão sem visita há 30 dias ou mais',
    rules: {
      version: 1 as const,
      spendCentsMin: 20_000,
      inactiveDaysMin: 30,
      windowDays: 180,
    },
  },
  {
    key: 'near_reward',
    name: 'Quase prêmio',
    description: 'Chegaram a 80% ou mais da campanha principal',
    rules: {
      version: 1 as const,
      nearReward: true,
    },
  },
  {
    key: 'vip',
    name: 'VIP',
    description: 'Marcados manualmente como VIP',
    rules: {
      version: 1 as const,
      isVip: true,
    },
  },
] as const;

export const SPEND_TIERS = [
  { key: '0_100', label: 'Até R$ 100', min: 0, max: 10_000 },
  { key: '100_300', label: 'R$ 100–300', min: 10_000, max: 30_000 },
  { key: '300_800', label: 'R$ 300–800', min: 30_000, max: 80_000 },
  { key: '800_plus', label: 'R$ 800+', min: 80_000, max: null as number | null },
] as const;

export async function computeSpendTiers(
  businessId: string,
  windowDays = 90,
): Promise<
  Array<{
    key: string;
    label: string;
    min: number;
    max: number | null;
    count: number;
  }>
> {
  const rules: AudienceRules = { version: 1, windowDays };
  const stats = await loadMembershipAudienceStats(businessId, rules);
  return SPEND_TIERS.map((tier) => ({
    key: tier.key,
    label: tier.label,
    min: tier.min,
    max: tier.max,
    count: stats.filter((s) => {
      if (s.spendCents < tier.min) return false;
      if (tier.max != null && s.spendCents >= tier.max) return false;
      return true;
    }).length,
  }));
}

export type CampaignPerformance = {
  campaignId: string;
  eligible: number;
  redeemers: number;
  /** Resgates (voucher) ou usos no caixa (cashback) — sempre contagem de eventos. */
  redeems: number;
  fulfillPct: number;
  openVouchers: number;
  usedVouchers: number;
  expiredVouchers: number;
  revenueFromRedeemersCents: number;
  revenueCoverage: CampaignReturnCoverage;
  engagePct: number;
  cashbackSpentCents?: number;
  cashbackEarnedCents?: number;
  series: Array<{ date: string; redeems: number }>;
  sampleRedeemers: Array<{
    membershipId: string;
    displayName: string | null;
    phoneE164: string;
    redeems: number;
  }>;
};

export async function computeCampaignPerformance(
  businessId: string,
  campaignId: string,
  range: { from: Date; to: Date; days: number },
): Promise<CampaignPerformance | null> {
  const campaign = await prisma.campaign.findFirst({
    where: { id: campaignId, businessId },
    select: {
      id: true,
      type: true,
      audienceSegmentId: true,
      audienceSegment: { select: { rules: true } },
    },
  });
  if (!campaign) return null;
  const isCashback = campaign.type === 'cashback';

  let eligible = 0;
  if (campaign.audienceSegmentId && campaign.audienceSegment) {
    const rules = parseAudienceRules(campaign.audienceSegment.rules);
    eligible = await countMembershipsByRules(businessId, rules);
  } else {
    const active = await prisma.transaction.findMany({
      where: {
        businessId,
        createdAt: { gte: range.from, lt: range.to },
      },
      select: { membershipId: true },
      distinct: ['membershipId'],
    });
    eligible = active.length;
  }

  const campaignTxs = (
    await prisma.transaction.findMany({
      where: {
        businessId,
        campaignId,
        createdAt: { gte: voucherLookbackStart(range.from), lt: range.to },
        ...(isCashback
          ? { unitKind: 'cashback_cents' }
          : { type: 'redeem' }),
      },
      select: {
        type: true,
        membershipId: true,
        quantity: true,
        metadata: true,
        createdAt: true,
        amountCents: true,
        unitKind: true,
        membership: {
          select: {
            customer: { select: { displayName: true, phoneE164: true } },
          },
        },
      },
    })
  ).filter((tx) => !shouldOmitFromLedger(tx.metadata));

  const redeemTxs = (isCashback
    ? campaignTxs.filter((tx) => tx.type === 'redeem')
    : campaignTxs
  ).filter((tx) =>
    isCashback
      ? tx.createdAt >= range.from && tx.createdAt < range.to
      : voucherBelongsToPeriod(tx, { from: range.from, to: range.to }),
  );
  const earnTxs = isCashback
    ? campaignTxs.filter(
        (tx) =>
          tx.type !== 'redeem' &&
          tx.createdAt >= range.from &&
          tx.createdAt < range.to,
      )
    : [];

  const redeemerMap = new Map<
    string,
    { displayName: string | null; phoneE164: string; redeems: number }
  >();
  let redeems = 0;
  let openVouchers = 0;
  let usedVouchers = 0;
  let expiredVouchers = 0;
  let cashbackSpentCents = 0;
  let cashbackEarnedCents = 0;

  for (const tx of redeemTxs) {
    const eventCount = isCashback ? 1 : tx.quantity;
    redeems += eventCount;
    if (isCashback) cashbackSpentCents += tx.quantity;
    const prev = redeemerMap.get(tx.membershipId);
    if (prev) {
      prev.redeems += eventCount;
    } else {
      redeemerMap.set(tx.membershipId, {
        displayName: tx.membership.customer.displayName,
        phoneE164: tx.membership.customer.phoneE164,
        redeems: eventCount,
      });
    }
    if (isCashback) continue;
    const voucher = voucherFromMetadata(tx.metadata, {
      createdAt: tx.createdAt,
    });
    if (!voucher) continue;
    if (voucher.status === 'used') usedVouchers += 1;
    else if (voucher.status === 'expired') expiredVouchers += 1;
    else openVouchers += 1;
  }

  for (const tx of earnTxs) {
    cashbackEarnedCents += tx.quantity;
  }

  const earners = new Set(earnTxs.map((tx) => tx.membershipId));
  const redeemers = isCashback
    ? (earners.size > 0 ? earners.size : redeemerMap.size)
    : redeemerMap.size;
  const voucherTotal = openVouchers + usedVouchers + expiredVouchers;
  const fulfillPct = isCashback
    ? cashbackEarnedCents === 0
      ? 0
      : Math.min(100, Math.round((cashbackSpentCents / cashbackEarnedCents) * 100))
    : voucherTotal === 0
      ? 0
      : Math.round((usedVouchers / voucherTotal) * 100);
  const engagePct =
    eligible === 0 ? 0 : Math.round((redeemers / eligible) * 100);

  const campaignReturn = foldCampaignReturn(redeemTxs, {
    isCashback,
    range: { from: range.from, to: range.to },
  });
  const revenueFromRedeemersCents = campaignReturn.revenueCents;

  const seriesSource = isCashback ? redeemTxs : redeemTxs;
  const series = Array.from({ length: range.days }, (_, i) => {
    const day = addDays(startOfDay(range.from), i);
    const key = dayKey(day);
    let dayRedeems = 0;
    for (const tx of seriesSource) {
      if (dayKey(voucherEventAt(tx)) !== key) continue;
      dayRedeems += isCashback ? 1 : tx.quantity;
    }
    return { date: key, redeems: dayRedeems };
  });

  const sampleRedeemers = [...redeemerMap.entries()]
    .map(([membershipId, v]) => ({
      membershipId,
      displayName: v.displayName,
      phoneE164: v.phoneE164,
      redeems: v.redeems,
    }))
    .sort((a, b) => b.redeems - a.redeems)
    .slice(0, 8);

  return {
    campaignId,
    eligible,
    redeemers,
    redeems,
    fulfillPct,
    openVouchers,
    usedVouchers,
    expiredVouchers,
    revenueFromRedeemersCents,
    revenueCoverage: campaignReturn.coverage,
    engagePct,
    ...(isCashback ? { cashbackSpentCents, cashbackEarnedCents } : {}),
    series,
    sampleRedeemers,
  };
}

export function queryRulesFromParams(query: Record<string, string | undefined>): AudienceRules | null {
  const hasAny =
    query.spendCentsMin != null ||
    query.spendCentsMax != null ||
    query.windowDays != null ||
    query.inactiveDaysMin != null ||
    query.visitsMin != null ||
    query.visitsMax != null ||
    query.nearReward != null ||
    query.isVip != null ||
    (query.tagIds != null && query.tagIds !== '');
  if (!hasAny) return null;

  const num = (v: string | undefined) => {
    if (v == null || v === '') return null;
    const n = Number.parseInt(v, 10);
    return Number.isFinite(n) ? n : null;
  };
  const bool = (v: string | undefined) => {
    if (v == null || v === '') return null;
    if (v === '1' || v === 'true') return true;
    if (v === '0' || v === 'false') return false;
    return null;
  };

  return parseAudienceRules({
    version: 1,
    spendCentsMin: num(query.spendCentsMin),
    spendCentsMax: num(query.spendCentsMax),
    windowDays: num(query.windowDays),
    inactiveDaysMin: num(query.inactiveDaysMin),
    visitsMin: num(query.visitsMin),
    visitsMax: num(query.visitsMax),
    nearReward: bool(query.nearReward),
    isVip: bool(query.isVip),
    tagIds: query.tagIds,
    tagMatch: query.tagMatch === 'all' ? 'all' : query.tagMatch === 'any' ? 'any' : undefined,
  });
}

export type AudienceBadge = {
  id: string;
  name: string;
  badgeTitle: string;
  badgeMessage: string | null;
  unlockedCampaignCount: number;
};

/** Internal segment labels → customer-facing copy (never show ops names in-app). */
const INTERNAL_BADGE_TITLES: Record<string, string> = {
  'alto valor': 'Cliente da casa',
  'em risco': 'De volta à casa',
  'quase prêmio': 'Quase lá',
  'quase premio': 'Quase lá',
  vip: 'VIP da casa',
};

const DEFAULT_BADGE_TITLE = 'Cliente da casa';
const DEFAULT_BADGE_MESSAGE =
  'A loja reconhece você — desbloqueamos condições especiais para quem volta e faz parte da casa.';

export function customerFacingBadgeTitle(
  badgeTitle: string | null | undefined,
  segmentName?: string | null,
): string {
  const raw = (badgeTitle?.trim() || segmentName?.trim() || '').toLowerCase();
  if (!raw) return DEFAULT_BADGE_TITLE;
  if (INTERNAL_BADGE_TITLES[raw]) return INTERNAL_BADGE_TITLES[raw];
  // If title equals a known internal preset name, replace it
  const fromName = INTERNAL_BADGE_TITLES[(segmentName ?? '').trim().toLowerCase()];
  if (badgeTitle?.trim() && INTERNAL_BADGE_TITLES[badgeTitle.trim().toLowerCase()]) {
    return INTERNAL_BADGE_TITLES[badgeTitle.trim().toLowerCase()]!;
  }
  if (
    badgeTitle?.trim() &&
    fromName &&
    badgeTitle.trim().toLowerCase() === (segmentName ?? '').trim().toLowerCase()
  ) {
    return fromName;
  }
  return badgeTitle?.trim() || fromName || DEFAULT_BADGE_TITLE;
}

export function customerFacingBadgeMessage(
  badgeMessage: string | null | undefined,
): string {
  const msg = badgeMessage?.trim();
  if (!msg) return DEFAULT_BADGE_MESSAGE;
  return msg;
}

/**
 * Resolve customer-facing badges + campaign audience eligibility for a membership.
 * Call after deriveWallet (does not nest into deriveWallet enrichment).
 */
export async function resolveMembershipRecognition(
  membershipId: string,
  businessId: string,
  wallet: WalletSnapshot,
): Promise<{
  badges: AudienceBadge[];
  campaigns: CampaignWalletEntry[];
}> {
  const segmentIds = [
    ...new Set(
      wallet.campaigns
        .map((c) => c.audienceSegmentId)
        .filter((id): id is string => Boolean(id)),
    ),
  ];

  const segments = await prisma.audienceSegment.findMany({
    where: {
      businessId,
      OR: [
        { showBadge: true },
        ...(segmentIds.length > 0 ? [{ id: { in: segmentIds } }] : []),
      ],
    },
    select: {
      id: true,
      name: true,
      rules: true,
      showBadge: true,
      badgeTitle: true,
      badgeMessage: true,
    },
  });

  if (segments.length === 0) {
    return {
      badges: [],
      campaigns: presentCustomerCampaigns(
        wallet.campaigns.map((c) => ({
          ...c,
          audienceEligible: c.audienceSegmentId ? false : null,
          ...(c.audienceSegmentId
            ? {
                canRedeem: false,
                rewardsAvailable: 0,
                lockedReason: 'audience' as const,
              }
            : {}),
        })),
      ),
    };
  }

  const matchById = new Map<string, boolean>();
  for (const seg of segments) {
    const rules = parseAudienceRules(seg.rules);
    const ok = await membershipMatchesAudience(
      membershipId,
      businessId,
      rules,
    );
    matchById.set(seg.id, ok);
  }

  const segById = new Map(segments.map((s) => [s.id, s]));

  const campaigns = wallet.campaigns.map((c) => {
    if (!c.audienceSegmentId) {
      return {
        ...c,
        audienceEligible: null,
        audienceName: null,
        audienceUnlockMessage: null,
      };
    }
    const seg = segById.get(c.audienceSegmentId);
    const eligible = matchById.get(c.audienceSegmentId) ?? false;
    const title = customerFacingBadgeTitle(seg?.badgeTitle, seg?.name);
    if (!eligible) {
      return {
        ...c,
        canRedeem: false,
        rewardsAvailable: 0,
        lockedReason: 'audience' as const,
        audienceEligible: false,
        audienceName: seg?.name ?? null,
        audienceUnlockMessage: null,
      };
    }
    return {
      ...c,
      audienceEligible: true,
      audienceName: seg?.name ?? null,
      audienceUnlockMessage:
        c.type === 'cashback'
          ? `${title} — cashback no caixa`
          : c.type === 'promo'
            ? c.canRedeem
              ? `Conquista liberada · ${title}`
              : `${title} — disponível nas regras da promoção`
            : c.lockedReason === 'quota_exhausted'
              ? `${title} — resgate liberado no próximo período`
              : c.canRedeem
                ? `Conquista liberada · ${title}`
                : `${title} — continue acumulando para o prêmio exclusivo`,
    };
  });

  const unlockedBySeg = new Map<string, number>();
  for (const c of campaigns) {
    if (c.audienceSegmentId && c.audienceEligible) {
      unlockedBySeg.set(
        c.audienceSegmentId,
        (unlockedBySeg.get(c.audienceSegmentId) ?? 0) + 1,
      );
    }
  }

  const badges: AudienceBadge[] = [];
  for (const seg of segments) {
    if (!seg.showBadge) continue;
    if (!matchById.get(seg.id)) continue;
    badges.push({
      id: seg.id,
      name: seg.name,
      badgeTitle: customerFacingBadgeTitle(seg.badgeTitle, seg.name),
      badgeMessage: customerFacingBadgeMessage(seg.badgeMessage),
      unlockedCampaignCount: unlockedBySeg.get(seg.id) ?? 0,
    });
  }

  return { badges, campaigns: presentCustomerCampaigns(campaigns) };
}

