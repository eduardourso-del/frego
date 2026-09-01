import type { FastifyPluginAsync } from 'fastify';
import { prisma } from '@frego/db';
import { requireAuth } from '../plugins/auth.js';
import {
  AUDIENCE_PRESETS,
  countMembershipsByRules,
} from '../lib/audience.js';
import { voucherFromMetadata } from '../lib/voucher.js';
import { isCashbackUnit } from '../lib/customer-stats.js';
import {
  addDays,
  periodQuerySchema,
  resolvePeriod,
  startOfDay,
} from '../lib/period.js';

function deltaPct(current: number, previous: number): number | null {
  if (previous === 0) return current === 0 ? 0 : null;
  return Math.round(((current - previous) / previous) * 100);
}

function dayKey(d: Date) {
  return d.toISOString().slice(0, 10);
}

const WEEKDAY_LABELS = ['D', 'S', 'T', 'Q', 'Q', 'S', 'S'] as const;

type TxRow = {
  type: string;
  quantity: number;
  membershipId: string;
  createdAt: Date;
  amountCents: number | null;
  unitKind: string | null;
};

type MemberAgg = {
  membershipId: string;
  visitDays: Set<string>;
  stamps: number;
  points: number;
  spendCents: number;
  redeems: number;
  lastVisitAt: Date;
};

function buildMemberAggs(txs: TxRow[]) {
  const map = new Map<string, MemberAgg>();
  for (const tx of txs) {
    let agg = map.get(tx.membershipId);
    if (!agg) {
      agg = {
        membershipId: tx.membershipId,
        visitDays: new Set(),
        stamps: 0,
        points: 0,
        spendCents: 0,
        redeems: 0,
        lastVisitAt: tx.createdAt,
      };
      map.set(tx.membershipId, agg);
    }
    agg.visitDays.add(dayKey(tx.createdAt));
    if (tx.createdAt > agg.lastVisitAt) agg.lastVisitAt = tx.createdAt;

    if (isCashbackUnit(tx.unitKind)) {
      continue;
    }

    if (tx.type === 'redeem') {
      agg.redeems += tx.quantity;
    } else {
      const kind =
        tx.unitKind === 'points' || (tx.amountCents != null && tx.amountCents > 0)
          ? 'points'
          : 'stamps';
      if (kind === 'points') {
        agg.points += tx.quantity;
        if (tx.amountCents) agg.spendCents += tx.amountCents;
      } else {
        agg.stamps += tx.quantity;
      }
    }
  }
  return map;
}

function summarizePeriod(txs: TxRow[], firstVisitByMember: Map<string, Date>) {
  const byMember = buildMemberAggs(txs);
  let stamps = 0;
  let points = 0;
  let redeems = 0;
  let revenueCents = 0;
  let returning = 0;
  let newCustomers = 0;
  let redeemers = 0;

  for (const tx of txs) {
    if (isCashbackUnit(tx.unitKind)) {
      continue;
    }
    if (tx.type === 'redeem') redeems += tx.quantity;
    else {
      const kind =
        tx.unitKind === 'points' || (tx.amountCents != null && tx.amountCents > 0)
          ? 'points'
          : 'stamps';
      if (kind === 'points') {
        points += tx.quantity;
        if (tx.amountCents) revenueCents += tx.amountCents;
      } else stamps += tx.quantity;
    }
  }

  for (const agg of byMember.values()) {
    if (agg.visitDays.size >= 2) returning += 1;
    if (agg.redeems > 0) redeemers += 1;
    const first = firstVisitByMember.get(agg.membershipId);
    if (!first) {
      newCustomers += 1;
      continue;
    }
    const earliestInPeriod = [...agg.visitDays].sort()[0];
    if (earliestInPeriod && dayKey(first) === earliestInPeriod) {
      newCustomers += 1;
    }
  }

  const customers = byMember.size;
  const totalVisitDays = [...byMember.values()].reduce(
    (s, a) => s + a.visitDays.size,
    0,
  );
  const avgVisitsPerCustomer =
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
    newCustomers,
    redeemers,
    repeatRate,
    avgVisitsPerCustomer,
    byMember,
  };
}

function customerScore(agg: MemberAgg) {
  // Visitas e gasto pesam; resgate sinaliza cliente engajado na campanha
  return (
    agg.visitDays.size * 40 +
    agg.stamps * 8 +
    agg.points * 2 +
    Math.round(agg.spendCents / 100) +
    agg.redeems * 60
  );
}

function tierFor(agg: MemberAgg, isVip: boolean): 'vip' | 'regular' | 'new' {
  if (isVip || agg.redeems > 0 || agg.visitDays.size >= 4) return 'vip';
  if (agg.visitDays.size <= 1 && agg.stamps + agg.points <= 2) return 'new';
  return 'regular';
}

export const dashboardRoutes: FastifyPluginAsync = async (app) => {
  app.get('/dashboard', async (request) => {
    const auth = requireAuth(request);
    const query = periodQuerySchema.parse(request.query);
    const { key: range, from, toExclusive, prevFrom, prevTo } = resolvePeriod(
      query,
      { today: 'today', '7d': 7, '30d': 30 },
      'today',
    );

    const business = await prisma.business.findUniqueOrThrow({
      where: { id: auth.businessId },
      select: {
        id: true,
        name: true,
        logoUrl: true,
        primaryColor: true,
        primaryColorDark: true,
        slogan: true,
        slug: true,
      },
    });

    const txSelect = {
      type: true,
      quantity: true,
      membershipId: true,
      createdAt: true,
      amountCents: true,
      unitKind: true,
      campaignId: true,
      metadata: true,
    } as const;

    const [
      currentTxs,
      previousTxs,
      weekTxs,
      liveTxs,
      activeCampaigns,
      firstVisits,
      totalMembers,
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
        select: {
          type: true,
          quantity: true,
          membershipId: true,
          createdAt: true,
          amountCents: true,
          unitKind: true,
        },
      }),
      prisma.transaction.findMany({
        where: {
          businessId: auth.businessId,
          createdAt: {
            gte: addDays(startOfDay(new Date()), -6),
            lt: new Date(),
          },
        },
        select: { type: true, quantity: true, createdAt: true, unitKind: true },
      }),
      prisma.transaction.findMany({
        where: { businessId: auth.businessId },
        orderBy: { createdAt: 'desc' },
        take: 8,
        include: {
          membership: {
            include: {
              customer: { select: { displayName: true, phoneE164: true } },
            },
          },
          location: { select: { name: true } },
          campaign: { select: { rewardTitle: true, name: true, type: true } },
        },
      }),
      prisma.campaign.findMany({
        where: {
          businessId: auth.businessId,
          status: 'active',
          type: { in: ['stamps', 'spend', 'cashback'] },
        },
        orderBy: { createdAt: 'asc' },
        select: {
          id: true,
          name: true,
          type: true,
          rewardTitle: true,
          stampsNeeded: true,
          pointsPerReal: true,
          cashbackPercent: true,
          audienceSegmentId: true,
        },
      }),
      prisma.transaction.groupBy({
        by: ['membershipId'],
        where: { businessId: auth.businessId },
        _min: { createdAt: true },
      }),
      prisma.membership.count({ where: { businessId: auth.businessId } }),
    ]);

    const firstVisitByMember = new Map<string, Date>();
    for (const row of firstVisits) {
      if (row._min.createdAt) {
        firstVisitByMember.set(row.membershipId, row._min.createdAt);
      }
    }

    const current = summarizePeriod(currentTxs, firstVisitByMember);
    const previous = summarizePeriod(previousTxs, firstVisitByMember);

    // Top clientes do período
    const topAggs = [...current.byMember.values()]
      .sort((a, b) => customerScore(b) - customerScore(a))
      .slice(0, 8);

    const topMemberships =
      topAggs.length === 0
        ? []
        : await prisma.membership.findMany({
            where: {
              id: { in: topAggs.map((a) => a.membershipId) },
              businessId: auth.businessId,
            },
            include: {
              customer: {
                select: {
                  displayName: true,
                  phoneE164: true,
                  phoneLast4: true,
                },
              },
            },
          });
    const memberById = new Map(topMemberships.map((m) => [m.id, m]));

    const topCustomers = topAggs.map((agg) => {
      const m = memberById.get(agg.membershipId);
      const name =
        m?.customer.displayName ??
        (m?.customer.phoneLast4
          ? `···${m.customer.phoneLast4}`
          : m?.customer.phoneE164.slice(-4) ?? 'Cliente');
      const initials = name
        .split(/\s+/)
        .map((p) => p[0])
        .join('')
        .slice(0, 2)
        .toUpperCase();
      return {
        membershipId: agg.membershipId,
        displayName: name,
        phoneE164: m?.customer.phoneE164 ?? null,
        phoneLast4: m?.customer.phoneLast4 ?? null,
        initials,
        visits: agg.visitDays.size,
        stamps: agg.stamps,
        points: agg.points,
        spendCents: agg.spendCents,
        redeems: agg.redeems,
        lastVisitAt: agg.lastVisitAt,
        score: customerScore(agg),
        tier: tierFor(agg, Boolean(m?.isVip)),
        isVip: Boolean(m?.isVip),
      };
    });

    const todayStart = startOfDay(new Date());
    const weekSeries = Array.from({ length: 7 }, (_, i) => {
      const day = addDays(todayStart, -6 + i);
      const key = dayKey(day);
      let stamps = 0;
      let redeems = 0;
      for (const tx of weekTxs) {
        if (dayKey(tx.createdAt) !== key) continue;
        if (isCashbackUnit(tx.unitKind)) continue;
        if (tx.type === 'stamp') stamps += tx.quantity;
        else redeems += tx.quantity;
      }
      return {
        date: key,
        day: WEEKDAY_LABELS[day.getDay()],
        stamps,
        redeems,
      };
    });

    const live = liveTxs.map((tx) => {
      const name =
        tx.membership.customer.displayName ??
        tx.membership.customer.phoneE164.slice(-4);
      const initials = name
        .split(/\s+/)
        .map((p) => p[0])
        .join('')
        .slice(0, 2)
        .toUpperCase();
      const money =
        tx.quantity > 0
          ? (tx.quantity / 100).toLocaleString('pt-BR', {
              style: 'currency',
              currency: 'BRL',
            })
          : null;
      const text = isCashbackUnit(tx.unitKind)
        ? tx.type === 'redeem'
          ? `${name} usou ${money ?? 'cashback'} no caixa`
          : `${name} ganhou ${money ?? 'cashback'}`
        : tx.type === 'redeem'
          ? `${name} resgatou ${tx.campaign?.rewardTitle ?? 'uma recompensa'}`
          : tx.amountCents
            ? `${name} acumulou pontos`
            : `${name} ganhou um carimbo`;
      return {
        id: tx.id,
        type: tx.type,
        text,
        initials,
        locationName: tx.location.name,
        createdAt: tx.createdAt,
      };
    });

    const inactiveBase = Math.max(0, totalMembers - current.customers);

    // Campaign performance strip for dashboard
    const campaignStats = new Map<
      string,
      { redeems: number; redeemers: Set<string>; used: number; total: number }
    >();
    for (const tx of currentTxs as Array<
      TxRow & { campaignId?: string | null; metadata?: unknown }
    >) {
      if (tx.type !== 'redeem' || !tx.campaignId) continue;
      let s = campaignStats.get(tx.campaignId);
      if (!s) {
        s = { redeems: 0, redeemers: new Set(), used: 0, total: 0 };
        campaignStats.set(tx.campaignId, s);
      }
      s.redeemers.add(tx.membershipId);
      if (isCashbackUnit(tx.unitKind)) {
        s.redeems += 1;
        continue;
      }
      s.redeems += tx.quantity;
      const voucher = voucherFromMetadata(tx.metadata, {
        createdAt: tx.createdAt,
      });
      if (voucher) {
        s.total += 1;
        if (voucher.status === 'used') s.used += 1;
      }
    }

    const campaignPerf = activeCampaigns.map((c) => {
      const s = campaignStats.get(c.id);
      const fulfillPct =
        c.type === 'cashback' || !s || s.total === 0
          ? 0
          : Math.round((s.used / s.total) * 100);
      return {
        id: c.id,
        name: c.name,
        type: c.type,
        rewardTitle: c.rewardTitle,
        stampsNeeded: c.stampsNeeded,
        pointsPerReal: c.pointsPerReal,
        cashbackPercent: c.cashbackPercent,
        audienceSegmentId: c.audienceSegmentId,
        redeems: s?.redeems ?? 0,
        redeemers: s?.redeemers.size ?? 0,
        fulfillPct,
      };
    });
    const topCampaign = [...campaignPerf].sort(
      (a, b) => b.redeems - a.redeems || b.fulfillPct - a.fulfillPct,
    )[0] ?? null;
    const weakCampaign =
      [...campaignPerf]
        .filter((c) => c.type !== 'cashback')
        .filter((c) => c.redeems > 0 || activeCampaigns.length > 0)
        .sort((a, b) => a.fulfillPct - b.fulfillPct || a.redeems - b.redeems)[0] ??
      null;

    const audiencePresets = await Promise.all(
      AUDIENCE_PRESETS.map(async (p) => ({
        key: p.key,
        name: p.name,
        description: p.description,
        rules: p.rules,
        memberCount: await countMembershipsByRules(auth.businessId, p.rules),
      })),
    );
    const atRiskCount =
      audiencePresets.find((p) => p.key === 'at_risk')?.memberCount ?? 0;

    const insight =
      atRiskCount > 0
        ? {
            title: `Alto valor: ${atRiskCount} sem visita há 30 dias`,
            body: `${atRiskCount} clientes que mais gastam estão sumidos. Crie uma campanha só para eles e chame de volta.`,
            href: `/reports#audiencias`,
            cta: 'Ver audiência',
          }
        : current.customers === 0
          ? {
              title: 'Comece a medir o retorno',
              body: 'Cada visita no balcão vira dado. Campanhas ativas dão motivo para o cliente voltar — e você vê o impacto aqui.',
              href: '/campaigns',
              cta: 'Criar campanha',
            }
          : current.repeatRate >= 40
            ? {
                title: `${current.repeatRate}% voltaram no período`,
                body: `${current.returning} de ${current.customers} clientes vieram mais de uma vez. Campanhas reforçam esse hábito: quem resgata tende a voltar.`,
                href: '/reports',
                cta: 'Ver relatórios',
              }
            : {
                title: 'Há espaço para trazer mais gente de volta',
                body: `Só ${current.repeatRate}% voltaram (${current.returning} de ${current.customers}). Ative campanhas claras e incentive o aplicativo — o prêmio é o motivo da próxima visita.`,
                href: '/campaigns',
                cta: 'Ver campanhas',
              };

    return {
      range,
      business,
      kpis: {
        customers: {
          value: current.customers,
          deltaPct: deltaPct(current.customers, previous.customers),
        },
        stamps: {
          value: current.stamps,
          deltaPct: deltaPct(current.stamps, previous.stamps),
        },
        points: {
          value: current.points,
          deltaPct: deltaPct(current.points, previous.points),
        },
        redeems: {
          value: current.redeems,
          deltaPct: deltaPct(current.redeems, previous.redeems),
        },
        repeatRate: {
          value: current.repeatRate,
          deltaPct: deltaPct(current.repeatRate, previous.repeatRate),
        },
        avgVisits: {
          value: current.avgVisitsPerCustomer,
          deltaPct: deltaPct(
            Math.round(current.avgVisitsPerCustomer * 10),
            Math.round(previous.avgVisitsPerCustomer * 10),
          ),
        },
        revenueCents: {
          value: current.revenueCents,
          deltaPct: deltaPct(current.revenueCents, previous.revenueCents),
        },
        newCustomers: {
          value: current.newCustomers,
          deltaPct: deltaPct(current.newCustomers, previous.newCustomers),
        },
      },
      funnel: {
        base: totalMembers,
        active: current.customers,
        returning: current.returning,
        redeemed: current.redeemers,
        inactive: inactiveBase,
      },
      insight,
      audiencePresets,
      audienceInsight: {
        key: 'at_risk',
        name: 'Em risco',
        memberCount: atRiskCount,
        href: '/customers?inactiveDaysMin=30&spendCentsMin=20000&windowDays=180',
      },
      topCampaign,
      weakCampaign,
      campaignPerf,
      topCustomers,
      weekSeries,
      live,
      activeCampaigns: campaignPerf,
      activeCampaign: topCampaign
        ? {
            id: topCampaign.id,
            name: topCampaign.name,
            type: topCampaign.type,
            rewardTitle: topCampaign.rewardTitle,
            stampsNeeded: topCampaign.stampsNeeded,
            pointsPerReal: topCampaign.pointsPerReal,
            redeems: topCampaign.redeems,
            fulfillPct: topCampaign.fulfillPct,
          }
        : null,
    };
  });
};
