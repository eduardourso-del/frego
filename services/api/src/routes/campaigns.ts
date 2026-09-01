import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { prisma, CampaignStatus, CampaignType } from '@frego/db';
import { requireAuth } from '../plugins/auth.js';
import {
  computeCampaignPerformance,
  countMembershipsByRules,
  parseAudienceRules,
} from '../lib/audience.js';

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

function performanceRange(range: '7d' | '30d' | '90d', now = new Date()) {
  const days = range === '7d' ? 7 : range === '30d' ? 30 : 90;
  const to = now;
  const from = addDays(startOfDay(now), -(days - 1));
  return { from, to, days };
}

const campaignFields = z.object({
  name: z.string().min(1).max(80),
  type: z.enum(['stamps', 'spend', 'birthday', 'cashback']).default('stamps'),
  status: z.nativeEnum(CampaignStatus).optional(),
  stampsNeeded: z.number().int().positive().max(10_000).optional(),
  pointsPerReal: z.number().int().positive().max(100).optional(),
  rewardTitle: z.string().max(80).optional(),
  rewardDescription: z.string().max(200).optional(),
  rewardImageUrl: z
    .union([z.string().url().max(2000), z.literal(''), z.null()])
    .optional()
    .transform((v) => (v === '' || v === undefined ? undefined : v)),
  locationIds: z.array(z.string()).optional(),
  cashbackPercent: z.number().int().min(0).max(100).optional(),
  audienceSegmentId: z
    .union([z.string().min(1), z.literal(''), z.null()])
    .optional()
    .transform((v) => (v === '' ? null : v === undefined ? undefined : v)),
});

async function assertAudienceBelongs(
  businessId: string,
  audienceSegmentId: string | null | undefined,
) {
  if (!audienceSegmentId) return true;
  const seg = await prisma.audienceSegment.findFirst({
    where: { id: audienceSegmentId, businessId },
    select: { id: true },
  });
  return Boolean(seg);
}

async function assertSingleActiveOfType(
  businessId: string,
  status: CampaignStatus | string | undefined,
  type: string,
  onlyType: 'birthday' | 'cashback',
  excludeId?: string,
) {
  if (type !== onlyType || status !== 'active') return null;
  const existing = await prisma.campaign.findFirst({
    where: {
      businessId,
      type: onlyType,
      status: 'active',
      ...(excludeId ? { id: { not: excludeId } } : {}),
    },
    select: { id: true, name: true },
  });
  return existing;
}

async function assertSingleActiveBirthday(
  businessId: string,
  status: CampaignStatus | string | undefined,
  type: string,
  excludeId?: string,
) {
  return assertSingleActiveOfType(
    businessId,
    status,
    type,
    'birthday',
    excludeId,
  );
}

export const campaignRoutes: FastifyPluginAsync = async (app) => {
  app.get('/campaigns', async (request) => {
    const auth = requireAuth(request);
    const campaigns = await prisma.campaign.findMany({
      where: { businessId: auth.businessId },
      include: {
        locations: true,
        audienceSegment: {
          select: { id: true, name: true, rules: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    const withAudience = await Promise.all(
      campaigns.map(async (c) => {
        let audienceMemberCount: number | null = null;
        if (c.audienceSegment) {
          audienceMemberCount = await countMembershipsByRules(
            auth.businessId,
            parseAudienceRules(c.audienceSegment.rules),
          );
        }
        return {
          ...c,
          audienceSegment: c.audienceSegment
            ? {
                id: c.audienceSegment.id,
                name: c.audienceSegment.name,
                memberCount: audienceMemberCount,
              }
            : null,
          audienceMemberCount,
        };
      }),
    );

    return { campaigns: withAudience };
  });

  app.get('/campaigns/:id/performance', async (request, reply) => {
    const auth = requireAuth(request);
    const { id } = request.params as { id: string };
    const { range } = z
      .object({ range: z.enum(['7d', '30d', '90d']).default('30d') })
      .parse(request.query);
    const window = performanceRange(range);
    const performance = await computeCampaignPerformance(
      auth.businessId,
      id,
      window,
    );
    if (!performance) {
      return reply.code(404).send({ error: 'NOT_FOUND' });
    }
    return {
      range,
      from: window.from.toISOString(),
      to: window.to.toISOString(),
      performance,
    };
  });

  app.post('/campaigns', async (request, reply) => {
    const auth = requireAuth(request);
    if (auth.role === 'employee') {
      return reply.code(403).send({ error: 'FORBIDDEN' });
    }
    const body = campaignFields.parse(request.body);
    const status = body.status ?? CampaignStatus.draft;

    if (body.type === 'spend' && status === 'active' && !body.pointsPerReal) {
      return reply.code(400).send({ error: 'POINTS_PER_REAL_REQUIRED' });
    }
    if (body.type === 'cashback' && status === 'active' && !(body.cashbackPercent && body.cashbackPercent > 0)) {
      return reply.code(400).send({ error: 'CASHBACK_PERCENT_REQUIRED' });
    }
    if (body.type === 'birthday' && !(body.rewardTitle?.trim())) {
      return reply.code(400).send({ error: 'REWARD_TITLE_REQUIRED' });
    }

    if (
      body.audienceSegmentId &&
      !(await assertAudienceBelongs(auth.businessId, body.audienceSegmentId))
    ) {
      return reply.code(400).send({ error: 'INVALID_AUDIENCE' });
    }

    const dupBirthday = await assertSingleActiveBirthday(
      auth.businessId,
      status,
      body.type,
    );
    if (dupBirthday) {
      return reply.code(409).send({
        error: 'BIRTHDAY_CAMPAIGN_EXISTS',
        existingId: dupBirthday.id,
        existingName: dupBirthday.name,
      });
    }

    const stampsNeeded =
      body.type === 'birthday' || body.type === 'cashback'
        ? 1
        : (body.stampsNeeded ?? (body.type === 'spend' ? 100 : 10));

    const campaign = await prisma.campaign.create({
      data: {
        businessId: auth.businessId,
        name: body.name,
        type: body.type as CampaignType,
        status,
        stampsNeeded,
        pointsPerReal:
          body.type === 'spend' ? (body.pointsPerReal ?? 1) : null,
        cashbackPercent:
          body.type === 'cashback' ? (body.cashbackPercent ?? 0) : null,
        rewardTitle: body.rewardTitle,
        rewardDescription: body.rewardDescription,
        rewardImageUrl:
          body.rewardImageUrl === undefined ? undefined : body.rewardImageUrl,
        audienceSegmentId: body.audienceSegmentId ?? null,
        locations: body.locationIds?.length
          ? {
              create: body.locationIds.map((locationId) => ({ locationId })),
            }
          : undefined,
      },
      include: {
        locations: true,
        audienceSegment: { select: { id: true, name: true } },
      },
    });

    return reply.code(201).send({ campaign });
  });

  app.patch('/campaigns/:id', async (request, reply) => {
    const auth = requireAuth(request);
    if (auth.role === 'employee') {
      return reply.code(403).send({ error: 'FORBIDDEN' });
    }
    const { id } = request.params as { id: string };
    const body = campaignFields.partial().parse(request.body);

    const existing = await prisma.campaign.findFirst({
      where: { id, businessId: auth.businessId },
    });
    if (!existing) {
      return reply.code(404).send({ error: 'NOT_FOUND' });
    }

    const nextType = body.type ?? existing.type;
    const nextStatus = body.status ?? existing.status;

    if (
      nextType === 'spend' &&
      nextStatus === 'active' &&
      body.pointsPerReal == null &&
      existing.pointsPerReal == null
    ) {
      return reply.code(400).send({ error: 'POINTS_PER_REAL_REQUIRED' });
    }

    const nextCashbackPercent =
      body.cashbackPercent !== undefined
        ? body.cashbackPercent
        : existing.cashbackPercent;
    if (
      nextType === 'cashback' &&
      nextStatus === 'active' &&
      !(nextCashbackPercent && nextCashbackPercent > 0)
    ) {
      return reply.code(400).send({ error: 'CASHBACK_PERCENT_REQUIRED' });
    }

    const nextReward =
      body.rewardTitle !== undefined ? body.rewardTitle : existing.rewardTitle;
    if (nextType === 'birthday' && !(nextReward?.trim())) {
      return reply.code(400).send({ error: 'REWARD_TITLE_REQUIRED' });
    }

    if (
      body.audienceSegmentId &&
      !(await assertAudienceBelongs(auth.businessId, body.audienceSegmentId))
    ) {
      return reply.code(400).send({ error: 'INVALID_AUDIENCE' });
    }

    const dupBirthday = await assertSingleActiveBirthday(
      auth.businessId,
      nextStatus,
      nextType,
      id,
    );
    if (dupBirthday) {
      return reply.code(409).send({
        error: 'BIRTHDAY_CAMPAIGN_EXISTS',
        existingId: dupBirthday.id,
        existingName: dupBirthday.name,
      });
    }

    const { locationIds, audienceSegmentId, ...data } = body;
    const campaign = await prisma.$transaction(async (tx) => {
      if (locationIds) {
        await tx.campaignLocation.deleteMany({ where: { campaignId: id } });
        if (locationIds.length) {
          await tx.campaignLocation.createMany({
            data: locationIds.map((locationId: string) => ({
              campaignId: id,
              locationId,
            })),
          });
        }
      }
      return tx.campaign.update({
        where: { id },
        data: {
          ...data,
          type: data.type as CampaignType | undefined,
          stampsNeeded:
            nextType === 'birthday' || nextType === 'cashback'
              ? 1
              : (data.stampsNeeded ?? existing.stampsNeeded),
          pointsPerReal:
            nextType === 'stamps' ||
            nextType === 'birthday' ||
            nextType === 'cashback'
              ? null
              : (data.pointsPerReal ?? existing.pointsPerReal ?? 1),
          cashbackPercent:
            nextType === 'cashback'
              ? (data.cashbackPercent ?? existing.cashbackPercent ?? 0)
              : null,
          ...(audienceSegmentId !== undefined
            ? { audienceSegmentId }
            : {}),
        },
        include: {
          locations: true,
          audienceSegment: { select: { id: true, name: true } },
        },
      });
    });

    return { campaign };
  });

  app.delete('/campaigns/:id', async (request, reply) => {
    const auth = requireAuth(request);
    if (auth.role === 'employee') {
      return reply.code(403).send({ error: 'FORBIDDEN' });
    }
    const { id } = request.params as { id: string };
    const existing = await prisma.campaign.findFirst({
      where: { id, businessId: auth.businessId },
    });
    if (!existing) {
      return reply.code(404).send({ error: 'NOT_FOUND' });
    }
    const campaign = await prisma.campaign.update({
      where: { id },
      data: { status: CampaignStatus.archived },
    });
    return { campaign };
  });
};
