import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { prisma } from '@frego/db';
import { verifyFirebaseIdToken } from '../lib/firebase.js';
import { requireAuth, requireCustomerAuth } from '../plugins/auth.js';
import {
  archivePesquisa,
  getPesquisaDetail,
  listPesquisas,
  resolveConviteByToken,
  resolveOpenConviteForCustomer,
  savePesquisa,
  submitConvite,
} from '../lib/pesquisa-flow.js';
import type { BonusKind, BonusMode, Polegar } from '../lib/pesquisa.js';

const questionSchema = z.object({
  prompt: z.string().max(200),
});

const writeSchema = z.object({
  name: z.string().max(80),
  notePrompt: z.string().max(200).nullable().optional(),
  questions: z.array(questionSchema).max(5),
  bonusEnabled: z.boolean(),
  bonusKind: z.enum(['stamps', 'points', 'cashback']).nullable().optional(),
  bonusMode: z.enum(['fixed', 'double']).optional(),
  bonusQuantity: z.number().int().nullable().optional(),
  bonusCampaignId: z.string().nullable().optional(),
  audienceSegmentId: z.string().nullable().optional(),
  status: z.enum(['draft', 'active']),
});

const answerSchema = z.object({
  position: z.number().int().min(0).max(4),
  value: z.enum(['up', 'down']),
});

const submitSchema = z.object({
  conviteId: z.string().min(1).optional(),
  answers: z.array(answerSchema).max(5),
  note: z.string().max(500).nullable().optional(),
  idToken: z.string().min(1).optional(),
});

function writeFromBody(body: z.infer<typeof writeSchema>) {
  return {
    name: body.name,
    notePrompt: body.notePrompt ?? null,
    questions: body.questions,
    bonusEnabled: body.bonusEnabled,
    bonusKind: (body.bonusKind ?? null) as BonusKind | null,
    bonusMode: (body.bonusMode ?? 'fixed') as BonusMode,
    bonusQuantity: body.bonusQuantity ?? null,
    bonusCampaignId: body.bonusCampaignId ?? null,
    audienceSegmentId: body.audienceSegmentId ?? null,
    status: body.status,
  };
}

function fail(
  reply: { code: (n: number) => { send: (b: unknown) => unknown } },
  status: number,
  error: string,
  message: string,
) {
  return reply.code(status).send({ error, message });
}

export const pesquisaRoutes: FastifyPluginAsync = async (app) => {
  app.get('/pesquisas', async (request) => {
    const auth = requireAuth(request);
    return listPesquisas(auth.businessId);
  });

  app.get('/pesquisas/:id', async (request, reply) => {
    const auth = requireAuth(request);
    const { id } = request.params as { id: string };
    const detail = await getPesquisaDetail(auth.businessId, id);
    if (!detail) return reply.code(404).send({ error: 'NOT_FOUND' });
    return detail;
  });

  app.post('/pesquisas', async (request, reply) => {
    const auth = requireAuth(request);
    if (auth.role === 'employee') {
      return reply.code(403).send({ error: 'FORBIDDEN' });
    }
    const body = writeSchema.parse(request.body);
    const saved = await savePesquisa({
      businessId: auth.businessId,
      write: writeFromBody(body),
    });
    if (!saved.ok) return fail(reply, 400, saved.error, saved.message);
    const detail = await getPesquisaDetail(auth.businessId, saved.id);
    return reply.code(201).send(detail);
  });

  app.patch('/pesquisas/:id', async (request, reply) => {
    const auth = requireAuth(request);
    if (auth.role === 'employee') {
      return reply.code(403).send({ error: 'FORBIDDEN' });
    }
    const { id } = request.params as { id: string };
    const body = writeSchema.parse(request.body);
    const saved = await savePesquisa({
      businessId: auth.businessId,
      pesquisaId: id,
      write: writeFromBody(body),
    });
    if (!saved.ok) {
      const status = saved.error === 'NOT_FOUND' ? 404 : 400;
      return fail(reply, status, saved.error, saved.message);
    }
    return getPesquisaDetail(auth.businessId, saved.id);
  });

  app.post('/pesquisas/:id/archive', async (request, reply) => {
    const auth = requireAuth(request);
    if (auth.role === 'employee') {
      return reply.code(403).send({ error: 'FORBIDDEN' });
    }
    const { id } = request.params as { id: string };
    const saved = await archivePesquisa(auth.businessId, id);
    if (!saved.ok) return reply.code(404).send({ error: saved.error, message: saved.message });
    return getPesquisaDetail(auth.businessId, saved.id);
  });

  app.get('/me/businesses/:businessId/convite', async (request) => {
    const auth = requireCustomerAuth(request);
    const { businessId } = request.params as { businessId: string };
    return resolveOpenConviteForCustomer(auth.customerId, businessId);
  });

  app.post('/me/convites/:id/submit', async (request, reply) => {
    const auth = requireCustomerAuth(request);
    const { id } = request.params as { id: string };
    const body = submitSchema.parse(request.body);
    const result = await submitConvite({
      conviteId: id,
      customerId: auth.customerId,
      answers: body.answers as { position: number; value: Polegar }[],
      note: body.note ?? null,
    });
    if (!result.ok) {
      const status = result.error === 'NOT_FOUND' ? 404 : 409;
      return fail(reply, status, result.error, result.message);
    }
    return { state: 'answered', bonus: result.bonus };
  });

  app.get('/public/convites/:token', async (request, reply) => {
    const { token } = request.params as { token: string };
    const view = await resolveConviteByToken(token);
    if (!view) return reply.code(404).send({ error: 'NOT_FOUND' });
    return view;
  });

  app.post('/public/convites/:token/submit', async (request, reply) => {
    const { token } = request.params as { token: string };
    const body = submitSchema.parse(request.body);
    if (!body.idToken) {
      return fail(reply, 401, 'CODE_REQUIRED', 'Confirme o código enviado ao seu telefone.');
    }
    let phone: string | null = null;
    try {
      const decoded = await verifyFirebaseIdToken(body.idToken);
      phone = decoded.phone_number ?? null;
    } catch {
      return fail(reply, 401, 'INVALID_TOKEN', 'Código inválido.');
    }
    if (!phone) {
      return fail(reply, 401, 'CODE_REQUIRED', 'Confirme o código enviado ao seu telefone.');
    }
    const convite = await prisma.convite.findUnique({
      where: { token },
      include: { customer: { select: { id: true, phoneE164: true } } },
    });
    if (!convite) return reply.code(404).send({ error: 'NOT_FOUND' });
    if (convite.customer.phoneE164 !== phone) {
      return fail(
        reply,
        403,
        'PHONE_MISMATCH',
        'O código precisa ser do telefone desta conta.',
      );
    }
    const conviteId = body.conviteId ?? convite.id;
    const owned = await prisma.convite.findFirst({
      where: { id: conviteId, customerId: convite.customer.id, pesquisaId: convite.pesquisaId },
      select: { id: true },
    });
    if (!owned) {
      return fail(reply, 404, 'NOT_FOUND', 'Convite não encontrado.');
    }
    const result = await submitConvite({
      conviteId,
      customerId: convite.customer.id,
      answers: body.answers as { position: number; value: Polegar }[],
      note: body.note ?? null,
    });
    if (!result.ok) {
      const status = result.error === 'NOT_FOUND' ? 404 : 409;
      return fail(reply, status, result.error, result.message);
    }
    return { state: 'answered', bonus: result.bonus };
  });
};
