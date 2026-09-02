import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { prisma } from '@frego/db';
import { requireAuth, requireCustomerAuth } from '../plugins/auth.js';
import { activeEarnKindsByBusinessIds } from '../lib/earn-kinds.js';
import {
  aggregateCustomerStats,
  progressFromWallet,
} from '../lib/customer-stats.js';
import { deriveWallet } from '../lib/wallet.js';
import { createVoucherMeta, voucherFromMetadata } from '../lib/voucher.js';
import { shouldOmitFromLedger } from '../lib/ledger-meta.js';
import {
  membershipMatchesAudience,
  parseAudienceRules,
  resolveMembershipRecognition,
} from '../lib/audience.js';
import {
  deleteCustomerDeviceTokens,
  replaceCustomerDeviceToken,
} from '../lib/push/device-token.js';

const redeemBody = z.object({
  businessId: z.string().min(1),
  campaignId: z.string().min(1),
  quantity: z.number().int().positive().max(10).optional(),
});

const updateCustomerBody = z.object({
  displayName: z.string().min(1).max(80).optional(),
  birthday: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'YYYY-MM-DD')
    .nullable()
    .optional(),
  /** Marca o onboarding do app como concluído. */
  onboardingCompleted: z.boolean().optional(),
  notificationsEnabled: z.boolean().optional(),
});

const deviceTokenBody = z.object({
  token: z.string().min(10).max(4096),
  platform: z.enum(['ios', 'android']),
});

const deleteDeviceTokenBody = z.object({
  token: z.string().min(10).max(4096),
});

const customerPublicSelect = {
  id: true,
  displayName: true,
  phoneE164: true,
  birthday: true,
  onboardingCompleted: true,
  notificationsEnabled: true,
  createdAt: true,
} as const;

export const meRoutes: FastifyPluginAsync = async (app) => {
  /** Lojas em que o staff autenticado é membro ativo. */
  app.get('/me/businesses', async (request) => {
    const auth = requireAuth(request);

    const member = await prisma.teamMember.findUnique({
      where: { id: auth.teamMemberId },
    });

    const members = await prisma.teamMember.findMany({
      where: {
        status: 'active',
        OR: [
          { firebaseUid: auth.firebaseUid },
          ...(member?.email ? [{ email: member.email }] : []),
        ],
      },
      include: {
        business: {
          select: {
            id: true,
            name: true,
            logoUrl: true,
            heroImageUrl: true,
            primaryColor: true,
            primaryColorDark: true,
            slogan: true,
            slug: true,
            type: true,
            status: true,
            pointsPerReal: true,
            cashbackPercent: true,
          },
        },
      },
      orderBy: { createdAt: 'asc' },
    });

    const seen = new Set<string>();
    const uniqueIds: string[] = [];
    for (const m of members) {
      if (seen.has(m.businessId)) continue;
      seen.add(m.businessId);
      uniqueIds.push(m.businessId);
    }
    const earnKinds = await activeEarnKindsByBusinessIds(uniqueIds);

    const businesses = [];
    const pushed = new Set<string>();
    for (const m of members) {
      if (pushed.has(m.businessId)) continue;
      pushed.add(m.businessId);
      businesses.push({
        ...m.business,
        role: m.role,
        teamMemberId: m.id,
        activeEarnKinds: earnKinds.get(m.businessId) ?? [],
      });
    }

    return {
      businesses,
      currentBusinessId: auth.businessId,
    };
  });

  /** Perfil do cliente autenticado (app). Telefone OTP já vincula/mescla o Customer. */
  app.get('/me/customer', async (request) => {
    const auth = requireCustomerAuth(request);
    const customer = await prisma.customer.findUniqueOrThrow({
      where: { id: auth.customerId },
      select: customerPublicSelect,
    });
    const membershipCount = await prisma.membership.count({
      where: { customerId: auth.customerId },
    });
    return {
      customer,
      membershipCount,
      needsOnboarding: !customer.onboardingCompleted,
      linkedByPhone: true,
    };
  });

  /** Completa / atualiza perfil após o OTP. */
  app.patch('/me/customer', async (request, reply) => {
    const auth = requireCustomerAuth(request);
    const body = updateCustomerBody.parse(request.body);
    if (
      body.displayName === undefined &&
      body.birthday === undefined &&
      body.onboardingCompleted === undefined &&
      body.notificationsEnabled === undefined
    ) {
      return reply.code(400).send({ error: 'NOTHING_TO_UPDATE' });
    }

    const customer = await prisma.customer.update({
      where: { id: auth.customerId },
      data: {
        ...(body.displayName !== undefined
          ? { displayName: body.displayName.trim() }
          : {}),
        ...(body.birthday !== undefined
          ? {
              birthday: body.birthday ? new Date(body.birthday) : null,
            }
          : {}),
        ...(body.onboardingCompleted !== undefined
          ? { onboardingCompleted: body.onboardingCompleted }
          : {}),
        ...(body.notificationsEnabled !== undefined
          ? { notificationsEnabled: body.notificationsEnabled }
          : {}),
      },
      select: customerPublicSelect,
    });

    if (body.notificationsEnabled === false) {
      await deleteCustomerDeviceTokens(auth.customerId);
    }

    const membershipCount = await prisma.membership.count({
      where: { customerId: auth.customerId },
    });

    return {
      customer,
      membershipCount,
      needsOnboarding: !customer.onboardingCompleted,
    };
  });

  /** Register or replace this customer's FCM token for the platform. */
  app.put('/me/device-token', async (request) => {
    const auth = requireCustomerAuth(request);
    const body = deviceTokenBody.parse(request.body);
    const deviceToken = await replaceCustomerDeviceToken({
      customerId: auth.customerId,
      token: body.token,
      platform: body.platform,
    });
    request.log.info(
      {
        customerId: auth.customerId,
        platform: body.platform,
        tokenId: deviceToken.id,
      },
      'device_token_upserted',
    );
    return { deviceToken };
  });

  /** Drop this device's FCM token (logout). */
  app.delete('/me/device-token', async (request) => {
    const auth = requireCustomerAuth(request);
    const body = deleteDeviceTokenBody.parse(request.body);
    await prisma.deviceToken.deleteMany({
      where: { token: body.token, customerId: auth.customerId },
    });
    return { ok: true };
  });

  /** Memberships do cliente (lojas) + pools de carimbos/pontos. */
  app.get('/me/memberships', async (request) => {
    const auth = requireCustomerAuth(request);
    const memberships = await prisma.membership.findMany({
      where: { customerId: auth.customerId },
      include: {
        business: {
          select: {
            id: true,
            name: true,
            logoUrl: true,
            heroImageUrl: true,
            primaryColor: true,
            primaryColorDark: true,
            slogan: true,
            pointsPerReal: true,
            cashbackPercent: true,
            stampsExpireDays: true,
            pointsExpireDays: true,
            status: true,
            type: true,
            locations: {
              select: {
                id: true,
                name: true,
                address: true,
                isOpen: true,
              },
              orderBy: { createdAt: 'asc' },
            },
          },
        },
      },
      orderBy: { associatedAt: 'desc' },
    });

    const withPools = await Promise.all(
      memberships.map(async (m) => {
        const baseWallet = await deriveWallet(m.id, m.businessId);
        const { badges, campaigns } = await resolveMembershipRecognition(
          m.id,
          m.businessId,
          baseWallet,
        );
        const wallet = { ...baseWallet, campaigns };
        const redeemable = wallet.campaigns.filter((c) => c.canRedeem).length;
        const progress = progressFromWallet(wallet);
        const birthday = wallet.campaigns.find((c) => c.type === 'birthday');
        return {
          id: m.id,
          businessId: m.businessId,
          isVip: m.isVip,
          isFavorite: m.isFavorite,
          associatedAt: m.associatedAt,
          business: m.business,
          pools: wallet.pools,
          stampsExpireDays: wallet.stampsExpireDays,
          pointsExpireDays: wallet.pointsExpireDays,
          lots: wallet.lots,
          campaigns: wallet.campaigns,
          badges,
          activeCampaigns: wallet.campaigns.length,
          redeemableCampaigns: redeemable,
          progress,
          birthday: birthday
            ? {
                campaignId: birthday.campaignId,
                canRedeem: birthday.canRedeem,
                daysUntilBirthday: birthday.daysUntilBirthday ?? null,
                lockedReason: birthday.lockedReason ?? null,
                rewardTitle: birthday.rewardTitle,
              }
            : null,
        };
      }),
    );

    withPools.sort((a, b) => {
      if (a.isFavorite !== b.isFavorite) return a.isFavorite ? -1 : 1;
      if (b.redeemableCampaigns !== a.redeemableCampaigns) {
        return b.redeemableCampaigns - a.redeemableCampaigns;
      }
      return (
        new Date(b.associatedAt).getTime() - new Date(a.associatedAt).getTime()
      );
    });

    return { memberships: withPools };
  });

  /** Marca / desmarca loja favorita do cliente. */
  app.patch('/me/memberships/:businessId/favorite', async (request, reply) => {
    const auth = requireCustomerAuth(request);
    const { businessId } = request.params as { businessId: string };
    const body = z.object({ isFavorite: z.boolean() }).parse(request.body);

    const membership = await prisma.membership.findFirst({
      where: { customerId: auth.customerId, businessId },
    });
    if (!membership) {
      return reply.code(404).send({ error: 'MEMBERSHIP_NOT_FOUND' });
    }

    const updated = await prisma.membership.update({
      where: { id: membership.id },
      data: { isFavorite: body.isFavorite },
      select: {
        id: true,
        businessId: true,
        isFavorite: true,
      },
    });

    return updated;
  });

  /**
   * Resumo de uso do cliente (todas as lojas).
   * Visitas = dias únicos com alguma transação.
   */
  app.get('/me/stats', async (request) => {
    const auth = requireCustomerAuth(request);
    const stats = await aggregateCustomerStats(auth.customerId);
    return {
      shops: stats.shops,
      visits: stats.visits,
      lastVisitAt: stats.lastVisitAt,
      stampsEarned: stats.stampsEarned,
      pointsEarned: stats.pointsEarned,
      redeems: stats.redeems,
      spendCents: stats.spendCents,
      cashbackEarnedCents: stats.cashbackEarnedCents,
      cashbackSpentCents: stats.cashbackSpentCents,
      redeemableNow: stats.redeemableNow,
      nextReward: stats.nextReward,
    };
  });

  /**
   * Carteira do cliente em uma loja.
   * Query: businessId (obrigatório se tiver mais de um membership).
   */
  app.get('/me/wallet', async (request, reply) => {
    const auth = requireCustomerAuth(request);
    const query = request.query as { businessId?: string };

    const memberships = await prisma.membership.findMany({
      where: { customerId: auth.customerId },
      include: {
        business: {
          select: {
            id: true,
            name: true,
            logoUrl: true,
            heroImageUrl: true,
            primaryColor: true,
            primaryColorDark: true,
            slogan: true,
            pointsPerReal: true,
            cashbackPercent: true,
            stampsExpireDays: true,
            pointsExpireDays: true,
            type: true,
            locations: {
              select: {
                id: true,
                name: true,
                address: true,
                isOpen: true,
              },
              orderBy: { createdAt: 'asc' },
            },
          },
        },
      },
      orderBy: { associatedAt: 'desc' },
    });

    if (memberships.length === 0) {
      return reply.code(404).send({ error: 'NO_MEMBERSHIP' });
    }

    let membership = query.businessId
      ? memberships.find((m) => m.businessId === query.businessId)
      : memberships[0];

    if (!membership) {
      return reply.code(404).send({ error: 'MEMBERSHIP_NOT_FOUND' });
    }

    const baseWallet = await deriveWallet(membership.id, membership.businessId);
    const { badges, campaigns } = await resolveMembershipRecognition(
      membership.id,
      membership.businessId,
      baseWallet,
    );
    const wallet = { ...baseWallet, campaigns };

    return {
      business: membership.business,
      membership: {
        id: membership.id,
        isVip: membership.isVip,
        isFavorite: membership.isFavorite,
      },
      badges,
      wallet,
      pools: wallet.pools,
      campaigns: wallet.campaigns,
      memberships: memberships.map((m) => ({
        id: m.id,
        businessId: m.businessId,
        name: m.business.name,
        logoUrl: m.business.logoUrl,
        isFavorite: m.isFavorite,
      })),
    };
  });

  /** Cliente escolhe campanha e resgata do pool. */
  app.post('/me/redeem', async (request, reply) => {
    const auth = requireCustomerAuth(request);
    const body = redeemBody.parse(request.body);
    const quantity = body.quantity ?? 1;

    const membership = await prisma.membership.findFirst({
      where: {
        customerId: auth.customerId,
        businessId: body.businessId,
      },
    });
    if (!membership) {
      return reply.code(404).send({ error: 'MEMBERSHIP_NOT_FOUND' });
    }

    const campaign = await prisma.campaign.findFirst({
      where: {
        id: body.campaignId,
        businessId: body.businessId,
        status: 'active',
        type: { in: ['stamps', 'spend', 'birthday'] },
      },
      include: {
        audienceSegment: { select: { id: true, rules: true } },
      },
    });
    if (!campaign) {
      return reply.code(400).send({ error: 'INVALID_CAMPAIGN' });
    }

    if (campaign.audienceSegment) {
      const rules = parseAudienceRules(campaign.audienceSegment.rules);
      const eligible = await membershipMatchesAudience(
        membership.id,
        body.businessId,
        rules,
      );
      if (!eligible) {
        return reply.code(403).send({
          error: 'AUDIENCE_NOT_ELIGIBLE',
          audienceSegmentId: campaign.audienceSegment.id,
        });
      }
    }

    if (campaign.type === 'birthday' && quantity !== 1) {
      return reply.code(400).send({ error: 'BIRTHDAY_QUANTITY_MUST_BE_ONE' });
    }

    const wallet = await deriveWallet(membership.id, body.businessId);
    const entry = wallet.campaigns.find((c) => c.campaignId === campaign.id);
    if (!entry || entry.rewardsAvailable < quantity || !entry.canRedeem) {
      return reply.code(409).send({
        error:
          entry?.lockedReason === 'no_birthday'
            ? 'BIRTHDAY_REQUIRED'
            : entry?.lockedReason === 'already_redeemed'
              ? 'BIRTHDAY_ALREADY_REDEEMED'
              : entry?.lockedReason === 'outside_window'
                ? 'BIRTHDAY_OUTSIDE_WINDOW'
                : entry?.lockedReason === 'audience'
                  ? 'AUDIENCE_NOT_ELIGIBLE'
                  : 'NO_REWARD_AVAILABLE',
        lockedReason: entry?.lockedReason ?? null,
        unlocksAt: entry?.unlocksAt ?? null,
        wallet,
        pools: wallet.pools,
      });
    }

    const location =
      (await prisma.location.findFirst({
        where: { businessId: body.businessId, isOpen: true },
        orderBy: { createdAt: 'asc' },
      })) ??
      (await prisma.location.findFirst({
        where: { businessId: body.businessId },
        orderBy: { createdAt: 'asc' },
      }));
    if (!location) {
      return reply.code(400).send({ error: 'NO_LOCATION' });
    }

    const voucher = createVoucherMeta();

    const tx = await prisma.transaction.create({
      data: {
        businessId: body.businessId,
        membershipId: membership.id,
        campaignId: campaign.id,
        locationId: location.id,
        actorTeamMemberId: null,
        actorCustomerId: auth.customerId,
        type: 'redeem',
        quantity,
        unitKind: null,
        metadata: voucher,
      },
    });

    const next = await deriveWallet(membership.id, body.businessId);
    const rewardTitle = campaign.rewardTitle ?? campaign.name;

    return reply.code(201).send({
      transaction: tx,
      voucherCode: voucher.voucherCode,
      voucherDisplay: voucher.voucherDisplay,
      voucherExpiresAt: voucher.expiresAt,
      voucherStatus: 'open' as const,
      rewardTitle,
      campaignName: campaign.name,
      businessId: body.businessId,
      wallet: next,
      pools: next.pools,
      campaigns: next.campaigns,
      message: `Resgatou: ${rewardTitle}`,
    });
  });

  /**
   * Histórico do cliente (todas as lojas).
   * Query: `limit` (default 50, max 100).
   * Também devolve `lots`: saldo restante por lote (ganho + validade) em todas as lojas.
   */
  app.get('/me/history', async (request) => {
    const auth = requireCustomerAuth(request);
    const query = request.query as { limit?: string };
    const limit = Math.min(
      Math.max(Number.parseInt(query.limit ?? '50', 10) || 50, 1),
      100,
    );

    const memberships = await prisma.membership.findMany({
      where: { customerId: auth.customerId },
      select: {
        id: true,
        businessId: true,
        business: {
          select: {
            id: true,
            name: true,
            logoUrl: true,
            primaryColor: true,
            stampsExpireDays: true,
            pointsExpireDays: true,
          },
        },
      },
    });
    const membershipIds = memberships.map((m) => m.id);
    if (membershipIds.length === 0) {
      return { items: [], lots: [] };
    }

    const [txs, wallets] = await Promise.all([
      prisma.transaction.findMany({
        where: { membershipId: { in: membershipIds } },
        orderBy: { createdAt: 'desc' },
        take: limit,
        include: {
          business: {
            select: {
              id: true,
              name: true,
              logoUrl: true,
              primaryColor: true,
              stampsExpireDays: true,
              pointsExpireDays: true,
            },
          },
          campaign: {
            select: { name: true, rewardTitle: true, type: true },
          },
          location: { select: { name: true } },
          actorTeamMember: { select: { displayName: true } },
        },
      }),
      Promise.all(
        memberships.map(async (m) => ({
          membership: m,
          wallet: await deriveWallet(m.id, m.businessId),
        })),
      ),
    ]);

    const lots = wallets
      .flatMap(({ membership, wallet }) =>
        wallet.lots.map((lot) => ({
          ...lot,
          businessId: membership.businessId,
          business: {
            id: membership.business.id,
            name: membership.business.name,
            logoUrl: membership.business.logoUrl,
            primaryColor: membership.business.primaryColor,
          },
        })),
      )
      .sort((a, b) => {
        if (a.expiresAt == null && b.expiresAt == null) {
          return a.earnedAt.localeCompare(b.earnedAt);
        }
        if (a.expiresAt == null) return 1;
        if (b.expiresAt == null) return -1;
        return a.expiresAt.localeCompare(b.expiresAt);
      });

    const items = txs
      .filter((tx) => !shouldOmitFromLedger(tx.metadata))
      .map((tx) => {
      const voucher = voucherFromMetadata(tx.metadata, {
        createdAt: tx.createdAt,
      });
      const expireDays =
        tx.unitKind === 'points'
          ? tx.business.pointsExpireDays
          : tx.unitKind === 'stamps'
            ? tx.business.stampsExpireDays
            : tx.amountCents != null && tx.amountCents > 0
              ? tx.business.pointsExpireDays
              : tx.business.stampsExpireDays;
      let expiresAt: string | null = null;
      if (tx.type === 'stamp' && expireDays != null && expireDays > 0) {
        const earned = new Date(tx.createdAt);
        const day = new Date(
          Date.UTC(
            earned.getUTCFullYear(),
            earned.getUTCMonth(),
            earned.getUTCDate(),
          ),
        );
        day.setUTCDate(day.getUTCDate() + expireDays);
        expiresAt = day.toISOString().slice(0, 10);
      }
      return {
        id: tx.id,
        type: tx.type,
        quantity: tx.quantity,
        unitKind: tx.unitKind,
        amountCents: tx.amountCents,
        createdAt: tx.createdAt,
        expiresAt,
        business: {
          id: tx.business.id,
          name: tx.business.name,
          logoUrl: tx.business.logoUrl,
          primaryColor: tx.business.primaryColor,
        },
        campaign: tx.campaign,
        location: tx.location,
        actorName: tx.actorTeamMember?.displayName ?? null,
        voucherCode: voucher?.voucherCode ?? null,
        voucherDisplay: voucher?.voucherDisplay ?? null,
        voucherStatus: voucher?.status ?? null,
        voucherUsedAt: voucher?.usedAt ?? null,
        voucherExpiresAt: voucher?.expiresAt ?? null,
        rewardTitle:
          tx.campaign?.rewardTitle ?? tx.campaign?.name ?? null,
      };
    });

    return { items, lots };
  });
};
