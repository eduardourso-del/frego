import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { prisma, CampaignStatus, CampaignType } from '@frego/db';
import { requireAuth } from '../plugins/auth.js';

const campaignFields = z.object({
  name: z.string().min(1).max(80),
  type: z.enum(['stamps', 'spend', 'birthday']).default('stamps'),
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
});

async function assertSingleActiveBirthday(
  businessId: string,
  status: CampaignStatus | string | undefined,
  type: string,
  excludeId?: string,
) {
  if (type !== 'birthday' || status !== 'active') return null;
  const existing = await prisma.campaign.findFirst({
    where: {
      businessId,
      type: 'birthday',
      status: 'active',
      ...(excludeId ? { id: { not: excludeId } } : {}),
    },
    select: { id: true, name: true },
  });
  return existing;
}

export const campaignRoutes: FastifyPluginAsync = async (app) => {
  app.get('/campaigns', async (request) => {
    const auth = requireAuth(request);
    const campaigns = await prisma.campaign.findMany({
      where: { businessId: auth.businessId },
      include: { locations: true },
      orderBy: { createdAt: 'desc' },
    });
    return { campaigns };
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
    if (body.type === 'birthday' && !(body.rewardTitle?.trim())) {
      return reply.code(400).send({ error: 'REWARD_TITLE_REQUIRED' });
    }

    const dup = await assertSingleActiveBirthday(
      auth.businessId,
      status,
      body.type,
    );
    if (dup) {
      return reply.code(409).send({
        error: 'BIRTHDAY_CAMPAIGN_EXISTS',
        existingId: dup.id,
        existingName: dup.name,
      });
    }

    const stampsNeeded =
      body.type === 'birthday'
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
        rewardTitle: body.rewardTitle,
        rewardDescription: body.rewardDescription,
        rewardImageUrl:
          body.rewardImageUrl === undefined ? undefined : body.rewardImageUrl,
        locations: body.locationIds?.length
          ? {
              create: body.locationIds.map((locationId) => ({ locationId })),
            }
          : undefined,
      },
      include: { locations: true },
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

    const nextReward =
      body.rewardTitle !== undefined ? body.rewardTitle : existing.rewardTitle;
    if (nextType === 'birthday' && !(nextReward?.trim())) {
      return reply.code(400).send({ error: 'REWARD_TITLE_REQUIRED' });
    }

    const dup = await assertSingleActiveBirthday(
      auth.businessId,
      nextStatus,
      nextType,
      id,
    );
    if (dup) {
      return reply.code(409).send({
        error: 'BIRTHDAY_CAMPAIGN_EXISTS',
        existingId: dup.id,
        existingName: dup.name,
      });
    }

    const { locationIds, ...data } = body;
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
            nextType === 'birthday'
              ? 1
              : (data.stampsNeeded ?? existing.stampsNeeded),
          pointsPerReal:
            nextType === 'stamps' || nextType === 'birthday'
              ? null
              : (data.pointsPerReal ?? existing.pointsPerReal ?? 1),
        },
        include: { locations: true },
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
