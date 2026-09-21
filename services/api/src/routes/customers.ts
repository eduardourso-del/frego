import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { prisma } from '@frego/db';
import { requireAuth } from '../plugins/auth.js';
import { normalizeLast4, phoneLast4, toE164 } from '../lib/phone.js';
import { deriveWallet } from '../lib/wallet.js';
import { resolveCashbackEarn } from '../lib/cashback.js';
import { activeEarnKindsForBusiness } from '../lib/earn-kinds.js';
import { foldLedgerTx } from '../lib/customer-stats.js';
import { queueEarnNotify } from '../lib/whatsapp/earn-notify.js';
import { queueWelcomeWhatsAppForBusiness } from '../lib/whatsapp/welcome-notify.js';
import { voucherFromMetadata } from '../lib/voucher.js';
import { shouldOmitFromLedger } from '../lib/ledger-meta.js';
import { groupCounterSales, newSaleId } from '../lib/tx-reverse.js';
import {
  filterMembershipsByRules,
  parseAudienceRules,
  queryRulesFromParams,
} from '../lib/audience.js';
import {
  loadMembershipTags,
  loadTagsByMembershipIds,
  replaceMembershipTags,
  type TagDto,
} from '../lib/tags.js';

const lookupBody = z
  .object({
    /** Número completo — busca global */
    phone: z.string().min(8).optional(),
    /** Últimos 4 dígitos — desta loja, senão identidade global */
    last4: z.string().optional(),
  })
  .refine((b) => Boolean(b.phone || b.last4), {
    message: 'Informe phone ou last4',
  });

const createBody = z.object({
  phone: z.string().min(8),
  displayName: z
    .string()
    .trim()
    .max(80)
    .optional()
    .transform((s) => (s && s.length > 0 ? s : undefined)),
  birthday: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'YYYY-MM-DD')
    .optional(),
  addFirstStamp: z.boolean().optional(),
  locationId: z.string().optional(),
});

const patchBody = z
  .object({
    isVip: z.boolean().optional(),
    tagIds: z.array(z.string().min(1)).max(12).optional(),
  })
  .refine((b) => b.isVip !== undefined || b.tagIds !== undefined, {
    message: 'Informe isVip ou tagIds',
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

  const [business, activeEarnKinds] = await Promise.all([
    prisma.business.findUnique({
      where: { id: businessId },
      select: { pointsPerReal: true },
    }),
    activeEarnKindsForBusiness(businessId),
  ]);

  const cashbackEarn = membershipHere
    ? await resolveCashbackEarn(membershipHere.id, businessId)
    : null;

  const openVouchers = membershipHere
    ? (
        await prisma.transaction.findMany({
          where: {
            membershipId: membershipHere.id,
            businessId,
            type: 'redeem',
          },
          orderBy: { createdAt: 'desc' },
          take: 30,
          include: {
            campaign: {
              select: { name: true, rewardTitle: true, type: true },
            },
          },
        })
      )
        .map((tx) => {
          const voucher = voucherFromMetadata(tx.metadata, {
            createdAt: tx.createdAt,
          });
          if (!voucher || voucher.status !== 'open') return null;
          return {
            transactionId: tx.id,
            voucherCode: voucher.voucherCode,
            voucherDisplay: voucher.voucherDisplay,
            status: voucher.status,
            expiresAt: voucher.expiresAt,
            createdAt: tx.createdAt,
            rewardTitle:
              tx.campaign?.rewardTitle ?? tx.campaign?.name ?? 'Prêmio',
            campaignName: tx.campaign?.name ?? null,
          };
        })
        .filter((v): v is NonNullable<typeof v> => v != null)
    : [];

  const recentSales = membershipHere
    ? groupCounterSales(
        await prisma.transaction.findMany({
          where: {
            membershipId: membershipHere.id,
            businessId,
          },
          orderBy: { createdAt: 'desc' },
          take: 40,
          select: {
            id: true,
            type: true,
            quantity: true,
            unitKind: true,
            amountCents: true,
            createdAt: true,
            metadata: true,
            actorTeamMemberId: true,
          },
        }),
      )
    : [];

  const tags: TagDto[] = membershipHere
    ? await loadMembershipTags(membershipHere.id)
    : [];

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
    tags,
    otherShopsCount: otherShops.length,
    otherShops,
    wallet,
    pools: wallet?.pools ?? { stamps: 0, points: 0, cashbackCents: 0 },
    pointsPerReal: business?.pointsPerReal ?? 1,
    cashbackPercent: cashbackEarn?.percent ?? 0,
    activeEarnKinds,
    cashback: {
      campaignId: cashbackEarn?.campaignId ?? null,
      percent: cashbackEarn?.percent ?? 0,
      balanceCents: wallet?.pools.cashbackCents ?? 0,
    },
    openVouchers,
    recentSales,
  };
}

export const customerRoutes: FastifyPluginAsync = async (app) => {
  /**
   * Lista clientes associados a este negócio, com estatísticas locais.
   * Query: `q` (nome / telefone / last4), `limit` (default 100, max 200),
   * `audienceId` ou regras (spendCentsMin, windowDays, inactiveDaysMin, …).
   */
  app.get('/customers', async (request) => {
    const auth = requireAuth(request);
    const query = request.query as Record<string, string | undefined>;
    const rawQ = (query.q ?? '').trim();
    const digits = rawQ.replace(/\D/g, '');
    const limit = Math.min(
      Math.max(Number.parseInt(query.limit ?? '100', 10) || 100, 1),
      200,
    );

    let audienceMembershipIds: string[] | null = null;
    let appliedAudience: {
      id?: string;
      name?: string;
      rules: ReturnType<typeof parseAudienceRules>;
      memberCount: number;
    } | null = null;

    if (query.audienceId) {
      const segment = await prisma.audienceSegment.findFirst({
        where: { id: query.audienceId, businessId: auth.businessId },
      });
      if (segment) {
        const rules = parseAudienceRules(segment.rules);
        const matched = await filterMembershipsByRules(auth.businessId, rules);
        audienceMembershipIds = matched.map((m) => m.membershipId);
        appliedAudience = {
          id: segment.id,
          name: segment.name,
          rules,
          memberCount: matched.length,
        };
      }
    } else {
      const inlineRules = queryRulesFromParams(query);
      if (inlineRules) {
        const matched = await filterMembershipsByRules(
          auth.businessId,
          inlineRules,
        );
        audienceMembershipIds = matched.map((m) => m.membershipId);
        appliedAudience = {
          rules: inlineRules,
          memberCount: matched.length,
        };
      }
    }

    const activeCustomer = { deletedAt: null };

    if (audienceMembershipIds && audienceMembershipIds.length === 0) {
      const totalCount = await prisma.membership.count({
        where: { businessId: auth.businessId, customer: activeCustomer },
      });
      const vipCount = await prisma.membership.count({
        where: {
          businessId: auth.businessId,
          isVip: true,
          customer: activeCustomer,
        },
      });
      return {
        totalCount,
        vipCount,
        audience: appliedAudience,
        customers: [],
      };
    }

    const memberships = await prisma.membership.findMany({
      where: {
        businessId: auth.businessId,
        customer: activeCustomer,
        ...(audienceMembershipIds
          ? { id: { in: audienceMembershipIds } }
          : {}),
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
    const [transactions, tagsByMembership] = await Promise.all([
      membershipIds.length === 0
        ? Promise.resolve([] as Awaited<
            ReturnType<typeof prisma.transaction.findMany>
          >)
        : prisma.transaction.findMany({
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
              metadata: true,
            },
          }),
      loadTagsByMembershipIds(membershipIds),
    ]);

    type Agg = {
      visitDays: Set<string>;
      stampsEarned: number;
      pointsEarned: number;
      redeems: number;
      spendCents: number;
      cashbackEarnedCents: number;
      cashbackSpentCents: number;
      lastVisitAt: Date | null;
    };
    const byMember = new Map<string, Agg>();
    for (const id of membershipIds) {
      byMember.set(id, {
        visitDays: new Set(),
        stampsEarned: 0,
        pointsEarned: 0,
        redeems: 0,
        spendCents: 0,
        cashbackEarnedCents: 0,
        cashbackSpentCents: 0,
        lastVisitAt: null,
      });
    }

    for (const tx of transactions) {
      if (shouldOmitFromLedger(tx.metadata)) continue;
      const agg = byMember.get(tx.membershipId);
      if (!agg) continue;
      if (!agg.lastVisitAt || tx.createdAt > agg.lastVisitAt) {
        agg.lastVisitAt = tx.createdAt;
      }
      const day = tx.createdAt.toISOString().slice(0, 10);
      agg.visitDays.add(day);
      foldLedgerTx(agg, tx);
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
        wallet.campaigns.find(
          (c) =>
            c.type !== 'birthday' &&
            c.type !== 'cashback' &&
            c.type !== 'promo' &&
            c.canRedeem,
        ) ??
        wallet.campaigns.find(
          (c) =>
            c.type !== 'birthday' &&
            c.type !== 'cashback' &&
            c.type !== 'promo',
        ) ??
        wallet.campaigns.find((c) => c.canRedeem) ??
        wallet.campaigns[0] ??
        null;
      const progress = primary
        ? {
            campaignId: primary.campaignId,
            campaignName: primary.campaignName,
            type: primary.type,
            current:
              primary.type === 'promo' ||
              primary.type === 'birthday' ||
              primary.type === 'cashback'
                ? primary.canRedeem
                  ? 1
                  : 0
                : primary.type === 'spend'
                  ? wallet.pools.points
                  : wallet.pools.stamps,
            needed:
              primary.type === 'promo' ||
              primary.type === 'birthday' ||
              primary.type === 'cashback'
                ? 1
                : primary.unitsNeeded,
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
        tags: tagsByMembership.get(m.id) ?? [],
        associatedAt: m.associatedAt,
        onboardingCompleted: m.customer.onboardingCompleted,
        stats: {
          visits: agg.visitDays.size,
          lastVisitAt: agg.lastVisitAt,
          stampsEarned: agg.stampsEarned,
          pointsEarned: agg.pointsEarned,
          redeems: agg.redeems,
          spendCents: agg.spendCents,
          cashbackEarnedCents: agg.cashbackEarnedCents,
          cashbackSpentCents: agg.cashbackSpentCents,
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
      where: { businessId: auth.businessId, customer: activeCustomer },
    });
    const vipCount = await prisma.membership.count({
      where: {
        businessId: auth.businessId,
        isVip: true,
        customer: activeCustomer,
      },
    });

    return {
      totalCount,
      vipCount,
      audience: appliedAudience,
      customers,
    };
  });

  /**
   * Busca cliente:
   * - `phone`: identidade global (E.164) — encontra app e outras lojas
   * - `last4`: preferência em memberships desta loja; se vazio, cai na
   *   identidade global (app / outras lojas) para poder associar aqui
   * Se houver vários matches, retorna `matches[]`.
   */
  app.post('/customers/lookup', async (request, reply) => {
    const auth = requireAuth(request);
    const body = lookupBody.parse(request.body);

    if (body.last4) {
      const last4 = normalizeLast4(body.last4);
      const memberships = await prisma.membership.findMany({
        where: {
          businessId: auth.businessId,
          customer: { phoneLast4: last4, deletedAt: null },
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

      if (memberships.length > 1) {
        const tagsByMembership = await loadTagsByMembershipIds(
          memberships.map((m) => m.id),
        );
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
            associatedHere: true,
            tags: tagsByMembership.get(m.id) ?? [],
          })),
          activeEarnKinds: await activeEarnKindsForBusiness(auth.businessId),
        };
      }

      if (memberships.length === 1) {
        return serializeCustomerLookup(
          memberships[0].customer,
          auth.businessId,
        );
      }

      // Não está nesta loja — busca identidade global (app / outras lojas).
      const globals = await prisma.customer.findMany({
        where: { phoneLast4: last4, deletedAt: null },
        include: {
          memberships: {
            include: {
              business: { select: { id: true, name: true } },
            },
          },
        },
        take: 20,
      });

      if (globals.length === 0) {
        return reply.code(404).send({
          found: false,
          last4,
          matches: [],
          hint: 'FULL_PHONE',
          activeEarnKinds: await activeEarnKindsForBusiness(auth.businessId),
        });
      }

      if (globals.length > 1) {
        return {
          found: true,
          multiple: true,
          last4,
          matches: globals.map((c) => ({
            customerId: c.id,
            displayName: c.displayName,
            phoneE164: c.phoneE164,
            isVip: false,
            membershipId: null,
            associatedHere: false,
            tags: [],
          })),
          activeEarnKinds: await activeEarnKindsForBusiness(auth.businessId),
        };
      }

      return serializeCustomerLookup(globals[0], auth.businessId);
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
        activeEarnKinds: await activeEarnKindsForBusiness(auth.businessId),
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

    const priorMembership = await prisma.membership.findUnique({
      where: {
        customerId_businessId: {
          customerId: customer.id,
          businessId: auth.businessId,
        },
      },
      select: { id: true },
    });
    const isNewMembership = !priorMembership;

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

    const business = await prisma.business.findUnique({
      where: { id: auth.businessId },
      select: { name: true },
    });

    if (isNewMembership) {
      queueWelcomeWhatsAppForBusiness({
        businessId: auth.businessId,
        businessName: business?.name ?? 'Frego',
        toE164: customer.phoneE164,
        customerName: customer.displayName,
        log: (msg, extra) => request.log.info(extra ?? {}, msg),
      });
    }

    let stampTransaction = null;
    let wallet = await deriveWallet(membership.id, auth.businessId);

    if (body.addFirstStamp) {
      const earnKinds = await activeEarnKindsForBusiness(auth.businessId);
      if (!earnKinds.includes('stamps')) {
        return reply.code(400).send({
          error: 'EARN_KIND_INACTIVE',
          message: 'Esta loja não tem campanha de carimbos ativa.',
        });
      }
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
          metadata: { saleId: newSaleId(), role: 'earn' },
        },
      });
      wallet = await deriveWallet(membership.id, auth.businessId);

      queueEarnNotify({
        businessId: auth.businessId,
        businessName: business?.name ?? 'Frego',
        customerId: customer.id,
        toE164: customer.phoneE164,
        unitKind: 'stamps',
        quantity: 1,
        transactionId: stampTransaction.id,
        wallet,
        log: (msg, extra) => request.log.info(extra ?? {}, msg),
      });
    }

    const tags = await loadMembershipTags(membership.id);

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
      tags,
      stampTransaction,
      sale: stampTransaction
        ? groupCounterSales([stampTransaction], 1)[0] ?? null
        : null,
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

    const [wallet, recent, allTx, tags] = await Promise.all([
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
          metadata: true,
        },
      }),
      loadMembershipTags(membership.id),
    ]);

    const visitDays = new Set<string>();
    const fold = {
      stampsEarned: 0,
      pointsEarned: 0,
      redeems: 0,
      spendCents: 0,
      cashbackEarnedCents: 0,
      cashbackSpentCents: 0,
    };
    let lastVisitAt: Date | null = null;

    for (const tx of allTx) {
      if (shouldOmitFromLedger(tx.metadata)) continue;
      visitDays.add(tx.createdAt.toISOString().slice(0, 10));
      if (!lastVisitAt || tx.createdAt > lastVisitAt) lastVisitAt = tx.createdAt;
      foldLedgerTx(fold, tx);
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
      tags,
      stats: {
        visits: visitDays.size,
        lastVisitAt,
        stampsEarned: fold.stampsEarned,
        pointsEarned: fold.pointsEarned,
        redeems: fold.redeems,
        spendCents: fold.spendCents,
        cashbackEarnedCents: fold.cashbackEarnedCents,
        cashbackSpentCents: fold.cashbackSpentCents,
        redeemableCampaigns: wallet.campaigns.filter((c) => c.canRedeem).length,
      },
      wallet,
      pools: wallet.pools,
      otherShopsCount: otherShops.length,
      otherShops,
      recentTransactions: recent
        .filter((tx) => !shouldOmitFromLedger(tx.metadata))
        .map((tx) => {
        const voucher = voucherFromMetadata(tx.metadata, {
          createdAt: tx.createdAt,
        });
        return {
          ...tx,
          voucherCode: voucher?.voucherCode ?? null,
          voucherDisplay: voucher?.voucherDisplay ?? null,
          voucherStatus: voucher?.status ?? null,
          voucherUsedAt: voucher?.usedAt ?? null,
          voucherExpiresAt: voucher?.expiresAt ?? null,
        };
      }),
    };
  });

  app.patch('/customers/:id', async (request, reply) => {
    const auth = requireAuth(request);
    const { id } = request.params as { id: string };
    const body = patchBody.parse(request.body);

    const membership = await prisma.membership.findFirst({
      where: { customerId: id, businessId: auth.businessId },
      select: { id: true, isVip: true },
    });
    if (!membership) {
      return reply.code(404).send({ error: 'MEMBERSHIP_NOT_FOUND' });
    }

    let isVip = membership.isVip;
    if (body.isVip !== undefined) {
      const updated = await prisma.membership.update({
        where: { id: membership.id },
        data: { isVip: body.isVip },
        select: { id: true, isVip: true },
      });
      isVip = updated.isVip;
    }

    let tags: TagDto[];
    try {
      tags =
        body.tagIds !== undefined
          ? await replaceMembershipTags({
              membershipId: membership.id,
              businessId: auth.businessId,
              tagIds: body.tagIds,
              teamMemberId: auth.teamMemberId,
            })
          : await loadMembershipTags(membership.id);
    } catch (err) {
      const code = (err as { code?: string }).code;
      const statusCode = (err as { statusCode?: number }).statusCode ?? 400;
      const message = (err as { message?: string }).message;
      if (code === 'TAG_LIMIT' || code === 'TAG_NOT_FOUND') {
        return reply.code(statusCode).send({ error: code, message });
      }
      throw err;
    }

    return {
      membership: { id: membership.id, isVip },
      tags,
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
    const [recent, tags] = await Promise.all([
      prisma.transaction.findMany({
        where: { membershipId: membership.id, businessId: auth.businessId },
        orderBy: { createdAt: 'desc' },
        take: 20,
        include: {
          actorTeamMember: { select: { displayName: true, role: true } },
          location: { select: { name: true } },
          campaign: { select: { name: true, rewardTitle: true } },
        },
      }),
      loadMembershipTags(membership.id),
    ]);

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
      tags,
      wallet,
      pools: wallet.pools,
      recentTransactions: recent,
    };
  });
};
