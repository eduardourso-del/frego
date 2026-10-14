import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { Prisma, prisma, type BusinessStatus } from '@frego/db';
import { requirePlatformAuth } from '../plugins/auth.js';
import { normalizeCnpj } from '../lib/cnpj.js';
import { foldLedgerTx } from '../lib/customer-stats.js';
import { shouldOmitFromLedger } from '../lib/ledger-meta.js';
import { loadTagsByMembershipIds } from '../lib/tags.js';

const STATUSES = [
  'pending',
  'trial',
  'active',
  'past_due',
  'suspended',
] as const;

const hexColor = z.string().regex(/^#[0-9A-Fa-f]{6}$/, 'Use hex #RRGGBB');
const expireDays = z.number().int().min(1).max(3650).nullable();
const optionalUrl = z.union([z.string().url(), z.literal(''), z.null()]);

const listQuery = z.object({
  status: z.enum(STATUSES).optional(),
  q: z.string().trim().max(80).optional(),
});

const CUSTOMER_SORTS = [
  'name',
  'phone',
  'visits',
  'spend',
  'lastVisit',
  'associatedAt',
] as const;

const customerListQuery = z.object({
  q: z.string().trim().max(80).optional(),
  page: z.coerce.number().int().min(1).max(10_000).optional(),
  sort: z.enum(CUSTOMER_SORTS).optional(),
  dir: z.enum(['asc', 'desc']).optional(),
});

const CUSTOMER_PAGE_SIZE = 25;

type CustomerSort = (typeof CUSTOMER_SORTS)[number];
type SortDir = 'asc' | 'desc';

const updateBusinessBody = z.object({
  name: z.string().min(1).max(80).optional(),
  type: z.string().min(1).max(40).optional(),
  slogan: z.string().max(160).nullable().optional(),
  cnpj: z.string().trim().max(18).nullable().optional(),
  logoUrl: optionalUrl.optional(),
  heroImageUrl: optionalUrl.optional(),
  primaryColor: hexColor.optional(),
  primaryColorDark: hexColor.optional(),
  pointsPerReal: z.number().int().positive().max(1000).optional(),
  cashbackPercent: z.number().int().min(0).max(100).optional(),
  cashbackMaxCents: z.number().int().positive().max(10_000_000).nullable().optional(),
  cashbackMinPurchaseCents: z
    .number()
    .int()
    .positive()
    .max(10_000_000)
    .nullable()
    .optional(),
  stampsExpireDays: expireDays.optional(),
  pointsExpireDays: expireDays.optional(),
  cashbackExpireDays: expireDays.optional(),
  status: z.enum(STATUSES).optional(),
  slug: z
    .union([
      z
        .string()
        .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'slug em minúsculas-com-hífen')
        .max(60),
      z.literal(''),
      z.null(),
    ])
    .optional(),
});

const updateLocationBody = z.object({
  name: z.string().min(2).max(80).optional(),
  address: z.string().min(5).max(200).nullable().optional(),
  isOpen: z.boolean().optional(),
});

function blankToNull(value: string | null | undefined) {
  if (value === undefined) return undefined;
  if (value === null || value === '') return null;
  return value;
}

const ACTIVITY_WINDOW_MS = 30 * 24 * 60 * 60 * 1000;

const CAMPAIGN_STATUS_RANK: Record<string, number> = {
  active: 0,
  paused: 1,
  draft: 2,
  archived: 3,
};

type WindowActivity = {
  earns: number;
  redeems: number;
  spendCents: number;
};

function emptyActivity(): WindowActivity {
  return { earns: 0, redeems: 0, spendCents: 0 };
}

function activitySince() {
  return new Date(Date.now() - ACTIVITY_WINDOW_MS);
}

async function windowActivityByBusiness(businessIds: string[], since: Date) {
  const map = new Map<string, WindowActivity>();
  if (businessIds.length === 0) return map;
  const rows = await prisma.transaction.groupBy({
    by: ['businessId', 'type'],
    where: { businessId: { in: businessIds }, createdAt: { gte: since } },
    _count: { _all: true },
    _sum: { amountCents: true },
  });
  for (const row of rows) {
    const current = map.get(row.businessId) ?? emptyActivity();
    if (row.type === 'stamp') {
      current.earns += row._count._all;
      current.spendCents += row._sum.amountCents ?? 0;
    } else if (row.type === 'redeem') {
      current.redeems += row._count._all;
    }
    map.set(row.businessId, current);
  }
  return map;
}

async function lastActivityByBusiness(businessIds: string[]) {
  const map = new Map<string, string>();
  if (businessIds.length === 0) return map;
  const rows = await prisma.transaction.groupBy({
    by: ['businessId'],
    where: { businessId: { in: businessIds } },
    _max: { createdAt: true },
  });
  for (const row of rows) {
    if (row._max.createdAt) {
      map.set(row.businessId, row._max.createdAt.toISOString());
    }
  }
  return map;
}

async function activeCampaignsByBusiness(businessIds: string[]) {
  const map = new Map<string, number>();
  if (businessIds.length === 0) return map;
  const rows = await prisma.campaign.groupBy({
    by: ['businessId'],
    where: { businessId: { in: businessIds }, status: 'active' },
    _count: { _all: true },
  });
  for (const row of rows) map.set(row.businessId, row._count._all);
  return map;
}

async function loadBusinessDetail(id: string) {
  const business = await prisma.business.findUnique({
    where: { id },
    include: {
      locations: {
        orderBy: { createdAt: 'asc' },
        select: {
          id: true,
          name: true,
          address: true,
          isOpen: true,
        },
      },
      teamMembers: {
        orderBy: { createdAt: 'asc' },
        select: {
          id: true,
          email: true,
          displayName: true,
          role: true,
          status: true,
          createdAt: true,
        },
      },
      billing: {
        select: {
          status: true,
          mrrCents: true,
          plan: { select: { tier: true, name: true } },
        },
      },
      whatsapp: {
        select: {
          status: true,
          displayPhoneNumber: true,
          verifiedName: true,
          qualityRating: true,
          coexistence: true,
          lastError: true,
          connectedAt: true,
        },
      },
      campaigns: {
        orderBy: { updatedAt: 'desc' },
        take: 40,
        select: {
          id: true,
          name: true,
          type: true,
          status: true,
          stampsNeeded: true,
          rewardTitle: true,
          cartela: true,
        },
      },
    },
  });
  if (!business) return null;

  const since = activitySince();
  const [customers, campaignCount, activeCampaigns, activityByBusiness, lastByBusiness, campaignRows] =
    await Promise.all([
      prisma.membership.count({
        where: { businessId: id, customer: { deletedAt: null } },
      }),
      prisma.campaign.count({ where: { businessId: id } }),
      prisma.campaign.count({ where: { businessId: id, status: 'active' } }),
      windowActivityByBusiness([id], since),
      lastActivityByBusiness([id]),
      prisma.transaction.groupBy({
        by: ['campaignId', 'type'],
        where: {
          businessId: id,
          createdAt: { gte: since },
          campaignId: { not: null },
        },
        _count: { _all: true },
      }),
    ]);
  const activity = activityByBusiness.get(id) ?? emptyActivity();
  const campaignActivity = new Map<string, WindowActivity>();
  for (const row of campaignRows) {
    if (!row.campaignId) continue;
    const current = campaignActivity.get(row.campaignId) ?? emptyActivity();
    if (row.type === 'stamp') current.earns += row._count._all;
    else if (row.type === 'redeem') current.redeems += row._count._all;
    campaignActivity.set(row.campaignId, current);
  }

  return {
    business: {
      id: business.id,
      name: business.name,
      type: business.type,
      status: business.status,
      logoUrl: business.logoUrl,
      heroImageUrl: business.heroImageUrl,
      primaryColor: business.primaryColor,
      primaryColorDark: business.primaryColorDark,
      slogan: business.slogan,
      cnpj: business.cnpj,
      slug: business.slug,
      pointsPerReal: business.pointsPerReal,
      cashbackPercent: business.cashbackPercent,
      cashbackMaxCents: business.cashbackMaxCents,
      cashbackMinPurchaseCents: business.cashbackMinPurchaseCents,
      stampsExpireDays: business.stampsExpireDays,
      pointsExpireDays: business.pointsExpireDays,
      cashbackExpireDays: business.cashbackExpireDays,
      createdAt: business.createdAt.toISOString(),
      updatedAt: business.updatedAt.toISOString(),
    },
    locations: business.locations,
    team: business.teamMembers.map((m) => ({
      ...m,
      createdAt: m.createdAt.toISOString(),
    })),
    billing: business.billing,
    whatsapp: business.whatsapp
      ? {
          ...business.whatsapp,
          connectedAt: business.whatsapp.connectedAt.toISOString(),
        }
      : null,
    campaigns: [...business.campaigns]
      .sort(
        (a, b) =>
          (CAMPAIGN_STATUS_RANK[a.status] ?? 9) -
            (CAMPAIGN_STATUS_RANK[b.status] ?? 9) ||
          a.name.localeCompare(b.name, 'pt-BR'),
      )
      .map((campaign) => {
        const performance =
          campaignActivity.get(campaign.id) ?? emptyActivity();
        return {
          ...campaign,
          earns30d: performance.earns,
          redeems30d: performance.redeems,
        };
      }),
    stats: {
      customers,
      campaigns: campaignCount,
      activeCampaigns,
      earns30d: activity.earns,
      redeems30d: activity.redeems,
      spendCents30d: activity.spendCents,
      lastActivityAt: lastByBusiness.get(id) ?? null,
    },
  };
}

const customerSelect = {
  id: true,
  displayName: true,
  phoneE164: true,
} as const;

function customerWhere(businessId: string, rawQ: string) {
  const digits = rawQ.replace(/\D/g, '');
  const activeCustomer = { deletedAt: null };
  return {
    total: { businessId, customer: activeCustomer },
    match: {
      businessId,
      customer: activeCustomer,
      ...(rawQ
        ? {
            OR: [
              {
                customer: {
                  displayName: { contains: rawQ, mode: 'insensitive' as const },
                },
              },
              ...(digits.length >= 4
                ? [
                    { customer: { phoneE164: { contains: digits } } },
                    { customer: { phoneLast4: digits.slice(-4) } },
                  ]
                : digits.length > 0
                  ? [{ customer: { phoneE164: { contains: digits } } }]
                  : []),
            ],
          }
        : {}),
    },
  };
}

function escapeLike(value: string) {
  return value.replace(/[\\%_]/g, (ch) => `\\${ch}`);
}

function customerSearchSql(rawQ: string): Prisma.Sql {
  if (!rawQ) return Prisma.sql`TRUE`;
  const digits = rawQ.replace(/\D/g, '');
  const name = Prisma.sql`c.display_name ILIKE ${`%${escapeLike(rawQ)}%`} ESCAPE '\\'`;
  if (!digits) return name;
  const phone = Prisma.sql`c.phone_e164 LIKE ${`%${escapeLike(digits)}%`} ESCAPE '\\'`;
  if (digits.length >= 4) {
    return Prisma.sql`(${name} OR ${phone} OR c.phone_last4 = ${digits.slice(-4)})`;
  }
  return Prisma.sql`(${name} OR ${phone})`;
}

/**
 * Ledger rows that count toward visits, spend, and last visit.
 * Mirrors shouldOmitFromLedger. Missing keys are unknown in SQL, so coalesce to false.
 */
const keptTxSql = Prisma.sql`(
  t.id IS NOT NULL
  AND NOT COALESCE(
    (jsonb_typeof(t.metadata->'reversedAt') = 'string' AND length(t.metadata->>'reversedAt') > 0)
    OR (jsonb_typeof(t.metadata->'reversalOf') = 'string' AND length(t.metadata->>'reversalOf') > 0)
    OR (jsonb_typeof(t.metadata->'reversalOf') = 'array' AND jsonb_array_length(t.metadata->'reversalOf') > 0),
    false
  )
)`;

function statOrderSql(sort: 'visits' | 'spend' | 'lastVisit'): Prisma.Sql {
  if (sort === 'visits') {
    return Prisma.sql`COUNT(DISTINCT CASE WHEN ${keptTxSql} THEN to_char(t.created_at, 'YYYY-MM-DD') END)`;
  }
  if (sort === 'spend') {
    return Prisma.sql`COALESCE(SUM(CASE WHEN ${keptTxSql} AND t.unit_kind IS DISTINCT FROM 'cashback_cents' AND t.type::text <> 'redeem' AND COALESCE(t.amount_cents, 0) <> 0 THEN t.amount_cents ELSE 0 END), 0)`;
  }
  return Prisma.sql`MAX(CASE WHEN ${keptTxSql} THEN t.created_at END)`;
}

function isStatSort(
  sort: CustomerSort,
): sort is 'visits' | 'spend' | 'lastVisit' {
  return sort === 'visits' || sort === 'spend' || sort === 'lastVisit';
}

async function membershipPageByStats(
  businessId: string,
  rawQ: string,
  sort: 'visits' | 'spend' | 'lastVisit',
  dir: SortDir,
  skip: number,
) {
  const direction = dir === 'asc' ? Prisma.sql`ASC` : Prisma.sql`DESC`;
  const ordered = await prisma.$queryRaw<{ id: string }[]>`
    SELECT m.id
    FROM memberships m
    INNER JOIN customers c ON c.id = m.customer_id
    LEFT JOIN transactions t
      ON t.membership_id = m.id AND t.business_id = m.business_id
    WHERE m.business_id = ${businessId}
      AND c.deleted_at IS NULL
      AND ${customerSearchSql(rawQ)}
    GROUP BY m.id, m.associated_at
    ORDER BY ${statOrderSql(sort)} ${direction} NULLS LAST,
      m.associated_at DESC,
      m.id ASC
    LIMIT ${CUSTOMER_PAGE_SIZE} OFFSET ${skip}
  `;
  if (ordered.length === 0) return [];

  const rows = await prisma.membership.findMany({
    where: { id: { in: ordered.map((row) => row.id) } },
    include: { customer: { select: customerSelect } },
  });
  const byId = new Map(rows.map((row) => [row.id, row]));
  return ordered.flatMap((row) => {
    const membership = byId.get(row.id);
    return membership ? [membership] : [];
  });
}

async function withCustomerStats(
  businessId: string,
  memberships: Awaited<ReturnType<typeof membershipPageByStats>>,
) {
  const membershipIds = memberships.map((m) => m.id);
  const [transactions, tagsByMembership] = await Promise.all([
    membershipIds.length === 0
      ? Promise.resolve([])
      : prisma.transaction.findMany({
          where: { businessId, membershipId: { in: membershipIds } },
          select: {
            membershipId: true,
            type: true,
            quantity: true,
            unitKind: true,
            amountCents: true,
            createdAt: true,
            metadata: true,
          },
        }),
    loadTagsByMembershipIds(membershipIds),
  ]);

  type Agg = {
    visitDays: Set<string>;
    spendCents: number;
    lastVisitAt: Date | null;
    stampsEarned: number;
    pointsEarned: number;
    redeems: number;
    cashbackEarnedCents: number;
    cashbackSpentCents: number;
  };
  const byMember = new Map<string, Agg>();
  for (const membershipId of membershipIds) {
    byMember.set(membershipId, {
      visitDays: new Set(),
      spendCents: 0,
      lastVisitAt: null,
      stampsEarned: 0,
      pointsEarned: 0,
      redeems: 0,
      cashbackEarnedCents: 0,
      cashbackSpentCents: 0,
    });
  }

  for (const tx of transactions) {
    if (shouldOmitFromLedger(tx.metadata)) continue;
    const agg = byMember.get(tx.membershipId);
    if (!agg) continue;
    if (!agg.lastVisitAt || tx.createdAt > agg.lastVisitAt) {
      agg.lastVisitAt = tx.createdAt;
    }
    agg.visitDays.add(tx.createdAt.toISOString().slice(0, 10));
    foldLedgerTx(agg, tx);
  }

  return memberships.map((membership) => {
    const agg = byMember.get(membership.id)!;
    return {
      customerId: membership.customer.id,
      membershipId: membership.id,
      displayName: membership.customer.displayName,
      phoneE164: membership.customer.phoneE164,
      isVip: membership.isVip,
      associatedAt: membership.associatedAt.toISOString(),
      tags: tagsByMembership.get(membership.id) ?? [],
      stats: {
        visits: agg.visitDays.size,
        lastVisitAt: agg.lastVisitAt?.toISOString() ?? null,
        spendCents: agg.spendCents,
      },
    };
  });
}

async function listBusinessCustomers(
  businessId: string,
  opts: { q: string; page: number; sort: CustomerSort; dir: SortDir },
) {
  const { total, match } = customerWhere(businessId, opts.q);
  const [totalCount, matchCount] = await Promise.all([
    prisma.membership.count({ where: total }),
    prisma.membership.count({ where: match }),
  ]);
  const pageCount = Math.max(1, Math.ceil(matchCount / CUSTOMER_PAGE_SIZE));
  const page = Math.min(Math.max(1, opts.page), pageCount);
  const skip = (page - 1) * CUSTOMER_PAGE_SIZE;

  const memberships = isStatSort(opts.sort)
    ? await membershipPageByStats(businessId, opts.q, opts.sort, opts.dir, skip)
    : await prisma.membership.findMany({
        where: match,
        include: { customer: { select: customerSelect } },
        orderBy: [
          opts.sort === 'name'
            ? {
                customer: {
                  displayName: { sort: opts.dir, nulls: 'last' },
                },
              }
            : opts.sort === 'phone'
              ? { customer: { phoneE164: opts.dir } }
              : { associatedAt: opts.dir },
          { associatedAt: 'desc' },
          { id: 'asc' },
        ],
        skip,
        take: CUSTOMER_PAGE_SIZE,
      });

  const customers = await withCustomerStats(businessId, memberships);
  return {
    totalCount,
    matchCount,
    page,
    pageSize: CUSTOMER_PAGE_SIZE,
    customers,
  };
}

async function setBusinessStatus(
  id: string,
  status: BusinessStatus,
) {
  return prisma.$transaction(async (tx) => {
    const next = await tx.business.update({
      where: { id },
      data: { status },
    });
    await tx.billingAccount.updateMany({
      where: { businessId: id },
      data: { status },
    });
    return next;
  });
}

export const adminRoutes: FastifyPluginAsync = async (app) => {
  app.get('/admin/me', async (request) => {
    const auth = requirePlatformAuth(request);
    return {
      admin: {
        id: auth.adminId,
        email: auth.email,
      },
    };
  });

  app.get('/admin/stats', async (request) => {
    requirePlatformAuth(request);

    const [active, pending, customers, stampsToday] = await Promise.all([
      prisma.business.count({
        where: { status: { in: ['active', 'trial'] } },
      }),
      prisma.business.count({ where: { status: 'pending' } }),
      prisma.customer.count(),
      prisma.transaction.count({
        where: {
          type: 'stamp',
          createdAt: {
            gte: new Date(new Date().setHours(0, 0, 0, 0)),
          },
        },
      }),
    ]);

    const billing = await prisma.billingAccount.aggregate({
      where: { status: { in: ['active', 'trial'] } },
      _sum: { mrrCents: true },
    });

    return {
      stats: {
        activeBusinesses: active,
        pendingApprovals: pending,
        customers,
        stampsToday,
        mrrCents: billing._sum.mrrCents ?? 0,
      },
    };
  });

  app.get('/admin/businesses', async (request) => {
    requirePlatformAuth(request);
    const query = listQuery.parse(request.query);
    const q = query.q?.trim();

    const businesses = await prisma.business.findMany({
      where: {
        ...(query.status ? { status: query.status } : {}),
        ...(q
          ? {
              OR: [
                { name: { contains: q, mode: 'insensitive' as const } },
                { slug: { contains: q, mode: 'insensitive' as const } },
                { type: { contains: q, mode: 'insensitive' as const } },
                {
                  teamMembers: {
                    some: {
                      email: { contains: q, mode: 'insensitive' as const },
                    },
                  },
                },
              ],
            }
          : {}),
      },
      include: {
        teamMembers: {
          where: { role: 'owner' },
          take: 1,
          select: {
            id: true,
            email: true,
            displayName: true,
          },
        },
        locations: {
          take: 1,
          select: { id: true, name: true, address: true },
        },
        billing: {
          select: { status: true, mrrCents: true },
        },
        _count: {
          select: {
            memberships: { where: { customer: { deletedAt: null } } },
            campaigns: true,
          },
        },
      },
      orderBy: [{ createdAt: 'desc' }],
    });

    const ids = businesses.map((b) => b.id);
    const since = activitySince();
    const [activityByBusiness, lastByBusiness, activeByBusiness] =
      await Promise.all([
        windowActivityByBusiness(ids, since),
        lastActivityByBusiness(ids),
        activeCampaignsByBusiness(ids),
      ]);

    const statusRank: Record<string, number> = {
      pending: 0,
      past_due: 1,
      active: 2,
      trial: 3,
      suspended: 4,
    };

    const rows = businesses.map((b) => {
      const activity = activityByBusiness.get(b.id) ?? emptyActivity();
      return {
        id: b.id,
        name: b.name,
        type: b.type,
        status: b.status,
        slug: b.slug,
        slogan: b.slogan,
        logoUrl: b.logoUrl,
        primaryColor: b.primaryColor,
        createdAt: b.createdAt.toISOString(),
        owner: b.teamMembers[0]
          ? {
              email: b.teamMembers[0].email,
              displayName: b.teamMembers[0].displayName,
            }
          : null,
        location: b.locations[0] ?? null,
        billing: b.billing,
        customers: b._count.memberships,
        campaigns: b._count.campaigns,
        activeCampaigns: activeByBusiness.get(b.id) ?? 0,
        performance: {
          earns: activity.earns,
          redeems: activity.redeems,
          spendCents: activity.spendCents,
          lastActivityAt: lastByBusiness.get(b.id) ?? null,
        },
      };
    });

    rows.sort((a, b) => {
      const byStatus =
        (statusRank[a.status] ?? 9) - (statusRank[b.status] ?? 9);
      if (byStatus !== 0) return byStatus;
      const aTime = a.performance.lastActivityAt
        ? Date.parse(a.performance.lastActivityAt)
        : 0;
      const bTime = b.performance.lastActivityAt
        ? Date.parse(b.performance.lastActivityAt)
        : 0;
      return bTime - aTime;
    });

    return { businesses: rows };
  });

  app.get('/admin/businesses/:id', async (request, reply) => {
    requirePlatformAuth(request);
    const { id } = request.params as { id: string };
    const detail = await loadBusinessDetail(id);
    if (!detail) {
      return reply.code(404).send({ error: 'NOT_FOUND' });
    }
    return detail;
  });

  app.get('/admin/businesses/:id/customers', async (request, reply) => {
    requirePlatformAuth(request);
    const { id } = request.params as { id: string };
    const query = customerListQuery.parse(request.query);
    const business = await prisma.business.findUnique({
      where: { id },
      select: { id: true },
    });
    if (!business) {
      return reply.code(404).send({ error: 'NOT_FOUND' });
    }
    return listBusinessCustomers(id, {
      q: query.q?.trim() ?? '',
      page: query.page ?? 1,
      sort: query.sort ?? 'associatedAt',
      dir: query.dir ?? 'desc',
    });
  });

  app.patch('/admin/businesses/:id', async (request, reply) => {
    requirePlatformAuth(request);
    const { id } = request.params as { id: string };
    const body = updateBusinessBody.parse(request.body);

    const existing = await prisma.business.findUnique({ where: { id } });
    if (!existing) {
      return reply.code(404).send({ error: 'NOT_FOUND' });
    }

    let cnpj: string | null | undefined;
    if (body.cnpj !== undefined) {
      const parsed = normalizeCnpj(body.cnpj);
      if (parsed === 'invalid') {
        return reply.code(400).send({ error: 'INVALID_CNPJ' });
      }
      if (parsed) {
        const taken = await prisma.business.findFirst({
          where: { cnpj: parsed, NOT: { id } },
        });
        if (taken) {
          return reply.code(409).send({ error: 'CNPJ_TAKEN' });
        }
      }
      cnpj = parsed;
    }

    const slug = blankToNull(body.slug);
    if (slug) {
      const taken = await prisma.business.findFirst({
        where: { slug, NOT: { id } },
      });
      if (taken) {
        return reply.code(409).send({ error: 'SLUG_TAKEN' });
      }
    }

    await prisma.business.update({
      where: { id },
      data: {
        name: body.name,
        type: body.type,
        slogan:
          body.slogan === undefined ? undefined : body.slogan || null,
        cnpj,
        logoUrl: blankToNull(body.logoUrl),
        heroImageUrl: blankToNull(body.heroImageUrl),
        primaryColor: body.primaryColor,
        primaryColorDark: body.primaryColorDark,
        pointsPerReal: body.pointsPerReal,
        cashbackPercent: body.cashbackPercent,
        cashbackMaxCents:
          body.cashbackMaxCents === undefined
            ? undefined
            : body.cashbackMaxCents,
        cashbackMinPurchaseCents:
          body.cashbackMinPurchaseCents === undefined
            ? undefined
            : body.cashbackMinPurchaseCents,
        stampsExpireDays:
          body.stampsExpireDays === undefined
            ? undefined
            : body.stampsExpireDays,
        pointsExpireDays:
          body.pointsExpireDays === undefined
            ? undefined
            : body.pointsExpireDays,
        cashbackExpireDays:
          body.cashbackExpireDays === undefined
            ? undefined
            : body.cashbackExpireDays,
        slug: slug === undefined ? undefined : slug,
      },
    });

    if (body.status && body.status !== existing.status) {
      await setBusinessStatus(id, body.status);
    }

    const detail = await loadBusinessDetail(id);
    return detail;
  });

  app.patch(
    '/admin/businesses/:id/locations/:locationId',
    async (request, reply) => {
      requirePlatformAuth(request);
      const { id, locationId } = request.params as {
        id: string;
        locationId: string;
      };
      const body = updateLocationBody.parse(request.body);

      const existing = await prisma.location.findFirst({
        where: { id: locationId, businessId: id },
      });
      if (!existing) {
        return reply.code(404).send({ error: 'LOCATION_NOT_FOUND' });
      }

      const location = await prisma.location.update({
        where: { id: locationId },
        data: {
          name: body.name,
          address: body.address === undefined ? undefined : body.address,
          isOpen: body.isOpen,
        },
        select: {
          id: true,
          name: true,
          address: true,
          isOpen: true,
        },
      });

      return { location };
    },
  );

  app.post('/admin/businesses/:id/approve', async (request, reply) => {
    requirePlatformAuth(request);
    const { id } = request.params as { id: string };

    const business = await prisma.business.findUnique({ where: { id } });
    if (!business) {
      return reply.code(404).send({ error: 'NOT_FOUND' });
    }
    if (business.status !== 'pending') {
      return reply.code(409).send({
        error: 'NOT_PENDING',
        status: business.status,
      });
    }

    const updated = await setBusinessStatus(id, 'trial');

    return {
      business: {
        id: updated.id,
        name: updated.name,
        status: updated.status,
      },
    };
  });

  app.post('/admin/businesses/:id/reject', async (request, reply) => {
    requirePlatformAuth(request);
    const { id } = request.params as { id: string };

    const business = await prisma.business.findUnique({ where: { id } });
    if (!business) {
      return reply.code(404).send({ error: 'NOT_FOUND' });
    }
    if (business.status !== 'pending') {
      return reply.code(409).send({
        error: 'NOT_PENDING',
        status: business.status,
      });
    }

    const updated = await setBusinessStatus(id, 'suspended');

    return {
      business: {
        id: updated.id,
        name: updated.name,
        status: updated.status,
      },
    };
  });

  app.delete('/admin/businesses/:id', async (request, reply) => {
    requirePlatformAuth(request);
    const { id } = request.params as { id: string };

    const business = await prisma.business.findUnique({
      where: { id },
      select: { id: true, name: true },
    });
    if (!business) {
      return reply.code(404).send({ error: 'NOT_FOUND' });
    }

    await prisma.$transaction(
      async (tx) => {
        await tx.resposta.deleteMany({
          where: { pesquisa: { businessId: id } },
        });
        await tx.convite.deleteMany({
          where: { pesquisa: { businessId: id } },
        });
        await tx.transaction.deleteMany({ where: { businessId: id } });
        await tx.business.delete({ where: { id } });
      },
      { timeout: 30_000 },
    );

    return { deleted: business };
  });
};
