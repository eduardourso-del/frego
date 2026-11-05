import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { prisma, type TeamRole } from '@frego/db';
import { requireAuth } from '../plugins/auth.js';
import {
  equipeCanChange,
  normalizeEquipeEmail,
  normalizeEquipeName,
  planEquipeAdd,
  shouldDeleteInvitedLogin,
  type EquipeRole,
  type EquipeStatus,
} from '../lib/equipe.js';
import {
  createFirebaseStaffUser,
  deleteFirebaseUser,
  findFirebaseUserByEmail,
  firebaseUserHasPassword,
  staffPasswordResetUrl,
} from '../lib/firebase.js';
import { establishmentLoginUrl } from '../lib/mail/business-approved.js';
import { equipeAddedMail } from '../lib/mail/equipe.js';
import { sendMail, type MailResult } from '../lib/mail/send.js';
import { operatingLocationId } from '../lib/operating-address.js';

const addBody = z.object({
  displayName: z.string(),
  email: z.string(),
});

const renameBody = z.object({
  displayName: z.string(),
});

const memberSelect = {
  id: true,
  displayName: true,
  email: true,
  role: true,
  status: true,
  firebaseUid: true,
} as const;

function painelOrigin() {
  return establishmentLoginUrl().replace(/\/login$/, '');
}

function memberJson(member: {
  id: string;
  displayName: string | null;
  email: string | null;
  role: TeamRole;
  status: string;
}) {
  return {
    id: member.id,
    displayName: member.displayName,
    email: member.email,
    role: member.role,
    status: member.status,
  };
}

export const equipeRoutes: FastifyPluginAsync = async (app) => {
  app.get('/equipe', async (request, reply) => {
    const auth = requireAuth(request);
    if (auth.role !== 'owner') {
      return reply.code(403).send({ error: 'FORBIDDEN' });
    }
    const members = await prisma.teamMember.findMany({
      where: { businessId: auth.businessId },
      orderBy: { createdAt: 'asc' },
      select: {
        id: true,
        displayName: true,
        email: true,
        role: true,
        status: true,
      },
    });
    members.sort((a, b) => {
      if (a.role === 'owner') return -1;
      if (b.role === 'owner') return 1;
      return (a.displayName ?? '').localeCompare(b.displayName ?? '', 'pt');
    });
    return { members: members.map(memberJson) };
  });

  app.post('/equipe', async (request, reply) => {
    const auth = requireAuth(request);
    if (auth.role !== 'owner') {
      return reply.code(403).send({ error: 'FORBIDDEN' });
    }
    const body = addBody.parse(request.body);
    const displayName = normalizeEquipeName(body.displayName);
    const email = normalizeEquipeEmail(body.email);
    if (!displayName) return reply.code(400).send({ error: 'NAME_REQUIRED' });
    if (!email) return reply.code(400).send({ error: 'INVALID_EMAIL' });

    const business = await prisma.business.findUnique({
      where: { id: auth.businessId },
      select: { name: true, status: true },
    });
    if (!business) return reply.code(404).send({ error: 'NOT_FOUND' });
    if (!equipeCanChange(business.status)) {
      return reply.code(409).send({ error: 'BUSINESS_UNAVAILABLE' });
    }

    const actor = await prisma.teamMember.findUnique({
      where: { id: auth.teamMemberId },
      select: { email: true },
    });
    const actorEmail = (
      actor?.email ??
      request.firebaseUser?.email ??
      ''
    ).toLowerCase();

    const [existing, operator] = await Promise.all([
      prisma.teamMember.findFirst({
        where: { businessId: auth.businessId, email },
        select: memberSelect,
      }),
      prisma.platformAdmin.findUnique({
        where: { email },
        select: { id: true },
      }),
    ]);

    const decision = planEquipeAdd({
      actorEmail,
      email,
      operator: Boolean(operator),
      existing: existing
        ? {
            role: existing.role as EquipeRole,
            status: existing.status as EquipeStatus,
          }
        : null,
    });

    if (decision.action === 'refuse') {
      return reply.code(409).send({ error: decision.error });
    }

    if (decision.action === 'enable' && existing) {
      const member = await prisma.teamMember.update({
        where: { id: existing.id },
        data: { displayName, status: 'active' },
        select: memberSelect,
      });
      return { member: memberJson(member), mail: null };
    }

    let firebaseUid = existing?.firebaseUid ?? '';
    let hasPassword = false;
    if (decision.action === 'add') {
      try {
        let user = await findFirebaseUserByEmail(email);
        if (!user) {
          user = await createFirebaseStaffUser({ email, displayName });
        }
        firebaseUid = user.uid;
        hasPassword = firebaseUserHasPassword(user);
      } catch (err) {
        request.log.error({ err }, 'equipe firebase user failed');
        return reply.code(503).send({ error: 'LOGIN_UNAVAILABLE' });
      }
    }

    const needsPassword = decision.action === 'resend' || !hasPassword;
    let passwordUrl: string | null = null;
    if (needsPassword) {
      try {
        passwordUrl = await staffPasswordResetUrl(email, painelOrigin());
      } catch (err) {
        request.log.error({ err }, 'equipe password link failed');
        return reply.code(503).send({ error: 'MAIL_LINK_FAILED' });
      }
    }

    const locationId = await operatingLocationId(auth.businessId);
    const status = needsPassword ? 'pending' : 'active';
    const member = existing
      ? await prisma.teamMember.update({
          where: { id: existing.id },
          data: { displayName },
          select: memberSelect,
        })
      : await prisma.teamMember.create({
          data: {
            businessId: auth.businessId,
            locationId,
            firebaseUid,
            email,
            displayName,
            role: 'employee',
            status,
          },
          select: memberSelect,
        });

    let mail: MailResult;
    try {
      mail = await sendEquipeNotice({
        to: email,
        name: displayName,
        businessName: business.name,
        passwordUrl,
      });
    } catch (err) {
      request.log.error({ err }, 'equipe mail failed');
      mail = { sent: false, reason: 'failed' };
    }

    return reply.code(existing ? 200 : 201).send({
      member: memberJson(member),
      mail: mail.sent ? 'sent' : mail.reason,
    });
  });

  app.patch('/equipe/:id', async (request, reply) => {
    const auth = requireAuth(request);
    if (auth.role !== 'owner') {
      return reply.code(403).send({ error: 'FORBIDDEN' });
    }
    const { id } = request.params as { id: string };
    const displayName = normalizeEquipeName(renameBody.parse(request.body).displayName);
    if (!displayName) return reply.code(400).send({ error: 'NAME_REQUIRED' });

    const business = await prisma.business.findUnique({
      where: { id: auth.businessId },
      select: { status: true },
    });
    if (!business || !equipeCanChange(business.status)) {
      return reply.code(409).send({ error: 'BUSINESS_UNAVAILABLE' });
    }

    const existing = await prisma.teamMember.findFirst({
      where: { id, businessId: auth.businessId },
      select: { id: true },
    });
    if (!existing) return reply.code(404).send({ error: 'NOT_FOUND' });

    const member = await prisma.teamMember.update({
      where: { id },
      data: { displayName },
      select: memberSelect,
    });
    return { member: memberJson(member) };
  });

  app.post('/equipe/:id/resend', async (request, reply) => {
    const auth = requireAuth(request);
    if (auth.role !== 'owner') {
      return reply.code(403).send({ error: 'FORBIDDEN' });
    }
    const { id } = request.params as { id: string };
    const business = await prisma.business.findUnique({
      where: { id: auth.businessId },
      select: { name: true, status: true },
    });
    if (!business || !equipeCanChange(business.status)) {
      return reply.code(409).send({ error: 'BUSINESS_UNAVAILABLE' });
    }
    const existing = await prisma.teamMember.findFirst({
      where: { id, businessId: auth.businessId },
      select: memberSelect,
    });
    if (!existing?.email) return reply.code(404).send({ error: 'NOT_FOUND' });
    if (existing.status !== 'pending') {
      return reply.code(409).send({ error: 'NOT_WAITING' });
    }
    let passwordUrl: string;
    try {
      passwordUrl = await staffPasswordResetUrl(existing.email, painelOrigin());
    } catch (err) {
      request.log.error({ err }, 'equipe password link failed');
      return reply.code(503).send({ error: 'MAIL_LINK_FAILED' });
    }
    const mail = await sendEquipeNotice({
      to: existing.email,
      name: existing.displayName ?? existing.email,
      businessName: business.name,
      passwordUrl,
    });
    return { member: memberJson(existing), mail: mail.sent ? 'sent' : mail.reason };
  });

  app.post('/equipe/:id/disable', async (request, reply) => {
    const changed = await setStatus(request, reply, 'disabled', 'active');
    return changed;
  });

  app.post('/equipe/:id/enable', async (request, reply) => {
    return setStatus(request, reply, 'active', 'disabled');
  });

  app.delete('/equipe/:id', async (request, reply) => {
    const auth = requireAuth(request);
    if (auth.role !== 'owner') {
      return reply.code(403).send({ error: 'FORBIDDEN' });
    }
    const { id } = request.params as { id: string };
    const business = await prisma.business.findUnique({
      where: { id: auth.businessId },
      select: { status: true },
    });
    if (!business || !equipeCanChange(business.status)) {
      return reply.code(409).send({ error: 'BUSINESS_UNAVAILABLE' });
    }
    const existing = await prisma.teamMember.findFirst({
      where: { id, businessId: auth.businessId },
      select: memberSelect,
    });
    if (!existing) return reply.code(404).send({ error: 'NOT_FOUND' });
    if (existing.role === 'owner') {
      return reply.code(409).send({ error: 'OWNER' });
    }
    if (existing.status !== 'pending') {
      return reply.code(409).send({ error: 'NOT_WAITING' });
    }

    const others = await prisma.teamMember.count({
      where: {
        id: { not: existing.id },
        OR: [
          { firebaseUid: existing.firebaseUid },
          ...(existing.email ? [{ email: existing.email }] : []),
        ],
      },
    });
    let hasPassword = true;
    if (existing.email) {
      try {
        const user = await findFirebaseUserByEmail(existing.email);
        hasPassword = user ? firebaseUserHasPassword(user) : false;
      } catch (err) {
        request.log.error({ err }, 'equipe firebase lookup failed');
        hasPassword = true;
      }
    }
    await prisma.teamMember.delete({ where: { id: existing.id } });
    if (
      shouldDeleteInvitedLogin({ otherMemberships: others, hasPassword }) &&
      existing.firebaseUid
    ) {
      try {
        await deleteFirebaseUser(existing.firebaseUid);
      } catch (err) {
        request.log.error({ err }, 'equipe firebase delete failed');
      }
    }
    return { ok: true };
  });
};

async function sendEquipeNotice(input: {
  to: string;
  name: string;
  businessName: string;
  passwordUrl: string | null;
}): Promise<MailResult> {
  return sendMail(
    equipeAddedMail({
      to: input.to,
      name: input.name,
      businessName: input.businessName,
      passwordUrl: input.passwordUrl,
      loginUrl: establishmentLoginUrl(),
    }),
  );
}

async function setStatus(
  request: Parameters<typeof requireAuth>[0],
  reply: { code: (n: number) => { send: (b: unknown) => unknown } },
  next: 'active' | 'disabled',
  from: 'active' | 'disabled',
) {
  const auth = requireAuth(request);
  if (auth.role !== 'owner') {
    return reply.code(403).send({ error: 'FORBIDDEN' });
  }
  const { id } = request.params as { id: string };
  const business = await prisma.business.findUnique({
    where: { id: auth.businessId },
    select: { status: true },
  });
  if (!business || !equipeCanChange(business.status)) {
    return reply.code(409).send({ error: 'BUSINESS_UNAVAILABLE' });
  }
  const existing = await prisma.teamMember.findFirst({
    where: { id, businessId: auth.businessId },
    select: memberSelect,
  });
  if (!existing) return reply.code(404).send({ error: 'NOT_FOUND' });
  if (existing.role === 'owner') {
    return reply.code(409).send({ error: 'OWNER' });
  }
  if (existing.status !== from) {
    return reply.code(409).send({ error: 'NOT_WAITING' });
  }
  const member = await prisma.teamMember.update({
    where: { id },
    data: { status: next },
    select: memberSelect,
  });
  return { member: memberJson(member) };
}
