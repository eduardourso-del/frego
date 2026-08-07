import type { FastifyPluginAsync } from 'fastify';
import { prisma } from '@frego/db';

const PUBLIC_STATUSES = ['trial', 'active'] as const;

/**
 * Public storefront by slug — no auth.
 * Only trial/active businesses with a slug are visible.
 */
export const publicBusinessRoutes: FastifyPluginAsync = async (app) => {
  app.get<{ Params: { slug: string } }>(
    '/public/businesses/:slug',
    async (request, reply) => {
      const slug = request.params.slug?.trim().toLowerCase();
      if (!slug) {
        return reply.code(404).send({ error: 'NOT_FOUND' });
      }

      const business = await prisma.business.findFirst({
        where: {
          slug,
          status: { in: [...PUBLIC_STATUSES] },
        },
        select: {
          name: true,
          type: true,
          logoUrl: true,
          heroImageUrl: true,
          primaryColor: true,
          primaryColorDark: true,
          slogan: true,
          slug: true,
          locations: {
            orderBy: { createdAt: 'asc' },
            select: {
              name: true,
              address: true,
              isOpen: true,
            },
          },
          campaigns: {
            where: { status: 'active' },
            orderBy: { createdAt: 'asc' },
            select: {
              id: true,
              name: true,
              type: true,
              stampsNeeded: true,
              pointsPerReal: true,
              rewardTitle: true,
              rewardDescription: true,
              rewardImageUrl: true,
            },
          },
        },
      });

      if (!business || !business.slug) {
        return reply.code(404).send({ error: 'NOT_FOUND' });
      }

      return {
        business: {
          name: business.name,
          type: business.type,
          logoUrl: business.logoUrl,
          heroImageUrl: business.heroImageUrl,
          primaryColor: business.primaryColor,
          primaryColorDark: business.primaryColorDark,
          slogan: business.slogan,
          slug: business.slug,
        },
        locations: business.locations,
        campaigns: business.campaigns.map((c) => ({
          id: c.id,
          name: c.name,
          type: c.type,
          stampsNeeded: c.stampsNeeded,
          pointsPerReal: c.pointsPerReal,
          rewardTitle: c.rewardTitle,
          rewardDescription: c.rewardDescription,
          rewardImageUrl: c.rewardImageUrl,
        })),
      };
    },
  );
};
