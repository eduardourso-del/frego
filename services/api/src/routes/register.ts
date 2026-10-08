import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { prisma } from '@frego/db';
import { requireFirebaseUser } from '../plugins/auth.js';
import { businessTypeSchema } from '../lib/business-type.js';
import { normalizeCnpj } from '../lib/cnpj.js';

const hexColor = z
  .string()
  .regex(/^#[0-9A-Fa-f]{6}$/, 'Use hex #RRGGBB')
  .optional();

const registerBody = z.object({
  ownerName: z.string().min(2).max(80),
  businessName: z.string().min(2).max(80),
  type: businessTypeSchema,
  slogan: z.string().max(160).optional(),
  cnpj: z.string().trim().max(18).optional(),
  primaryColor: hexColor,
  primaryColorDark: hexColor,
  locationName: z.string().min(2).max(80),
  locationAddress: z.string().min(5).max(200),
  slug: z
    .string()
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)
    .max(60)
    .optional(),
});

function slugify(name: string) {
  return name
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 60);
}

export const registerRoutes: FastifyPluginAsync = async (app) => {
  /**
   * Cadastro público de nova loja.
   * Requer Bearer Firebase (conta criada no client).
   * 1 conta = 1 loja: rejeita se o usuário já for membro de algum negócio.
   */
  app.post('/businesses/register', async (request, reply) => {
    const user = requireFirebaseUser(request);
    if (!user.email) {
      return reply.code(400).send({ error: 'EMAIL_REQUIRED' });
    }

    const body = registerBody.parse(request.body);
    const cnpj = normalizeCnpj(body.cnpj);
    if (cnpj === 'invalid') {
      return reply.code(400).send({ error: 'INVALID_CNPJ' });
    }
    if (cnpj) {
      const cnpjTaken = await prisma.business.findUnique({ where: { cnpj } });
      if (cnpjTaken) {
        return reply.code(409).send({ error: 'CNPJ_TAKEN' });
      }
    }

    const existingMember = await prisma.teamMember.findFirst({
      where: {
        status: { in: ['active', 'pending'] },
        OR: [{ firebaseUid: user.uid }, { email: user.email }],
      },
    });
    if (existingMember) {
      return reply.code(409).send({ error: 'ALREADY_HAS_BUSINESS' });
    }

    const existingAdmin = await prisma.platformAdmin.findFirst({
      where: {
        OR: [{ firebaseUid: user.uid }, { email: user.email }],
      },
    });
    if (existingAdmin) {
      return reply.code(403).send({ error: 'PLATFORM_ADMIN_CANNOT_REGISTER' });
    }

    let slug = body.slug ?? slugify(body.businessName);
    if (!slug) slug = `loja-${Date.now().toString(36)}`;
    const slugTaken = await prisma.business.findUnique({ where: { slug } });
    if (slugTaken) {
      slug = `${slug}-${Date.now().toString(36).slice(-4)}`;
    }

    const trialPlan = await prisma.plan.findUnique({ where: { tier: 'trial' } });
    if (!trialPlan) {
      return reply.code(500).send({ error: 'TRIAL_PLAN_MISSING' });
    }

    const primaryColor = body.primaryColor ?? '#070707';
    const primaryColorDark = body.primaryColorDark ?? '#070707';

    const result = await prisma.$transaction(async (tx) => {
      const business = await tx.business.create({
        data: {
          name: body.businessName,
          type: body.type,
          status: 'pending',
          slogan: body.slogan ?? null,
          cnpj,
          primaryColor,
          primaryColorDark,
          slug,
        },
      });

      await tx.billingAccount.create({
        data: {
          businessId: business.id,
          planId: trialPlan.id,
          status: 'pending',
          mrrCents: 0,
        },
      });

      const location = await tx.location.create({
        data: {
          businessId: business.id,
          name: body.locationName,
          address: body.locationAddress,
          isOpen: true,
        },
      });

      const owner = await tx.teamMember.create({
        data: {
          businessId: business.id,
          locationId: location.id,
          firebaseUid: user.uid,
          email: user.email!,
          displayName: body.ownerName,
          role: 'owner',
          status: 'active',
        },
      });

      // Campanha: o estabelecimento escolhe carimbos ou pontos depois, em /campaigns
      return { business, location, owner };
    });

    return reply.code(201).send({
      business: {
        id: result.business.id,
        name: result.business.name,
        status: result.business.status,
        slug: result.business.slug,
        type: result.business.type,
      },
      location: {
        id: result.location.id,
        name: result.location.name,
      },
      message:
        'Cadastro enviado. A equipe Frego vai revisar e aprovar seu estabelecimento.',
    });
  });
};
