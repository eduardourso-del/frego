import type { FastifyPluginAsync } from 'fastify';
import { prisma } from '@frego/db';
import { requireAuth } from '../plugins/auth.js';
import {
  AUDIENCE_PRESETS,
  computeSpendTiers,
  countMembershipsByRules,
  parseAudienceRules,
} from '../lib/audience.js';
import { voucherFromMetadata } from '../lib/voucher.js';
import { isCashbackUnit } from '../lib/customer-stats.js';
import { shouldOmitFromLedger } from '../lib/ledger-meta.js';
import {
  addDays,
  periodQuerySchema,
  resolvePeriod,
  startOfDay,
} from '../lib/period.js';

function dayKey(d: Date) {
  return d.toISOString().slice(0, 10);
}

function monthKey(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

const MONTH_SHORT = [
  'Jan',
  'Fev',
  'Mar',
  'Abr',
  'Mai',
  'Jun',
  'Jul',
  'Ago',
  'Set',
  'Out',
  'Nov',
  'Dez',
] as const;

function deltaPct(current: number, previous: number): number | null {
  if (previous === 0) return current === 0 ? 0 : null;
  return Math.round(((current - previous) / previous) * 100);
}

function initialsOf(name: string) {
  return name
    .split(/\s+/)
    .map((p) => p[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();
}

type TxLite = {
  type: string;
  quantity: number;
  membershipId: string;
  locationId: string;
  campaignId: string | null;
  actorTeamMemberId: string | null;
  createdAt: Date;
  amountCents: number | null;
  unitKind: string | null;
  metadata?: unknown;
};

function isPointsEarn(tx: TxLite) {
  if (isCashbackUnit(tx.unitKind)) return false;
  return (
    tx.type !== 'redeem' &&
    (tx.unitKind === 'points' || (tx.amountCents != null && tx.amountCents > 0))
  );
}

function summarize(txs: TxLite[]) {
  const activeMembers = new Set<string>();
  const visitDaysByMember = new Map<string, Set<string>>();
  let stamps = 0;
  let points = 0;
  let redeems = 0;
  let revenueCents = 0;
  const redeemers = new Set<string>();

  for (const tx of txs) {
    if (shouldOmitFromLedger(tx.metadata)) continue;
    activeMembers.add(tx.membershipId);
    let days = visitDaysByMember.get(tx.membershipId);
    if (!days) {
      days = new Set();
      visitDaysByMember.set(tx.membershipId, days);
    }
    days.add(dayKey(tx.createdAt));

    if (isCashbackUnit(tx.unitKind)) {
      continue;
    }
    if (tx.type === 'redeem') {
      redeems += tx.quantity;
      redeemers.add(tx.membershipId);
    } else if (isPointsEarn(tx)) {
      points += tx.quantity;
      if (tx.amountCents) revenueCents += tx.amountCents;
    } else {
      stamps += tx.quantity;
    }
  }

  let returning = 0;
  let totalVisitDays = 0;
  for (const days of visitDaysByMember.values()) {
    totalVisitDays += days.size;
    if (days.size >= 2) returning += 1;
  }

  const customers = activeMembers.size;
  const avgVisits =
    customers === 0
      ? 0
      : Math.round((totalVisitDays / customers) * 10) / 10;
  const repeatRate =
    customers === 0 ? 0 : Math.round((returning / customers) * 100);

  return {
    customers,
    stamps,
    points,
    redeems,
    revenueCents,
    returning,
    redeemers: redeemers.size,
    avgVisits,
    repeatRate,
    activeMembers,
  };
}

export const reportsRoutes: FastifyPluginAsync = async (app) => {
  app.get('/reports', async (request) => {
    const auth = requireAuth(request);
    const query = periodQuerySchema.parse(request.query);
    const { key: range, from, toExclusive, prevFrom, prevTo, days } =
      resolvePeriod(query, { '7d': 7, '30d': 30, '90d': 90 }, '30d');
    const inactiveCutoff = addDays(startOfDay(new Date()), -29);

    const txSelect = {
      type: true,
      quantity: true,
      membershipId: true,
      locationId: true,
      campaignId: true,
      actorTeamMemberId: true,
      createdAt: true,
      amountCents: true,
      unitKind: true,
      metadata: true,
    } as const;

    const [
      currentTxs,
      previousTxs,
      locations,
      teamMembers,
      campaigns,
      totalMembers,
      memberships,
      activeIn30d,
      savedAudiences,
    ] = await Promise.all([
      prisma.transaction.findMany({
        where: {
          businessId: auth.businessId,
          createdAt: { gte: from, lt: toExclusive },
        },
        select: txSelect,
      }),
      prisma.transaction.findMany({
        where: {
          businessId: auth.businessId,
          createdAt: { gte: prevFrom, lt: prevTo },
        },
        select: txSelect,
      }),
      prisma.location.findMany({
        where: { businessId: auth.businessId },
        select: { id: true, name: true },
        orderBy: { name: 'asc' },
      }),
      prisma.teamMember.findMany({
        where: { businessId: auth.businessId, status: 'active' },
        select: { id: true, displayName: true, email: true },
      }),
      prisma.campaign.findMany({
        where: {
          businessId: auth.businessId,
          status: { in: ['active', 'paused', 'archived'] },
        },
        select: {
          id: true,
          name: true,
          type: true,
          status: true,
          rewardTitle: true,
          audienceSegmentId: true,
          audienceSegment: { select: { id: true, name: true, rules: true } },
        },
        orderBy: { createdAt: 'desc' },
      }),
      prisma.membership.count({ where: { businessId: auth.businessId } }),
      prisma.membership.findMany({
        where: { businessId: auth.businessId },
        select: { id: true, associatedAt: true },
      }),
      prisma.transaction.findMany({
        where: {
          businessId: auth.businessId,
          createdAt: { gte: inactiveCutoff },
        },
        select: { membershipId: true },
        distinct: ['membershipId'],
      }),
      prisma.audienceSegment.findMany({
        where: { businessId: auth.businessId },
        orderBy: { createdAt: 'desc' },
        take: 20,
      }),
    ]);

    const current = summarize(currentTxs);
    const previous = summarize(previousTxs);
    const active30dCount = activeIn30d.length;
    const inactive30d = Math.max(0, totalMembers - active30dCount);

    const series = Array.from({ length: days }, (_, i) => {
      const day = addDays(startOfDay(from), i);
      const key = dayKey(day);
      let stamps = 0;
      let points = 0;
      let redeems = 0;
      const customers = new Set<string>();
      for (const tx of currentTxs) {
        if (shouldOmitFromLedger(tx.metadata)) continue;
        if (dayKey(tx.createdAt) !== key) continue;
        customers.add(tx.membershipId);
        if (tx.type === 'redeem') redeems += tx.quantity;
        else if (isPointsEarn(tx)) points += tx.quantity;
        else stamps += tx.quantity;
      }
      return {
        date: key,
        label:
          days <= 7
            ? ['D', 'S', 'T', 'Q', 'Q', 'S', 'S'][day.getDay()]
            : `${day.getDate()}/${day.getMonth() + 1}`,
        stamps,
        points,
        redeems,
        customers: customers.size,
      };
    });

    const locStats = new Map<
      string,
      { visits: number; stamps: number; points: number; redeems: number }
    >();
    for (const loc of locations) {
      locStats.set(loc.id, { visits: 0, stamps: 0, points: 0, redeems: 0 });
    }
    const locVisitDays = new Map<string, Set<string>>();
    for (const tx of currentTxs) {
      if (shouldOmitFromLedger(tx.metadata)) continue;
      let stats = locStats.get(tx.locationId);
      if (!stats) {
        stats = { visits: 0, stamps: 0, points: 0, redeems: 0 };
        locStats.set(tx.locationId, stats);
      }
      const visitKey = `${tx.locationId}:${dayKey(tx.createdAt)}:${tx.membershipId}`;
      let visits = locVisitDays.get(tx.locationId);
      if (!visits) {
        visits = new Set();
        locVisitDays.set(tx.locationId, visits);
      }
      visits.add(visitKey);

      if (tx.type === 'redeem') stats.redeems += tx.quantity;
      else if (isPointsEarn(tx)) stats.points += tx.quantity;
      else stats.stamps += tx.quantity;
    }
    for (const [id, visits] of locVisitDays) {
      const stats = locStats.get(id);
      if (stats) stats.visits = visits.size;
    }
    const maxLocVisits = Math.max(
      1,
      ...[...locStats.values()].map((s) => s.visits),
    );
    const locationsRanking = locations
      .map((loc) => {
        const s = locStats.get(loc.id) ?? {
          visits: 0,
          stamps: 0,
          points: 0,
          redeems: 0,
        };
        return {
          id: loc.id,
          name: loc.name,
          visits: s.visits,
          stamps: s.stamps,
          points: s.points,
          redeems: s.redeems,
          sharePct: Math.round((s.visits / maxLocVisits) * 100),
        };
      })
      .sort((a, b) => b.visits - a.visits || b.stamps - a.stamps);

    const teamStats = new Map<
      string,
      { stamps: number; points: number; redeems: number }
    >();
    for (const tx of currentTxs) {
      if (shouldOmitFromLedger(tx.metadata)) continue;
      if (!tx.actorTeamMemberId) continue;
      let s = teamStats.get(tx.actorTeamMemberId);
      if (!s) {
        s = { stamps: 0, points: 0, redeems: 0 };
        teamStats.set(tx.actorTeamMemberId, s);
      }
      if (tx.type === 'redeem') s.redeems += tx.quantity;
      else if (isPointsEarn(tx)) s.points += tx.quantity;
      else s.stamps += tx.quantity;
    }
    const teamRanking = teamMembers
      .map((m) => {
        const s = teamStats.get(m.id) ?? {
          stamps: 0,
          points: 0,
          redeems: 0,
        };
        const name =
          m.displayName?.trim() ||
          m.email?.split('@')[0] ||
          'Colaborador';
        return {
          id: m.id,
          displayName: name,
          initials: initialsOf(name),
          stamps: s.stamps,
          points: s.points,
          redeems: s.redeems,
          activity: s.stamps + s.points + s.redeems,
        };
      })
      .filter((m) => m.activity > 0)
      .sort((a, b) => b.activity - a.activity)
      .slice(0, 10);

    const campaignRedeemers = new Map<string, Set<string>>();
    const campaignRedeems = new Map<string, number>();
    const campaignVoucher = new Map<
      string,
      { open: number; used: number; expired: number }
    >();
    const memberSpend = new Map<string, number>();

    for (const tx of currentTxs) {
      if (shouldOmitFromLedger(tx.metadata)) continue;
      if (tx.type === 'redeem' && tx.campaignId) {
        const cashback = isCashbackUnit(tx.unitKind);
        campaignRedeems.set(
          tx.campaignId,
          (campaignRedeems.get(tx.campaignId) ?? 0) + (cashback ? 1 : tx.quantity),
        );
        let set = campaignRedeemers.get(tx.campaignId);
        if (!set) {
          set = new Set();
          campaignRedeemers.set(tx.campaignId, set);
        }
        set.add(tx.membershipId);

        if (!cashback) {
          let v = campaignVoucher.get(tx.campaignId);
          if (!v) {
            v = { open: 0, used: 0, expired: 0 };
            campaignVoucher.set(tx.campaignId, v);
          }
          const voucher = voucherFromMetadata(tx.metadata, {
            createdAt: tx.createdAt,
          });
          if (voucher?.status === 'used') v.used += 1;
          else if (voucher?.status === 'expired') v.expired += 1;
          else if (voucher) v.open += 1;
        }
      }
      if (isPointsEarn(tx) && tx.amountCents) {
        memberSpend.set(
          tx.membershipId,
          (memberSpend.get(tx.membershipId) ?? 0) + tx.amountCents,
        );
      }
    }

    const campaignsRanking = (
      await Promise.all(
        campaigns.map(async (c) => {
          const redeems = campaignRedeems.get(c.id) ?? 0;
          const redeemers = campaignRedeemers.get(c.id)?.size ?? 0;
          const vouchers = campaignVoucher.get(c.id) ?? {
            open: 0,
            used: 0,
            expired: 0,
          };
          const voucherTotal = vouchers.open + vouchers.used + vouchers.expired;
          const fulfillPct =
            voucherTotal === 0
              ? 0
              : Math.round((vouchers.used / voucherTotal) * 100);

          let eligible = current.customers;
          if (c.audienceSegment) {
            eligible = await countMembershipsByRules(
              auth.businessId,
              parseAudienceRules(c.audienceSegment.rules),
            );
          }
          const engagePct =
            eligible === 0 ? 0 : Math.round((redeemers / eligible) * 100);

          let revenueFromRedeemersCents = 0;
          for (const mid of campaignRedeemers.get(c.id) ?? []) {
            revenueFromRedeemersCents += memberSpend.get(mid) ?? 0;
          }

          return {
            id: c.id,
            name: c.name,
            type: c.type,
            status: c.status,
            rewardTitle: c.rewardTitle,
            audienceSegmentId: c.audienceSegmentId,
            audienceName: c.audienceSegment?.name ?? null,
            redeems,
            redeemers,
            eligible,
            engagePct,
            fulfillPct,
            openVouchers: vouchers.open,
            usedVouchers: vouchers.used,
            expiredVouchers: vouchers.expired,
            revenueFromRedeemersCents,
          };
        }),
      )
    )
      .filter((c) => c.redeems > 0 || c.status === 'active')
      .sort(
        (a, b) =>
          b.redeems - a.redeems ||
          b.fulfillPct - a.fulfillPct ||
          b.engagePct - a.engagePct,
      )
      .slice(0, 12);

    const now = new Date();
    const cohortMonths: Array<{ key: string; label: string; from: Date }> = [];
    for (let i = 4; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      cohortMonths.push({
        key: monthKey(d),
        label: MONTH_SHORT[d.getMonth()],
        from: d,
      });
    }

    const membersActiveInPeriod = current.activeMembers;
    const cohorts = cohortMonths.map((m, idx) => {
      const next = cohortMonths[idx + 1]?.from ?? addDays(now, 1);
      const cohortMembers = memberships.filter(
        (mem) => mem.associatedAt >= m.from && mem.associatedAt < next,
      );
      const size = cohortMembers.length;
      const retained = cohortMembers.filter((mem) =>
        membersActiveInPeriod.has(mem.id),
      ).length;
      const rate = size === 0 ? 0 : Math.round((retained / size) * 100);
      return {
        month: m.key,
        label: m.label,
        size,
        retained,
        rate,
      };
    });

    const presetAudiences = await Promise.all(
      AUDIENCE_PRESETS.map(async (p) => {
        const memberCount = await countMembershipsByRules(
          auth.businessId,
          p.rules,
        );
        return {
          key: p.key,
          name: p.name,
          description: p.description,
          rules: p.rules,
          memberCount,
        };
      }),
    );
    const spendTiers = await computeSpendTiers(auth.businessId, 90);
    const atRisk = presetAudiences.find((p) => p.key === 'at_risk');

    const saved = await Promise.all(
      savedAudiences.map(async (s) => {
        const rules = parseAudienceRules(s.rules);
        const memberCount = await countMembershipsByRules(
          auth.businessId,
          rules,
        );
        return {
          id: s.id,
          name: s.name,
          rules,
          memberCount,
          createdAt: s.createdAt,
        };
      }),
    );

    return {
      range,
      from: from.toISOString(),
      to: toExclusive.toISOString(),
      kpis: {
        activeCustomers: {
          value: current.customers,
          ofBasePct:
            totalMembers === 0
              ? 0
              : Math.round((current.customers / totalMembers) * 100),
          deltaPct: deltaPct(current.customers, previous.customers),
        },
        inactive: {
          value: inactive30d,
          ofBasePct:
            totalMembers === 0
              ? 0
              : Math.round((inactive30d / totalMembers) * 100),
        },
        avgVisits: {
          value: current.avgVisits,
          delta:
            Math.round((current.avgVisits - previous.avgVisits) * 10) / 10,
        },
        redeems: {
          value: current.redeems,
          deltaPct: deltaPct(current.redeems, previous.redeems),
        },
        stamps: {
          value: current.stamps,
          deltaPct: deltaPct(current.stamps, previous.stamps),
        },
        points: {
          value: current.points,
          deltaPct: deltaPct(current.points, previous.points),
        },
        revenueCents: {
          value: current.revenueCents,
          deltaPct: deltaPct(current.revenueCents, previous.revenueCents),
        },
        repeatRate: {
          value: current.repeatRate,
          deltaPct: deltaPct(current.repeatRate, previous.repeatRate),
        },
        base: totalMembers,
      },
      series,
      cohorts,
      locations: locationsRanking,
      team: teamRanking,
      campaigns: campaignsRanking,
      audiences: {
        presets: presetAudiences,
        spendTiers,
        saved,
        insight: atRisk
          ? {
              title: `Alto valor em risco: ${atRisk.memberCount}`,
              body:
                atRisk.memberCount > 0
                  ? `${atRisk.memberCount} clientes gastaram bem e estão sem visita há 30 dias ou mais. Crie uma campanha só para eles.`
                  : 'Nenhum cliente de alto valor inativo no momento — continue acompanhando.',
              rules: atRisk.rules,
              memberCount: atRisk.memberCount,
            }
          : null,
      },
    };
  });
};
