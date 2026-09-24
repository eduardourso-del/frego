import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { prisma, CampaignStatus, CampaignType } from '@frego/db';
import { requireAuth } from '../plugins/auth.js';
import {
  computeCampaignPerformance,
  countMembershipsByRules,
  parseAudienceRules,
} from '../lib/audience.js';
import {
  queueCampaignAudiencePush,
  shouldQueueCampaignAudiencePush,
} from '../lib/push/campaign-notify.js';
import { civilYmd, normalizeWeekdays } from '../lib/promo.js';

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

const isoDay = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

const campaignFields = z.object({
  name: z.string().min(1).max(80),
  type: z
    .enum(['stamps', 'spend', 'birthday', 'cashback', 'promo'])
    .default('stamps'),
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
  startsOn: z
    .union([isoDay, z.literal(''), z.null()])
    .optional()
    .transform((v) => (v === '' || v === undefined ? undefined : v)),
  endsOn: z
    .union([isoDay, z.literal(''), z.null()])
    .optional()
    .transform((v) => (v === '' || v === undefined ? undefined : v)),
  weekdays: z.array(z.number().int().min(0).max(6)).max(7).optional(),
  redeemMax: z
    .union([z.number().int().min(1).max(999), z.null()])
    .optional(),
  redeemPeriod: z
    .union([
      z.enum(['day', 'week', 'month', 'year', 'campaign']),
      z.null(),
    ])
    .optional(),
});

function parseDateOnly(value: string | null | undefined): Date | null | undefined {
  if (value === undefined) return undefined;
  if (value === null) return null;
  return new Date(`${value}T00:00:00.000Z`);
}

function noMetaType(type: string) {
  return type === 'birthday' || type === 'cashback' || type === 'promo';
}

function promoError(
  body: {
    type: string;
    startsOn?: string | null;
    endsOn?: string | null;
    redeemMax?: number | null;
    redeemPeriod?: string | null;
    rewardTitle?: string;
  },
): string | null {
  if (body.type !== 'promo' && body.type !== 'stamps') return null;
  if (body.type === 'promo' && !(body.rewardTitle?.trim())) {
    return 'REWARD_TITLE_REQUIRED';
  }
  if (body.type === 'promo') {
    const start = body.startsOn ?? null;
    const end = body.endsOn ?? null;
    if (start && end && start > end) return 'INVALID_PROMO_DATES';
  }
  if (body.redeemMax != null && !body.redeemPeriod) {
    return 'REDEEM_PERIOD_REQUIRED';
  }
  return null;
}

type RedeemPeriod = 'day' | 'week' | 'month' | 'year' | 'campaign';

function asRedeemPeriod(value: string | null | undefined): RedeemPeriod | null {
  if (
    value === 'day' ||
    value === 'week' ||
    value === 'month' ||
    value === 'year' ||
    value === 'campaign'
  ) {
    return value;
  }
  return null;
}

function stampQuotaWrite(
  body: {
    redeemMax?: number | null;
    redeemPeriod?: RedeemPeriod | null;
  },
  existing?: {
    type: string;
    redeemMax: number | null;
    redeemPeriod: string | null;
  },
) {
  const treatAsCreate = !existing || existing.type !== 'stamps';
  if (body.redeemMax === null) {
    return { redeemMax: null as number | null, redeemPeriod: null as RedeemPeriod | null };
  }
  if (body.redeemMax === undefined && body.redeemPeriod === undefined) {
    if (treatAsCreate) {
      return { redeemMax: null as number | null, redeemPeriod: null as RedeemPeriod | null };
    }
    return {
      redeemMax: existing.redeemMax,
      redeemPeriod: asRedeemPeriod(existing.redeemPeriod),
    };
  }
  const redeemMax =
    body.redeemMax !== undefined ? body.redeemMax : (existing?.redeemMax ?? null);
  const redeemPeriod =
    redeemMax == null
      ? null
      : body.redeemPeriod !== undefined
        ? body.redeemPeriod
        : asRedeemPeriod(existing?.redeemPeriod);
  return { redeemMax, redeemPeriod };
}

function promoWriteData(
  body: {
    type?: string;
    startsOn?: string | null;
    endsOn?: string | null;
    weekdays?: number[];
    redeemMax?: number | null;
    redeemPeriod?: 'day' | 'week' | 'month' | 'year' | 'campaign' | null;
  },
  existing?: {
    type: string;
    startsOn: Date | null;
    endsOn: Date | null;
    weekdays: number[];
    redeemMax: number | null;
    redeemPeriod: string | null;
  },
) {
  const type = body.type ?? existing?.type ?? 'stamps';
  if (type === 'stamps') {
    const quota = stampQuotaWrite(body, existing);
    return {
      startsOn: null as Date | null,
      endsOn: null as Date | null,
      weekdays: [] as number[],
      redeemMax: quota.redeemMax,
      redeemPeriod: quota.redeemPeriod,
    };
  }
  if (type !== 'promo') {
    return {
      startsOn: null as Date | null,
      endsOn: null as Date | null,
      weekdays: [] as number[],
      redeemMax: null as number | null,
      redeemPeriod: null as null,
    };
  }

  const treatAsCreate = !existing || existing.type !== 'promo';
  const startsOn =
    body.startsOn !== undefined
      ? parseDateOnly(body.startsOn) ?? null
      : treatAsCreate
        ? null
        : existing.startsOn;
  const endsOn =
    body.endsOn !== undefined
      ? parseDateOnly(body.endsOn) ?? null
      : treatAsCreate
        ? null
        : existing.endsOn;
  const weekdays =
    body.weekdays !== undefined
      ? normalizeWeekdays(body.weekdays)
      : treatAsCreate
        ? []
        : normalizeWeekdays(existing.weekdays);
  const defaultLimit =
    treatAsCreate && body.redeemMax === undefined && body.redeemPeriod === undefined;
  const redeemMax =
    body.redeemMax !== undefined
      ? body.redeemMax
      : defaultLimit
        ? 1
        : treatAsCreate
          ? 1
          : existing.redeemMax;
  const redeemPeriod =
    body.redeemMax === null
      ? null
      : body.redeemPeriod !== undefined
        ? body.redeemPeriod
        : defaultLimit || treatAsCreate
          ? 'campaign'
          : (existing.redeemPeriod as
              | 'day'
              | 'week'
              | 'month'
              | 'year'
              | 'campaign'
              | null);

  return { startsOn, endsOn, weekdays, redeemMax, redeemPeriod };
}

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
    const promoErr = promoError(body);
    if (promoErr) {
      return reply.code(400).send({ error: promoErr });
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

    const stampsNeeded = noMetaType(body.type)
      ? 1
      : (body.stampsNeeded ?? (body.type === 'spend' ? 100 : 10));
    const promo = promoWriteData(body);

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
        startsOn: promo.startsOn,
        endsOn: promo.endsOn,
        weekdays: promo.weekdays,
        redeemMax: promo.redeemMax,
        redeemPeriod: promo.redeemPeriod,
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

    if (
      shouldQueueCampaignAudiencePush({
        previousStatus: null,
        nextStatus: campaign.status,
        audienceSegmentId: campaign.audienceSegmentId,
      })
    ) {
      queueCampaignAudiencePush({
        campaignId: campaign.id,
        businessId: auth.businessId,
        log: (msg, extra) => request.log.info(extra ?? {}, msg),
      });
    }

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
    if (
      (nextType === 'birthday' || nextType === 'promo') &&
      !(nextReward?.trim())
    ) {
      return reply.code(400).send({ error: 'REWARD_TITLE_REQUIRED' });
    }
    const promoErr = promoError({
      type: nextType,
      startsOn:
        body.startsOn !== undefined
          ? body.startsOn
          : civilYmd(existing.startsOn),
      endsOn:
        body.endsOn !== undefined ? body.endsOn : civilYmd(existing.endsOn),
      redeemMax:
        body.redeemMax !== undefined ? body.redeemMax : existing.redeemMax,
      redeemPeriod:
        body.redeemPeriod !== undefined
          ? body.redeemPeriod
          : existing.redeemPeriod,
      rewardTitle: nextReward ?? undefined,
    });
    if (promoErr) {
      return reply.code(400).send({ error: promoErr });
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

    const {
      locationIds,
      audienceSegmentId,
      startsOn: _startsOn,
      endsOn: _endsOn,
      weekdays: _weekdays,
      redeemMax: _redeemMax,
      redeemPeriod: _redeemPeriod,
      ...data
    } = body;
    const promo = promoWriteData({ ...body, type: nextType }, existing);
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
          stampsNeeded: noMetaType(nextType)
            ? 1
            : (data.stampsNeeded ?? existing.stampsNeeded),
          pointsPerReal:
            nextType === 'stamps' ||
            nextType === 'birthday' ||
            nextType === 'cashback' ||
            nextType === 'promo'
              ? null
              : (data.pointsPerReal ?? existing.pointsPerReal ?? 1),
          cashbackPercent:
            nextType === 'cashback'
              ? (data.cashbackPercent ?? existing.cashbackPercent ?? 0)
              : null,
          startsOn: promo.startsOn,
          endsOn: promo.endsOn,
          weekdays: promo.weekdays,
          redeemMax: promo.redeemMax,
          redeemPeriod: promo.redeemPeriod,
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

    const nextAudienceId =
      audienceSegmentId !== undefined
        ? audienceSegmentId
        : existing.audienceSegmentId;
    if (
      shouldQueueCampaignAudiencePush({
        previousStatus: existing.status,
        nextStatus: campaign.status,
        audienceSegmentId: nextAudienceId,
        alreadySent: Boolean(existing.audiencePushSentAt),
      })
    ) {
      queueCampaignAudiencePush({
        campaignId: campaign.id,
        businessId: auth.businessId,
        log: (msg, extra) => request.log.info(extra ?? {}, msg),
      });
    }

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
    await prisma.campaign.delete({ where: { id } });
    return { ok: true };
  });
};
