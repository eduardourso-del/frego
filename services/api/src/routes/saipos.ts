import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { prisma } from '@frego/db';
import { requireAuth } from '../plugins/auth.js';
import { fetchSaiposSales } from '../lib/saipos/client.js';
import {
  currentTokenKeyVersion,
  encryptToken,
} from '../lib/whatsapp/crypto.js';

const connectBody = z.object({
  token: z.string().trim().min(8).max(4000),
});

function forbidEmployee(role: string): boolean {
  return role === 'employee';
}

export function saiposConnectionPublic(row: {
  status: string;
  connectedAt: Date;
  lastSyncAt: Date | null;
  lastError: string | null;
}) {
  return {
    status: row.status,
    connectedAt: row.connectedAt.toISOString(),
    lastSyncAt: row.lastSyncAt?.toISOString() ?? null,
    lastError: row.lastError,
  };
}

export const saiposRoutes: FastifyPluginAsync = async (app) => {
  app.get('/saipos/connection', async (request) => {
    const auth = requireAuth(request);
    const row = await prisma.businessSaiposConnection.findUnique({
      where: { businessId: auth.businessId },
    });
    if (!row) return { connected: false, connection: null };
    return { connected: true, connection: saiposConnectionPublic(row) };
  });

  app.post('/saipos/connection', async (request, reply) => {
    const auth = requireAuth(request);
    if (forbidEmployee(auth.role)) {
      return reply.code(403).send({ error: 'FORBIDDEN' });
    }
    const body = connectBody.parse(request.body);

    const end = new Date();
    const start = new Date(end.getTime() - 60 * 60 * 1000);
    const probe = await fetchSaiposSales(body.token, start, end);
    if (!probe.ok) {
      const status = probe.status === 401 || probe.status === 403 ? 401 : 400;
      return reply.code(status).send({
        error: status === 401 ? 'SAIPOS_UNAUTHORIZED' : 'SAIPOS_UNAVAILABLE',
        message:
          status === 401
            ? 'A Saipos não aceitou esse token.'
            : probe.message,
      });
    }

    let encrypted: { ciphertext: string; keyVersion: number };
    try {
      encrypted = encryptToken(body.token);
    } catch {
      return reply.code(500).send({
        error: 'TOKEN_KEY_MISSING',
        message: 'Não foi possível guardar o token.',
      });
    }

    const now = new Date();
    const row = await prisma.businessSaiposConnection.upsert({
      where: { businessId: auth.businessId },
      create: {
        businessId: auth.businessId,
        tokenCiphertext: encrypted.ciphertext,
        tokenKeyVersion: encrypted.keyVersion || currentTokenKeyVersion(),
        status: 'connected',
        connectedByTeamMemberId: auth.teamMemberId,
        connectedAt: now,
        cursorUpdatedAt: now,
        lastError: null,
        lastSyncAt: null,
      },
      update: {
        tokenCiphertext: encrypted.ciphertext,
        tokenKeyVersion: encrypted.keyVersion || currentTokenKeyVersion(),
        status: 'connected',
        connectedByTeamMemberId: auth.teamMemberId,
        connectedAt: now,
        cursorUpdatedAt: now,
        lastError: null,
        lastSyncAt: null,
      },
    });

    return { connected: true, connection: saiposConnectionPublic(row) };
  });

  app.delete('/saipos/connection', async (request, reply) => {
    const auth = requireAuth(request);
    if (forbidEmployee(auth.role)) {
      return reply.code(403).send({ error: 'FORBIDDEN' });
    }
    await prisma.businessSaiposConnection.deleteMany({
      where: { businessId: auth.businessId },
    });
    return { connected: false };
  });
};
