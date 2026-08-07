import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { prisma } from '@frego/db';
import { requirePlatformAuth } from '../plugins/auth.js';

const listQuery = z.object({
  status: z
    .enum(['pending', 'trial', 'active', 'past_due', 'suspended'])
    .optional(),
});

export const adminRoutes: FastifyPluginAsync = async (app) => {
  app.get('/admin/me', async (request) => {
    const auth = requirePlatformAuth(request);
    return {
      admin: {
        id: auth.adminId,
        email: auth.email,
      },
    };
  });

  app.get('/admin/stats', async (request) => {
    requirePlatformAuth(request);

    const [active, pending, customers, stampsToday] = await Promise.all([
      prisma.business.count({
        where: { status: { in: ['active', 'trial'] } },
      }),
      prisma.business.count({ where: { status: 'pending' } }),
      prisma.customer.count(),
      prisma.transaction.count({
        where: {
          type: 'stamp',
          createdAt: {
            gte: new Date(new Date().setHours(0, 0, 0, 0)),
          },
        },
      }),
    ]);

    const billing = await prisma.billingAccount.aggregate({
      where: { status: { in: ['active', 'trial'] } },
      _sum: { mrrCents: true },
    });

    return {
      stats: {
        activeBusinesses: active,
        pendingApprovals: pending,
        customers,
        stampsToday,
        mrrCents: billing._sum.mrrCents ?? 0,
      },
    };
  });

  app.get('/admin/businesses', async (request) => {
    requirePlatformAuth(request);
    const query = listQuery.parse(request.query);

    const businesses = await prisma.business.findMany({
      where: query.status ? { status: query.status } : undefined,
      include: {
        teamMembers: {
          where: { role: 'owner' },
          take: 1,
          select: {
            id: true,
            email: true,
            displayName: true,
          },
        },
        locations: {
          take: 1,
          select: { id: true, name: true, address: true },
        },
        billing: {
          select: { status: true, mrrCents: true },
        },
      },
      orderBy: [{ status: 'asc' }, { createdAt: 'desc' }],
    });

    return {
      businesses: businesses.map((b) => ({
        id: b.id,
        name: b.name,
        type: b.type,
        status: b.status,
        slug: b.slug,
        slogan: b.slogan,
        primaryColor: b.primaryColor,
        createdAt: b.createdAt.toISOString(),
        owner: b.teamMembers[0]
          ? {
              email: b.teamMembers[0].email,
              displayName: b.teamMembers[0].displayName,
            }
          : null,
        location: b.locations[0] ?? null,
        billing: b.billing,
      })),
    };
  });

  app.post('/admin/businesses/:id/approve', async (request, reply) => {
    requirePlatformAuth(request);
    const { id } = request.params as { id: string };

    const business = await prisma.business.findUnique({ where: { id } });
    if (!business) {
      return reply.code(404).send({ error: 'NOT_FOUND' });
    }
    if (business.status !== 'pending') {
      return reply.code(409).send({
        error: 'NOT_PENDING',
        status: business.status,
      });
    }

    const updated = await prisma.$transaction(async (tx) => {
      const next = await tx.business.update({
        where: { id },
        data: { status: 'trial' },
      });
      await tx.billingAccount.updateMany({
        where: { businessId: id },
        data: { status: 'trial' },
      });
      // Campanhas ficam draft até o estabelecimento ativar em /campaigns
      return next;
    });

    return {
      business: {
        id: updated.id,
        name: updated.name,
        status: updated.status,
      },
    };
  });

  app.post('/admin/businesses/:id/reject', async (request, reply) => {
    requirePlatformAuth(request);
    const { id } = request.params as { id: string };

    const business = await prisma.business.findUnique({ where: { id } });
    if (!business) {
      return reply.code(404).send({ error: 'NOT_FOUND' });
    }
    if (business.status !== 'pending') {
      return reply.code(409).send({
        error: 'NOT_PENDING',
        status: business.status,
      });
    }

    const updated = await prisma.$transaction(async (tx) => {
      const next = await tx.business.update({
        where: { id },
        data: { status: 'suspended' },
      });
      await tx.billingAccount.updateMany({
        where: { businessId: id },
        data: { status: 'suspended' },
      });
      return next;
    });

    return {
      business: {
        id: updated.id,
        name: updated.name,
        status: updated.status,
      },
    };
  });
};
