import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { prisma } from '@frego/db';
import { requireAuth } from '../plugins/auth.js';
import { normalizeLast4, phoneLast4, toE164 } from '../lib/phone.js';
import { deriveWallet } from '../lib/wallet.js';
import { queueEarnWhatsAppForBusiness } from '../lib/whatsapp/earn-notify.js';

const lookupBody = z
  .object({
    /** Número completo — busca global */
    phone: z.string().min(8).optional(),
    /** Últimos 4 dígitos — só clientes já vinculados a este negócio */
    last4: z.string().optional(),
  })
  .refine((b) => Boolean(b.phone || b.last4), {
    message: 'Informe phone ou last4',
  });

const createBody = z.object({
  phone: z.string().min(8),
  displayName: z.string().min(1).optional(),
  birthday: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'YYYY-MM-DD')
    .optional(),
  addFirstStamp: z.boolean().optional(),
  locationId: z.string().optional(),
});

async function serializeCustomerLookup(
  customer: {
    id: string;
    displayName: string | null;
    birthday: Date | null;
    phoneE164: string;
    memberships: Array<{
      id: string;
      businessId: string;
      isVip: boolean;
      associatedAt: Date;
      business: { id: string; name: string };
    }>;
  },
  businessId: string,
) {
  const membershipHere = customer.memberships.find(
    (m) => m.businessId === businessId,
  );
  const otherShops = customer.memberships
    .filter((m) => m.businessId !== businessId)
    .map((m) => ({ businessId: m.business.id, name: m.business.name }));

  const wallet = membershipHere
    ? await deriveWallet(membershipHere.id, businessId)
    : null;

  const business = await prisma.business.findUnique({
    where: { id: businessId },
    select: { pointsPerReal: true },
  });

  return {
    found: true as const,
    phoneE164: customer.phoneE164,
    associatedHere: Boolean(membershipHere),
    customer: {
      id: customer.id,
      displayName: customer.displayName,
      birthday: customer.birthday,
      phoneE164: customer.phoneE164,
    },
    membership: membershipHere
      ? {
          id: membershipHere.id,
          isVip: membershipHere.isVip,
          associatedAt: membershipHere.associatedAt,
        }
      : null,
    otherShopsCount: otherShops.length,
    otherShops,
    wallet,
    pools: wallet?.pools ?? { stamps: 0, points: 0 },
    pointsPerReal: business?.pointsPerReal ?? 1,
  };
}

export const customerRoutes: FastifyPluginAsync = async (app) => {
  /**
   * Lista clientes associados a este negócio, com estatísticas locais.
   * Query: `q` (nome / telefone / last4), `limit` (default 100, max 200).
   */
  app.get('/customers', async (request) => {
    const auth = requireAuth(request);
    const query = request.query as { q?: string; limit?: string };
    const rawQ = (query.q ?? '').trim();
    const digits = rawQ.replace(/\D/g, '');
    const limit = Math.min(
      Math.max(Number.parseInt(query.limit ?? '100', 10) || 100, 1),
      200,
    );

    const memberships = await prisma.membership.findMany({
      where: {
        businessId: auth.businessId,
        ...(rawQ
          ? {
              OR: [
                {
                  customer: {
                    displayName: { contains: rawQ, mode: 'insensitive' },
                  },
                },
                ...(digits.length >= 4
                  ? [
                      {
                        customer: {
                          phoneE164: { contains: digits },
                        },
                      },
                      {
                        customer: {
                          phoneLast4: digits.slice(-4),
                        },
                      },
                    ]
                  : digits.length > 0
                    ? [
                        {
                          customer: {
                            phoneE164: { contains: digits },
                          },
                        },
                      ]
                    : []),
              ],
            }
          : {}),
      },
      include: {
        customer: {
          select: {
            id: true,
            displayName: true,
            phoneE164: true,
            birthday: true,
            onboardingCompleted: true,
            createdAt: true,
          },
        },
      },
      orderBy: { associatedAt: 'desc' },
      take: limit,
    });

    const membershipIds = memberships.map((m) => m.id);
    const transactions =
      membershipIds.length === 0
        ? []
        : await prisma.transaction.findMany({
            where: {
              businessId: auth.businessId,
              membershipId: { in: membershipIds },
            },
            select: {
              membershipId: true,
              type: true,
              quantity: true,
              unitKind: true,
              amountCents: true,
              createdAt: true,
              campaignId: true,
            },
          });

    type Agg = {
      visitDays: Set<string>;
      stamps: number;
      points: number;
      redeems: number;
      spendCents: number;
      lastVisitAt: Date | null;
    };
    const byMember = new Map<string, Agg>();
    for (const id of membershipIds) {
      byMember.set(id, {
        visitDays: new Set(),
        stamps: 0,
        points: 0,
        redeems: 0,
        spendCents: 0,
        lastVisitAt: null,
      });
    }

    for (const tx of transactions) {
      const agg = byMember.get(tx.membershipId);
      if (!agg) continue;
      if (!agg.lastVisitAt || tx.createdAt > agg.lastVisitAt) {
        agg.lastVisitAt = tx.createdAt;
      }
      const day = tx.createdAt.toISOString().slice(0, 10);
      agg.visitDays.add(day);

      if (tx.type === 'redeem') {
        agg.redeems += tx.quantity;
        continue;
      }
      const kind =
        tx.unitKind === 'points' ||
        (tx.amountCents != null && tx.amountCents > 0)
          ? 'points'
          : 'stamps';
      if (kind === 'points') {
        agg.points += tx.quantity;
        if (tx.amountCents) agg.spendCents += tx.amountCents;
      } else {
        agg.stamps += tx.quantity;
      }
    }

    // Pools atuais (earn − redeem) via deriveWallet seria N queries;
    // recalcula com ledger + campanhas ativas uma vez.
    const wallets = await Promise.all(
      memberships.map(async (m) => {
        const wallet = await deriveWallet(m.id, auth.businessId);
        return [m.id, wallet] as const;
      }),
    );
    const walletById = new Map(wallets);

    const customers = memberships.map((m) => {
      const agg = byMember.get(m.id)!;
      const wallet = walletById.get(m.id)!;
      const redeemable = wallet.campaigns.filter((c) => c.canRedeem).length;
      const primary =
        wallet.campaigns.find((c) => c.type !== 'birthday' && c.canRedeem) ??
        wallet.campaigns.find((c) => c.type !== 'birthday') ??
        wallet.campaigns.find((c) => c.canRedeem) ??
        wallet.campaigns[0] ??
        null;
      const progress = primary
        ? {
            campaignId: primary.campaignId,
            campaignName: primary.campaignName,
            type: primary.type,
            current:
              primary.type === 'spend'
                ? wallet.pools.points
                : wallet.pools.stamps,
            needed: primary.unitsNeeded,
            canRedeem: primary.canRedeem,
            rewardTitle: primary.rewardTitle,
          }
        : null;
      return {
        customerId: m.customer.id,
        membershipId: m.id,
        displayName: m.customer.displayName,
        phoneE164: m.customer.phoneE164,
        birthday: m.customer.birthday,
        isVip: m.isVip,
        associatedAt: m.associatedAt,
        onboardingCompleted: m.customer.onboardingCompleted,
        stats: {
          visits: agg.visitDays.size,
          lastVisitAt: agg.lastVisitAt,
          stampsEarned: agg.stamps,
          pointsEarned: agg.points,
          redeems: agg.redeems,
          spendCents: agg.spendCents,
        },
        pools: wallet.pools,
        progress,
        redeemableCampaigns: redeemable,
      };
    });

    // Mais ativos / recentes no topo da lista filtrada
    customers.sort((a, b) => {
      const aT = a.stats.lastVisitAt?.getTime() ?? 0;
      const bT = b.stats.lastVisitAt?.getTime() ?? 0;
      if (bT !== aT) return bT - aT;
      return b.stats.visits - a.stats.visits;
    });

    const totalCount = await prisma.membership.count({
      where: { businessId: auth.businessId },
    });
    const vipCount = await prisma.membership.count({
      where: { businessId: auth.businessId, isVip: true },
    });

    return {
      totalCount,
      vipCount,
      customers,
    };
  });

  /**
   * Busca cliente:
   * - `last4`: só memberships deste negócio (rápido no balcão)
   * - `phone`: identidade global (E.164)
   * Se last4 tiver vários matches, retorna `matches[]`.
   */
  app.post('/customers/lookup', async (request, reply) => {
    const auth = requireAuth(request);
    const body = lookupBody.parse(request.body);

    if (body.last4) {
      const last4 = normalizeLast4(body.last4);
      const memberships = await prisma.membership.findMany({
        where: {
          businessId: auth.businessId,
          customer: { phoneLast4: last4 },
        },
        include: {
          customer: {
            include: {
              memberships: {
                include: {
                  business: { select: { id: true, name: true } },
                },
              },
            },
          },
        },
        take: 20,
      });

      if (memberships.length === 0) {
        return reply.code(404).send({
          found: false,
          last4,
          matches: [],
        });
      }

      if (memberships.length > 1) {
        return {
          found: true,
          multiple: true,
          last4,
          matches: memberships.map((m) => ({
            customerId: m.customer.id,
            displayName: m.customer.displayName,
            phoneE164: m.customer.phoneE164,
            isVip: m.isVip,
            membershipId: m.id,
          })),
        };
      }

      return serializeCustomerLookup(memberships[0].customer, auth.businessId);
    }

    const phoneE164 = toE164(body.phone!);
    const customer = await prisma.customer.findUnique({
      where: { phoneE164 },
      include: {
        memberships: {
          include: {
            business: { select: { id: true, name: true } },
          },
        },
      },
    });

    if (!customer) {
      return reply.code(404).send({
        found: false,
        phoneE164,
      });
    }

    return serializeCustomerLookup(customer, auth.businessId);
  });

  /**
   * Create global customer (if needed) + membership for this business.
   * Never duplicates a person — phone is unique platform-wide.
   */
  app.post('/customers', async (request, reply) => {
    const auth = requireAuth(request);
    const body = createBody.parse(request.body);
    const phoneE164 = toE164(body.phone);
    const last4 = phoneLast4(phoneE164);

    let customer = await prisma.customer.upsert({
      where: { phoneE164 },
      create: {
        phoneE164,
        phoneLast4: last4,
        displayName: body.displayName,
        birthday: body.birthday ? new Date(body.birthday) : undefined,
      },
      update: {
        phoneLast4: last4,
      },
    });

    const patch: { displayName?: string; birthday?: Date } = {};
    if (!customer.displayName && body.displayName) {
      patch.displayName = body.displayName;
    }
    if (!customer.birthday && body.birthday) {
      patch.birthday = new Date(body.birthday);
    }
    if (Object.keys(patch).length > 0) {
      customer = await prisma.customer.update({
        where: { id: customer.id },
        data: patch,
      });
    }

    const membership = await prisma.membership.upsert({
      where: {
        customerId_businessId: {
          customerId: customer.id,
          businessId: auth.businessId,
        },
      },
      create: {
        customerId: customer.id,
        businessId: auth.businessId,
      },
      update: {},
    });

    let stampTransaction = null;
    let wallet = await deriveWallet(membership.id, auth.businessId);

    if (body.addFirstStamp) {
      const locationId = body.locationId ?? auth.locationId;
      if (!locationId) {
        return reply.code(400).send({ error: 'LOCATION_REQUIRED' });
      }

      stampTransaction = await prisma.transaction.create({
        data: {
          businessId: auth.businessId,
          membershipId: membership.id,
          campaignId: null,
          locationId,
          actorTeamMemberId: auth.teamMemberId,
          type: 'stamp',
          quantity: 1,
          unitKind: 'stamps',
        },
      });
      wallet = await deriveWallet(membership.id, auth.businessId);

      const business = await prisma.business.findUnique({
        where: { id: auth.businessId },
        select: { name: true },
      });
      queueEarnWhatsAppForBusiness({
        businessId: auth.businessId,
        businessName: business?.name ?? 'Frego',
        toE164: customer.phoneE164,
        unitKind: 'stamps',
        quantity: 1,
        wallet,
        log: (msg, extra) => request.log.info(extra ?? {}, msg),
      });
    }

    return reply.code(201).send({
      customer: {
        id: customer.id,
        displayName: customer.displayName,
        birthday: customer.birthday,
        phoneE164: customer.phoneE164,
      },
      membership: {
        id: membership.id,
        isVip: membership.isVip,
        associatedAt: membership.associatedAt,
      },
      stampTransaction,
      wallet,
      pools: wallet.pools,
    });
  });

  /** Perfil + estatísticas + carteira do cliente neste negócio. */
  app.get('/customers/:id', async (request, reply) => {
    const auth = requireAuth(request);
    const { id } = request.params as { id: string };

    const membership = await prisma.membership.findFirst({
      where: { customerId: id, businessId: auth.businessId },
      include: {
        customer: {
          include: {
            memberships: {
              include: {
                business: { select: { id: true, name: true, logoUrl: true } },
              },
            },
          },
        },
      },
    });

    if (!membership) {
      return reply.code(404).send({ error: 'MEMBERSHIP_NOT_FOUND' });
    }

    const [wallet, recent, allTx] = await Promise.all([
      deriveWallet(membership.id, auth.businessId),
      prisma.transaction.findMany({
        where: { membershipId: membership.id, businessId: auth.businessId },
        orderBy: { createdAt: 'desc' },
        take: 30,
        include: {
          actorTeamMember: { select: { displayName: true, role: true } },
          location: { select: { name: true } },
          campaign: { select: { name: true, rewardTitle: true } },
        },
      }),
      prisma.transaction.findMany({
        where: { membershipId: membership.id, businessId: auth.businessId },
        select: {
          type: true,
          quantity: true,
          unitKind: true,
          amountCents: true,
          createdAt: true,
        },
      }),
    ]);

    const visitDays = new Set<string>();
    let stampsEarned = 0;
    let pointsEarned = 0;
    let redeems = 0;
    let spendCents = 0;
    let lastVisitAt: Date | null = null;

    for (const tx of allTx) {
      visitDays.add(tx.createdAt.toISOString().slice(0, 10));
      if (!lastVisitAt || tx.createdAt > lastVisitAt) lastVisitAt = tx.createdAt;
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
      } else stampsEarned += tx.quantity;
    }

    const otherShops = membership.customer.memberships
      .filter((m) => m.businessId !== auth.businessId)
      .map((m) => ({
        businessId: m.business.id,
        name: m.business.name,
        logoUrl: m.business.logoUrl,
      }));

    return {
      customer: {
        id: membership.customer.id,
        displayName: membership.customer.displayName,
        phoneE164: membership.customer.phoneE164,
        birthday: membership.customer.birthday,
        onboardingCompleted: membership.customer.onboardingCompleted,
        createdAt: membership.customer.createdAt,
      },
      membership: {
        id: membership.id,
        isVip: membership.isVip,
        associatedAt: membership.associatedAt,
      },
      stats: {
        visits: visitDays.size,
        lastVisitAt,
        stampsEarned,
        pointsEarned,
        redeems,
        spendCents,
        redeemableCampaigns: wallet.campaigns.filter((c) => c.canRedeem).length,
      },
      wallet,
      pools: wallet.pools,
      otherShopsCount: otherShops.length,
      otherShops,
      recentTransactions: recent.map((tx) => {
        const meta =
          tx.metadata && typeof tx.metadata === 'object'
            ? (tx.metadata as Record<string, unknown>)
            : null;
        const voucherCode =
          typeof meta?.voucherCode === 'string' ? meta.voucherCode : null;
        const voucherDisplay =
          typeof meta?.voucherDisplay === 'string'
            ? meta.voucherDisplay
            : voucherCode;
        return {
          ...tx,
          voucherCode,
          voucherDisplay,
        };
      }),
    };
  });

  /** Derived wallet for a customer within the authenticated business. */
  app.get('/customers/:id/wallet', async (request, reply) => {
    const auth = requireAuth(request);
    const { id } = request.params as { id: string };

    const membership = await prisma.membership.findFirst({
      where: { customerId: id, businessId: auth.businessId },
      include: { customer: true },
    });

    if (!membership) {
      return reply.code(404).send({ error: 'MEMBERSHIP_NOT_FOUND' });
    }

    const wallet = await deriveWallet(membership.id, auth.businessId);
    const recent = await prisma.transaction.findMany({
      where: { membershipId: membership.id, businessId: auth.businessId },
      orderBy: { createdAt: 'desc' },
      take: 20,
      include: {
        actorTeamMember: { select: { displayName: true, role: true } },
        location: { select: { name: true } },
        campaign: { select: { name: true, rewardTitle: true } },
      },
    });

    return {
      customer: {
        id: membership.customer.id,
        displayName: membership.customer.displayName,
        phoneE164: membership.customer.phoneE164,
        birthday: membership.customer.birthday,
      },
      membership: {
        id: membership.id,
        isVip: membership.isVip,
      },
      wallet,
      pools: wallet.pools,
      recentTransactions: recent,
    };
  });
};
