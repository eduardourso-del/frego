import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { prisma } from '@frego/db';
import { requireAuth } from '../plugins/auth.js';
import {
  AUDIENCE_PRESETS,
  audienceRulesSchema,
  computeSpendTiers,
  countMembershipsByRules,
  customerFacingBadgeTitle,
  filterMembershipsByRules,
  parseAudienceRules,
} from '../lib/audience.js';

const badgeFields = {
  showBadge: z.boolean().optional(),
  badgeTitle: z.string().max(60).nullable().optional(),
  badgeMessage: z.string().max(160).nullable().optional(),
};

const createBody = z.object({
  name: z.string().min(1).max(80),
  rules: audienceRulesSchema,
  ...badgeFields,
});

const patchBody = z.object({
  name: z.string().min(1).max(80).optional(),
  rules: audienceRulesSchema.optional(),
  ...badgeFields,
});

const previewBody = z.object({
  rules: audienceRulesSchema,
});

function serializeAudience(
  segment: {
    id: string;
    name: string;
    rules: unknown;
    showBadge: boolean;
    badgeTitle: string | null;
    badgeMessage: string | null;
    createdAt: Date;
    updatedAt: Date;
  },
  memberCount: number,
) {
  return {
    id: segment.id,
    name: segment.name,
    rules: parseAudienceRules(segment.rules),
    showBadge: segment.showBadge,
    badgeTitle: segment.badgeTitle,
    badgeMessage: segment.badgeMessage,
    memberCount,
    createdAt: segment.createdAt,
    updatedAt: segment.updatedAt,
  };
}

export const audienceRoutes: FastifyPluginAsync = async (app) => {
  app.get('/audiences', async (request) => {
    const auth = requireAuth(request);
    const segments = await prisma.audienceSegment.findMany({
      where: { businessId: auth.businessId },
      orderBy: { createdAt: 'desc' },
    });

    const withCounts = await Promise.all(
      segments.map(async (s) => {
        const rules = parseAudienceRules(s.rules);
        const memberCount = await countMembershipsByRules(
          auth.businessId,
          rules,
        );
        return serializeAudience(s, memberCount);
      }),
    );

    return { audiences: withCounts };
  });

  app.get('/audiences/presets', async (request) => {
    const auth = requireAuth(request);
    const presets = await Promise.all(
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
          suggestedBadgeTitle:
            p.key === 'high_value'
              ? 'Cliente da casa'
              : p.key === 'vip'
                ? 'VIP da casa'
                : p.key === 'near_reward'
                  ? 'Quase lá'
                  : p.key === 'at_risk'
                    ? 'De volta à casa'
                    : 'Cliente da casa',
          suggestedBadgeMessage:
            p.key === 'at_risk'
              ? 'Que bom te ver de novo — preparamos algo especial para quem faz parte da casa.'
              : 'A loja reconhece você — desbloqueamos condições especiais para quem volta e faz parte da casa.',
        };
      }),
    );
    const spendTiers = await computeSpendTiers(auth.businessId, 90);
    return { presets, spendTiers };
  });

  app.post('/audiences/preview', async (request) => {
    const auth = requireAuth(request);
    const body = previewBody.parse(request.body);
    const rules = parseAudienceRules(body.rules);
    const memberCount = await countMembershipsByRules(auth.businessId, rules);
    return { memberCount, rules };
  });

  app.post('/audiences', async (request, reply) => {
    const auth = requireAuth(request);
    if (auth.role === 'employee') {
      return reply.code(403).send({ error: 'FORBIDDEN' });
    }
    const body = createBody.parse(request.body);
    const rules = parseAudienceRules(body.rules);
    const showBadge = body.showBadge ?? false;
    const segment = await prisma.audienceSegment.create({
      data: {
        businessId: auth.businessId,
        name: body.name,
        rules,
        showBadge,
        badgeTitle:
          body.badgeTitle === undefined
            ? showBadge
              ? customerFacingBadgeTitle(null, body.name)
              : null
            : body.badgeTitle
              ? customerFacingBadgeTitle(body.badgeTitle, body.name)
              : null,
        badgeMessage:
          body.badgeMessage === undefined
            ? showBadge
              ? 'A loja reconhece você — desbloqueamos condições especiais para quem volta e faz parte da casa.'
              : null
            : body.badgeMessage,
      },
    });
    const memberCount = await countMembershipsByRules(auth.businessId, rules);
    return reply.code(201).send({
      audience: serializeAudience(segment, memberCount),
    });
  });

  app.get('/audiences/:id', async (request, reply) => {
    const auth = requireAuth(request);
    const { id } = request.params as { id: string };
    const segment = await prisma.audienceSegment.findFirst({
      where: { id, businessId: auth.businessId },
    });
    if (!segment) return reply.code(404).send({ error: 'NOT_FOUND' });
    const memberCount = await countMembershipsByRules(
      auth.businessId,
      parseAudienceRules(segment.rules),
    );
    return { audience: serializeAudience(segment, memberCount) };
  });

  app.get('/audiences/:id/members', async (request, reply) => {
    const auth = requireAuth(request);
    const { id } = request.params as { id: string };
    const query = request.query as { limit?: string; offset?: string };
    const limit = Math.min(
      Math.max(Number.parseInt(query.limit ?? '50', 10) || 50, 1),
      200,
    );
    const offset = Math.max(Number.parseInt(query.offset ?? '0', 10) || 0, 0);

    const segment = await prisma.audienceSegment.findFirst({
      where: { id, businessId: auth.businessId },
    });
    if (!segment) return reply.code(404).send({ error: 'NOT_FOUND' });

    const rules = parseAudienceRules(segment.rules);
    const matched = await filterMembershipsByRules(auth.businessId, rules);
    const total = matched.length;
    const members = matched.slice(offset, offset + limit).map((m) => ({
      membershipId: m.membershipId,
      customerId: m.customerId,
      displayName: m.displayName,
      phoneE164: m.phoneE164,
      isVip: m.isVip,
      stats: {
        visits: m.visits,
        lastVisitAt: m.lastVisitAt,
        spendCents: m.spendCents,
        stampsEarned: m.stampsEarned,
        pointsEarned: m.pointsEarned,
        redeems: m.redeems,
        nearReward: m.nearReward,
      },
    }));

    return {
      audienceId: id,
      total,
      members,
    };
  });

  app.patch('/audiences/:id', async (request, reply) => {
    const auth = requireAuth(request);
    if (auth.role === 'employee') {
      return reply.code(403).send({ error: 'FORBIDDEN' });
    }
    const { id } = request.params as { id: string };
    const body = patchBody.parse(request.body);
    const existing = await prisma.audienceSegment.findFirst({
      where: { id, businessId: auth.businessId },
    });
    if (!existing) return reply.code(404).send({ error: 'NOT_FOUND' });

    const rules = body.rules
      ? parseAudienceRules(body.rules)
      : parseAudienceRules(existing.rules);

    const segment = await prisma.audienceSegment.update({
      where: { id },
      data: {
        ...(body.name != null ? { name: body.name } : {}),
        ...(body.rules != null ? { rules } : {}),
        ...(body.showBadge !== undefined ? { showBadge: body.showBadge } : {}),
        ...(body.badgeTitle !== undefined
          ? { badgeTitle: body.badgeTitle }
          : {}),
        ...(body.badgeMessage !== undefined
          ? { badgeMessage: body.badgeMessage }
          : {}),
      },
    });
    const memberCount = await countMembershipsByRules(auth.businessId, rules);
    return { audience: serializeAudience(segment, memberCount) };
  });

  app.delete('/audiences/:id', async (request, reply) => {
    const auth = requireAuth(request);
    if (auth.role === 'employee') {
      return reply.code(403).send({ error: 'FORBIDDEN' });
    }
    const { id } = request.params as { id: string };
    const existing = await prisma.audienceSegment.findFirst({
      where: { id, businessId: auth.businessId },
    });
    if (!existing) return reply.code(404).send({ error: 'NOT_FOUND' });

    await prisma.audienceSegment.delete({ where: { id } });
    return { ok: true };
  });
};
