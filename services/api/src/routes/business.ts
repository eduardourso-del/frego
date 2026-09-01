import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { prisma } from '@frego/db';
import { requireAuth } from '../plugins/auth.js';
import { activeEarnKindsForBusiness, type EarnKind } from '../lib/earn-kinds.js';

const hexColor = z
  .string()
  .regex(/^#[0-9A-Fa-f]{6}$/, 'Use hex #RRGGBB');

/** null = não expira; 1–3650 dias a partir do ganho. */
const expireDays = z.number().int().min(1).max(3650).nullable();

const updateBody = z.object({
  name: z.string().min(1).max(80).optional(),
  type: z.string().min(1).max(40).optional(),
  slogan: z.string().max(160).nullable().optional(),
  logoUrl: z.string().url().nullable().optional(),
  heroImageUrl: z.string().url().nullable().optional(),
  primaryColor: hexColor.optional(),
  primaryColorDark: hexColor.optional(),
  /** Reais gastos para ganhar 1 ponto no acúmulo (pool da loja). */
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
  slug: z
    .string()
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'slug em minúsculas-com-hífen')
    .max(60)
    .nullable()
    .optional(),
});

const updateLocationBody = z.object({
  name: z.string().min(2).max(80).optional(),
  address: z.string().min(5).max(200).nullable().optional(),
  isOpen: z.boolean().optional(),
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
  cashbackPercent: number;
  cashbackMaxCents: number | null;
  cashbackMinPurchaseCents: number | null;
  stampsExpireDays: number | null;
  pointsExpireDays: number | null;
  cashbackExpireDays: number | null;
}, activeEarnKinds: EarnKind[] = []) {
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
    cashbackPercent: b.cashbackPercent,
    cashbackMaxCents: b.cashbackMaxCents,
    cashbackMinPurchaseCents: b.cashbackMinPurchaseCents,
    stampsExpireDays: b.stampsExpireDays,
    pointsExpireDays: b.pointsExpireDays,
    cashbackExpireDays: b.cashbackExpireDays,
    activeEarnKinds,
  };
}

export const businessRoutes: FastifyPluginAsync = async (app) => {
  /** Perfil + branding do tenant autenticado — só este negócio. */
  app.get('/business', async (request) => {
    const auth = requireAuth(request);
    const business = await prisma.business.findUniqueOrThrow({
      where: { id: auth.businessId },
    });
    const activeEarnKinds = await activeEarnKindsForBusiness(business.id);
    return { business: publicBusiness(business, activeEarnKinds) };
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
        slug: body.slug === undefined ? undefined : body.slug,
      },
    });

    const activeEarnKinds = await activeEarnKindsForBusiness(business.id);
    return { business: publicBusiness(business, activeEarnKinds) };
  });

  /** Unidades (endereço) do negócio autenticado. */
  app.get('/business/locations', async (request) => {
    const auth = requireAuth(request);
    const locations = await prisma.location.findMany({
      where: { businessId: auth.businessId },
      orderBy: { createdAt: 'asc' },
      select: {
        id: true,
        name: true,
        address: true,
        isOpen: true,
      },
    });
    return { locations };
  });

  /** Atualiza nome/endereço de uma unidade. Owner/manager. */
  app.patch('/business/locations/:locationId', async (request, reply) => {
    const auth = requireAuth(request);
    if (auth.role === 'employee') {
      return reply.code(403).send({ error: 'FORBIDDEN' });
    }
    const { locationId } = request.params as { locationId: string };
    const body = updateLocationBody.parse(request.body);

    const existing = await prisma.location.findFirst({
      where: { id: locationId, businessId: auth.businessId },
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
  });
};
