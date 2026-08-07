import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { prisma } from '@frego/db';
import { requireAuth } from '../plugins/auth.js';

const hexColor = z
  .string()
  .regex(/^#[0-9A-Fa-f]{6}$/, 'Use hex #RRGGBB');

const updateBody = z.object({
  name: z.string().min(1).max(80).optional(),
  type: z.string().min(1).max(40).optional(),
  slogan: z.string().max(160).nullable().optional(),
  logoUrl: z.string().url().nullable().optional(),
  heroImageUrl: z.string().url().nullable().optional(),
  primaryColor: hexColor.optional(),
  primaryColorDark: hexColor.optional(),
  /** Pontos ganhos por R$ 1,00 no acúmulo (pool da loja). */
  pointsPerReal: z.number().int().positive().max(1000).optional(),
  slug: z
    .string()
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'slug em minúsculas-com-hífen')
    .max(60)
    .nullable()
    .optional(),
});

function publicBusiness(b: {
  id: string;
  name: string;
  type: string;
  logoUrl: string | null;
  heroImageUrl: string | null;
  primaryColor: string;
  primaryColorDark: string;
  slogan: string | null;
  slug: string | null;
  status: string;
  pointsPerReal: number;
}) {
  return {
    id: b.id,
    name: b.name,
    type: b.type,
    logoUrl: b.logoUrl,
    heroImageUrl: b.heroImageUrl,
    primaryColor: b.primaryColor,
    primaryColorDark: b.primaryColorDark,
    slogan: b.slogan,
    slug: b.slug,
    status: b.status,
    pointsPerReal: b.pointsPerReal,
  };
}

export const businessRoutes: FastifyPluginAsync = async (app) => {
  /** Perfil + branding do tenant autenticado — só este negócio. */
  app.get('/business', async (request) => {
    const auth = requireAuth(request);
    const business = await prisma.business.findUniqueOrThrow({
      where: { id: auth.businessId },
    });
    return { business: publicBusiness(business) };
  });

  /** Atualiza experiência da loja (nome, cores, logo, slogan). Owner/manager. */
  app.patch('/business', async (request, reply) => {
    const auth = requireAuth(request);
    if (auth.role === 'employee') {
      return reply.code(403).send({ error: 'FORBIDDEN' });
    }
    const body = updateBody.parse(request.body);

    if (body.slug) {
      const taken = await prisma.business.findFirst({
        where: { slug: body.slug, NOT: { id: auth.businessId } },
      });
      if (taken) {
        return reply.code(409).send({ error: 'SLUG_TAKEN' });
      }
    }

    const business = await prisma.business.update({
      where: { id: auth.businessId },
      data: {
        name: body.name,
        type: body.type,
        slogan: body.slogan === undefined ? undefined : body.slogan,
        logoUrl: body.logoUrl === undefined ? undefined : body.logoUrl,
        heroImageUrl:
          body.heroImageUrl === undefined ? undefined : body.heroImageUrl,
        primaryColor: body.primaryColor,
        primaryColorDark: body.primaryColorDark,
        pointsPerReal: body.pointsPerReal,
        slug: body.slug === undefined ? undefined : body.slug,
      },
    });

    return { business: publicBusiness(business) };
  });
};
