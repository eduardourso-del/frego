import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { prisma } from '@frego/db';
import { requireAuth } from '../plugins/auth.js';
import {
  MAX_TAGS_PER_BUSINESS,
  serializeCatalogTag,
  tagSelect,
} from '../lib/tags.js';

const colorSchema = z
  .string()
  .regex(/^#[0-9A-Fa-f]{6}$/, 'Cor inválida')
  .nullable()
  .optional();

const createBody = z.object({
  name: z.string().trim().min(1).max(32),
  color: colorSchema,
});

const patchBody = z
  .object({
    name: z.string().trim().min(1).max(32).optional(),
    color: colorSchema,
    sortOrder: z.number().int().min(0).max(999).optional(),
    archived: z.boolean().optional(),
  })
  .refine(
    (b) =>
      b.name !== undefined ||
      b.color !== undefined ||
      b.sortOrder !== undefined ||
      b.archived !== undefined,
    { message: 'Nada para atualizar' },
  );

function normalizeName(name: string) {
  return name.trim().replace(/\s+/g, ' ');
}

export const tagRoutes: FastifyPluginAsync = async (app) => {
  app.get('/tags', async (request) => {
    const auth = requireAuth(request);
    const query = request.query as { includeArchived?: string };
    const includeArchived =
      query.includeArchived === '1' || query.includeArchived === 'true';

    const tags = await prisma.businessTag.findMany({
      where: {
        businessId: auth.businessId,
        ...(includeArchived ? {} : { archivedAt: null }),
      },
      select: tagSelect,
      orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
    });

    return { tags: tags.map(serializeCatalogTag) };
  });

  app.post('/tags', async (request, reply) => {
    const auth = requireAuth(request);
    if (auth.role === 'employee') {
      return reply.code(403).send({ error: 'FORBIDDEN' });
    }
    const body = createBody.parse(request.body);
    const name = normalizeName(body.name);

    const activeCount = await prisma.businessTag.count({
      where: { businessId: auth.businessId, archivedAt: null },
    });
    if (activeCount >= MAX_TAGS_PER_BUSINESS) {
      return reply.code(400).send({
        error: 'TAG_LIMIT',
        message: `No máximo ${MAX_TAGS_PER_BUSINESS} etiquetas ativas.`,
      });
    }

    const duplicate = await prisma.businessTag.findFirst({
      where: {
        businessId: auth.businessId,
        archivedAt: null,
        name: { equals: name, mode: 'insensitive' },
      },
      select: { id: true },
    });
    if (duplicate) {
      return reply.code(409).send({
        error: 'TAG_EXISTS',
        message: 'Já existe uma etiqueta com este nome.',
      });
    }

    const maxSort = await prisma.businessTag.aggregate({
      where: { businessId: auth.businessId },
      _max: { sortOrder: true },
    });

    try {
      const tag = await prisma.businessTag.create({
        data: {
          businessId: auth.businessId,
          name,
          color: body.color ?? null,
          sortOrder: (maxSort._max.sortOrder ?? -1) + 1,
        },
        select: tagSelect,
      });
      return reply.code(201).send({ tag: serializeCatalogTag(tag) });
    } catch (err) {
      request.log.warn({ err }, 'tag create conflict');
      return reply.code(409).send({
        error: 'TAG_EXISTS',
        message: 'Já existe uma etiqueta com este nome.',
      });
    }
  });

  app.patch('/tags/:id', async (request, reply) => {
    const auth = requireAuth(request);
    if (auth.role === 'employee') {
      return reply.code(403).send({ error: 'FORBIDDEN' });
    }
    const { id } = request.params as { id: string };
    const body = patchBody.parse(request.body);

    const existing = await prisma.businessTag.findFirst({
      where: { id, businessId: auth.businessId },
      select: tagSelect,
    });
    if (!existing) return reply.code(404).send({ error: 'NOT_FOUND' });

    const name =
      body.name !== undefined ? normalizeName(body.name) : existing.name;
    const archivedAt =
      body.archived === undefined
        ? existing.archivedAt
        : body.archived
          ? existing.archivedAt ?? new Date()
          : null;

    if (archivedAt == null) {
      const duplicate = await prisma.businessTag.findFirst({
        where: {
          businessId: auth.businessId,
          archivedAt: null,
          id: { not: id },
          name: { equals: name, mode: 'insensitive' },
        },
        select: { id: true },
      });
      if (duplicate) {
        return reply.code(409).send({
          error: 'TAG_EXISTS',
          message: 'Já existe uma etiqueta com este nome.',
        });
      }
    }

    try {
      const tag = await prisma.businessTag.update({
        where: { id },
        data: {
          name,
          ...(body.color !== undefined ? { color: body.color } : {}),
          ...(body.sortOrder !== undefined ? { sortOrder: body.sortOrder } : {}),
          archivedAt,
        },
        select: tagSelect,
      });
      return { tag: serializeCatalogTag(tag) };
    } catch (err) {
      request.log.warn({ err }, 'tag patch conflict');
      return reply.code(409).send({
        error: 'TAG_EXISTS',
        message: 'Já existe uma etiqueta com este nome.',
      });
    }
  });

  app.delete('/tags/:id', async (request, reply) => {
    const auth = requireAuth(request);
    if (auth.role === 'employee') {
      return reply.code(403).send({ error: 'FORBIDDEN' });
    }
    const { id } = request.params as { id: string };
    const existing = await prisma.businessTag.findFirst({
      where: { id, businessId: auth.businessId },
      select: { id: true, archivedAt: true },
    });
    if (!existing) return reply.code(404).send({ error: 'NOT_FOUND' });

    const tag = await prisma.businessTag.update({
      where: { id },
      data: { archivedAt: existing.archivedAt ?? new Date() },
      select: tagSelect,
    });
    return { tag: serializeCatalogTag(tag) };
  });
};
