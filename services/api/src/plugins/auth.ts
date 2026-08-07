import type { FastifyPluginAsync, FastifyRequest } from 'fastify';
import fp from 'fastify-plugin';
import { prisma, type TeamRole } from '@frego/db';
import { verifyFirebaseIdToken } from '../lib/firebase.js';
import { phoneLast4, toE164 } from '../lib/phone.js';

export type AuthContext = {
  firebaseUid: string;
  businessId: string;
  teamMemberId: string;
  role: TeamRole;
  locationId: string | null;
};

export type PlatformAuthContext = {
  firebaseUid: string;
  adminId: string;
  email: string;
};

export type FirebaseUserContext = {
  uid: string;
  email: string | null;
  phoneNumber: string | null;
};

export type CustomerAuthContext = {
  firebaseUid: string;
  customerId: string;
  phoneE164: string;
};

declare module 'fastify' {
  interface FastifyRequest {
    auth: AuthContext | null;
    platformAuth: PlatformAuthContext | null;
    firebaseUser: FirebaseUserContext | null;
    customerAuth: CustomerAuthContext | null;
  }
}

function isPublicPath(url: string) {
  const path = url.split('?')[0];
  return (
    path.startsWith('/health') ||
    path.startsWith('/webhooks/meta') ||
    path.startsWith('/public/')
  );
}

function isRegisterPath(request: FastifyRequest) {
  const path = request.url.split('?')[0];
  return request.method === 'POST' && path === '/businesses/register';
}

function isAdminPath(url: string) {
  return url.split('?')[0].startsWith('/admin');
}

/** Rotas do app do cliente (Firebase phone OTP, sem team member). */
function isCustomerAppPath(url: string) {
  const path = url.split('?')[0];
  // Staff usa /me/businesses; o restante de /me/* é o app do cliente.
  if (path === '/me/businesses') return false;
  return path === '/me' || path.startsWith('/me/');
}

const authPluginImpl: FastifyPluginAsync = async (app) => {
  app.decorateRequest('auth', null);
  app.decorateRequest('platformAuth', null);
  app.decorateRequest('firebaseUser', null);
  app.decorateRequest('customerAuth', null);

  app.addHook('onRequest', async (request, reply) => {
    if (isPublicPath(request.url)) return;

    const header = request.headers.authorization;
    if (header?.startsWith('Bearer ')) {
      const token = header.slice('Bearer '.length);
      try {
        const decoded = await verifyFirebaseIdToken(token);
        const firebaseUser: FirebaseUserContext = {
          uid: decoded.uid,
          email: decoded.email?.toLowerCase() ?? null,
          phoneNumber: decoded.phone_number ?? null,
        };
        request.firebaseUser = firebaseUser;

        if (isRegisterPath(request)) {
          return;
        }

        if (isAdminPath(request.url)) {
          const admin = await resolvePlatformAdmin(firebaseUser);
          if (!admin) {
            return reply.code(403).send({ error: 'NOT_A_PLATFORM_ADMIN' });
          }
          request.platformAuth = admin;
          return;
        }

        if (isCustomerAppPath(request.url)) {
          const customer = await resolveCustomer(firebaseUser);
          if (!customer) {
            return reply.code(403).send({
              error: 'NOT_A_CUSTOMER',
              message: 'Faça login com o telefone no app Frego.',
            });
          }
          request.customerAuth = customer;
          return;
        }

        const member = await resolveTeamMember(request, decoded);
        if (!member) {
          return reply.code(403).send({ error: 'NOT_A_TEAM_MEMBER' });
        }
        request.auth = member;
        return;
      } catch (err) {
        request.log.warn({ err }, 'Falha ao verificar token Firebase');
        return reply.code(401).send({ error: 'INVALID_TOKEN' });
      }
    }

    if (process.env.AUTH_BYPASS === 'true') {
      if (isRegisterPath(request)) {
        request.firebaseUser = {
          uid: process.env.AUTH_BYPASS_FIREBASE_UID ?? 'seed_register_uid',
          email: process.env.AUTH_BYPASS_EMAIL ?? 'novo@loja.com',
          phoneNumber: null,
        };
        return;
      }

      if (isAdminPath(request.url)) {
        const admin =
          (await prisma.platformAdmin.findFirst({
            where: { email: 'admin@frego.app' },
          })) ?? (await prisma.platformAdmin.findFirst());
        if (!admin) {
          return reply.code(401).send({ error: 'AUTH_BYPASS_ADMIN_NOT_FOUND' });
        }
        request.platformAuth = {
          firebaseUid: admin.firebaseUid,
          adminId: admin.id,
          email: admin.email,
        };
        request.firebaseUser = {
          uid: admin.firebaseUid,
          email: admin.email,
          phoneNumber: null,
        };
        return;
      }

      if (isCustomerAppPath(request.url)) {
        const phone =
          process.env.AUTH_BYPASS_CUSTOMER_PHONE ?? '+5511999990001';
        const customer = await prisma.customer.findFirst({
          where: {
            OR: [
              { phoneE164: phone },
              { firebaseUid: process.env.AUTH_BYPASS_CUSTOMER_UID ?? 'seed_customer_uid' },
            ],
          },
        });
        if (!customer) {
          return reply
            .code(401)
            .send({ error: 'AUTH_BYPASS_CUSTOMER_NOT_FOUND' });
        }
        request.customerAuth = {
          firebaseUid: customer.firebaseUid ?? 'seed_customer_uid',
          customerId: customer.id,
          phoneE164: customer.phoneE164,
        };
        request.firebaseUser = {
          uid: customer.firebaseUid ?? 'seed_customer_uid',
          email: null,
          phoneNumber: customer.phoneE164,
        };
        return;
      }

      const headerBiz = request.headers['x-business-id'];
      const businessId =
        (typeof headerBiz === 'string' && headerBiz) ||
        process.env.AUTH_BYPASS_BUSINESS_ID ||
        'seed_bloom_coffee';
      const bypassEmail = process.env.AUTH_BYPASS_EMAIL ?? 'ana@bloom.coffee';
      const uid = process.env.AUTH_BYPASS_FIREBASE_UID ?? 'seed_owner_uid';
      const member =
        (await prisma.teamMember.findFirst({
          where: { businessId, email: bypassEmail, status: 'active' },
        })) ??
        (await prisma.teamMember.findUnique({
          where: {
            businessId_firebaseUid: { businessId, firebaseUid: uid },
          },
        }));
      if (!member || member.status !== 'active') {
        return reply.code(401).send({ error: 'AUTH_BYPASS_MEMBER_NOT_FOUND' });
      }
      request.auth = {
        firebaseUid: member.firebaseUid,
        businessId,
        teamMemberId: member.id,
        role: member.role,
        locationId: member.locationId,
      };
      request.firebaseUser = {
        uid: member.firebaseUid,
        email: member.email,
        phoneNumber: null,
      };
      return;
    }

    return reply.code(401).send({ error: 'MISSING_BEARER_TOKEN' });
  });
};

async function resolvePlatformAdmin(
  user: FirebaseUserContext,
): Promise<PlatformAuthContext | null> {
  let admin = await prisma.platformAdmin.findUnique({
    where: { firebaseUid: user.uid },
  });

  if (!admin && user.email) {
    const byEmail = await prisma.platformAdmin.findUnique({
      where: { email: user.email },
    });
    if (byEmail) {
      admin = await prisma.platformAdmin.update({
        where: { id: byEmail.id },
        data: { firebaseUid: user.uid },
      });
    }
  }

  if (!admin) return null;

  return {
    firebaseUid: user.uid,
    adminId: admin.id,
    email: admin.email,
  };
}

/**
 * Resolve/cria Customer a partir do Firebase phone OTP.
 */
async function resolveCustomer(
  user: FirebaseUserContext,
): Promise<CustomerAuthContext | null> {
  let customer = await prisma.customer.findUnique({
    where: { firebaseUid: user.uid },
  });

  if (!customer && user.phoneNumber) {
    let phoneE164: string;
    try {
      phoneE164 = toE164(user.phoneNumber);
    } catch {
      return null;
    }
    const last4 = phoneLast4(phoneE164);
    customer = await prisma.customer.upsert({
      where: { phoneE164 },
      create: {
        phoneE164,
        phoneLast4: last4,
        firebaseUid: user.uid,
      },
      update: {
        firebaseUid: user.uid,
        phoneLast4: last4,
      },
    });
  }

  if (!customer) return null;

  return {
    firebaseUid: user.uid,
    customerId: customer.id,
    phoneE164: customer.phoneE164,
  };
}

async function resolveTeamMember(
  request: FastifyRequest,
  decoded: { uid: string; email?: string; phone_number?: string },
): Promise<AuthContext | null> {
  const firebaseUid = decoded.uid;
  const email = decoded.email?.toLowerCase();
  const businessIdHeader = request.headers['x-business-id'];
  const businessId =
    typeof businessIdHeader === 'string' && businessIdHeader.length > 0
      ? businessIdHeader
      : undefined;

  let member = businessId
    ? await prisma.teamMember.findUnique({
        where: {
          businessId_firebaseUid: { businessId, firebaseUid },
        },
      })
    : null;

  if (!member || member.status !== 'active') {
    member = await prisma.teamMember.findFirst({
      where: { firebaseUid, status: 'active' },
      orderBy: { createdAt: 'asc' },
    });
  }

  if ((!member || member.status !== 'active') && email) {
    const byEmail = await prisma.teamMember.findFirst({
      where: {
        email,
        status: { in: ['active', 'pending'] },
        ...(businessId ? { businessId } : {}),
      },
      orderBy: { createdAt: 'asc' },
    });
    if (byEmail) {
      member = await prisma.teamMember.update({
        where: { id: byEmail.id },
        data: { firebaseUid, status: 'active', email },
      });
    } else if (businessId) {
      const byEmailAny = await prisma.teamMember.findFirst({
        where: {
          email,
          status: { in: ['active', 'pending'] },
        },
        orderBy: { createdAt: 'asc' },
      });
      if (byEmailAny) {
        member = await prisma.teamMember.update({
          where: { id: byEmailAny.id },
          data: { firebaseUid, status: 'active', email },
        });
      }
    }
  }

  if (!member || member.status !== 'active') return null;

  return {
    firebaseUid,
    businessId: member.businessId,
    teamMemberId: member.id,
    role: member.role,
    locationId: member.locationId,
  };
}

export const authPlugin = fp(authPluginImpl, { name: 'auth' });

export function requireAuth(request: FastifyRequest): AuthContext {
  if (!request.auth) {
    throw Object.assign(new Error('UNAUTHORIZED'), { statusCode: 401 });
  }
  return request.auth;
}

export function requirePlatformAuth(
  request: FastifyRequest,
): PlatformAuthContext {
  if (!request.platformAuth) {
    throw Object.assign(new Error('UNAUTHORIZED'), { statusCode: 401 });
  }
  return request.platformAuth;
}

export function requireFirebaseUser(
  request: FastifyRequest,
): FirebaseUserContext {
  if (!request.firebaseUser) {
    throw Object.assign(new Error('UNAUTHORIZED'), { statusCode: 401 });
  }
  return request.firebaseUser;
}

export function requireCustomerAuth(
  request: FastifyRequest,
): CustomerAuthContext {
  if (!request.customerAuth) {
    throw Object.assign(new Error('UNAUTHORIZED'), { statusCode: 401 });
  }
  return request.customerAuth;
}
