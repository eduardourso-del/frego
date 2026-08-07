import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { prisma } from '@frego/db';
import { requireAuth } from '../plugins/auth.js';
import {
  currentTokenKeyVersion,
  encryptToken,
} from '../lib/whatsapp/crypto.js';
import {
  exchangeEmbeddedSignupCode,
  fetchSharedWabaPhone,
  subscribeWabaWebhooks,
} from '../lib/whatsapp/meta-oauth.js';

const callbackBody = z.object({
  code: z.string().min(1),
});

function connectionPublic(row: {
  status: string;
  wabaId: string;
  phoneNumberId: string;
  displayPhoneNumber: string | null;
  verifiedName: string | null;
  qualityRating: string | null;
  messagingLimitTier: string | null;
  templateEarnName: string;
  templateEarnLang: string;
  connectedAt: Date;
  webhookSubscribedAt: Date | null;
  lastError: string | null;
}) {
  return {
    status: row.status,
    wabaId: row.wabaId,
    phoneNumberId: row.phoneNumberId,
    displayPhoneNumber: row.displayPhoneNumber,
    verifiedName: row.verifiedName,
    qualityRating: row.qualityRating,
    messagingLimitTier: row.messagingLimitTier,
    templateEarnName: row.templateEarnName,
    templateEarnLang: row.templateEarnLang,
    connectedAt: row.connectedAt,
    webhookSubscribedAt: row.webhookSubscribedAt,
    lastError: row.lastError,
  };
}

export const whatsappRoutes: FastifyPluginAsync = async (app) => {
  /** Status for current business — never returns secrets. */
  app.get('/whatsapp/connection', async (request) => {
    const auth = requireAuth(request);
    const row = await prisma.businessWhatsAppConnection.findUnique({
      where: { businessId: auth.businessId },
    });
    if (!row || row.status === 'disconnected') {
      return { connected: false, connection: null };
    }
    return { connected: true, connection: connectionPublic(row) };
  });

  /**
   * Complete Meta Embedded Signup: exchange code → persist WABA + phone + token.
   */
  app.post('/whatsapp/oauth/callback', async (request, reply) => {
    const auth = requireAuth(request);
    if (auth.role === 'employee') {
      return reply.code(403).send({ error: 'FORBIDDEN' });
    }

    const { code } = callbackBody.parse(request.body);

    let accessToken: string;
    try {
      const exchanged = await exchangeEmbeddedSignupCode(code);
      accessToken = exchanged.accessToken;
    } catch (err) {
      const status =
        err && typeof err === 'object' && 'statusCode' in err
          ? Number((err as { statusCode: number }).statusCode)
          : 400;
      return reply.code(status).send({
        error: 'META_OAUTH_FAILED',
        message: err instanceof Error ? err.message : 'oauth_failed',
      });
    }

    let shared;
    try {
      shared = await fetchSharedWabaPhone(accessToken);
    } catch (err) {
      const status =
        err && typeof err === 'object' && 'statusCode' in err
          ? Number((err as { statusCode: number }).statusCode)
          : 400;
      return reply.code(status).send({
        error: 'META_WABA_RESOLVE_FAILED',
        message: err instanceof Error ? err.message : 'waba_resolve_failed',
      });
    }

    let encrypted;
    try {
      encrypted = encryptToken(accessToken);
    } catch (err) {
      return reply.code(503).send({
        error: 'TOKEN_ENCRYPTION_NOT_CONFIGURED',
        message: err instanceof Error ? err.message : 'encrypt_failed',
      });
    }

    const subscribed = await subscribeWabaWebhooks(
      shared.wabaId,
      accessToken,
    );

    // phone_number_id is unique — clear if another business held it
    const existingPhone = await prisma.businessWhatsAppConnection.findUnique({
      where: { phoneNumberId: shared.phoneNumberId },
    });
    if (existingPhone && existingPhone.businessId !== auth.businessId) {
      await prisma.businessWhatsAppConnection.delete({
        where: { id: existingPhone.id },
      });
    }

    const row = await prisma.businessWhatsAppConnection.upsert({
      where: { businessId: auth.businessId },
      create: {
        businessId: auth.businessId,
        metaBusinessId: shared.metaBusinessId,
        wabaId: shared.wabaId,
        phoneNumberId: shared.phoneNumberId,
        displayPhoneNumber: shared.displayPhoneNumber,
        verifiedName: shared.verifiedName,
        qualityRating: shared.qualityRating,
        messagingLimitTier: shared.messagingLimitTier,
        tokenCiphertext: encrypted.ciphertext,
        tokenKeyVersion: encrypted.keyVersion || currentTokenKeyVersion(),
        status: 'connected',
        webhookSubscribedAt: subscribed ? new Date() : null,
        connectedAt: new Date(),
        lastError: null,
      },
      update: {
        metaBusinessId: shared.metaBusinessId,
        wabaId: shared.wabaId,
        phoneNumberId: shared.phoneNumberId,
        displayPhoneNumber: shared.displayPhoneNumber,
        verifiedName: shared.verifiedName,
        qualityRating: shared.qualityRating,
        messagingLimitTier: shared.messagingLimitTier,
        tokenCiphertext: encrypted.ciphertext,
        tokenKeyVersion: encrypted.keyVersion || currentTokenKeyVersion(),
        status: 'connected',
        webhookSubscribedAt: subscribed ? new Date() : null,
        connectedAt: new Date(),
        lastError: null,
      },
    });

    request.log.info(
      { businessId: auth.businessId, wabaId: shared.wabaId },
      'whatsapp_connected',
    );

    return {
      connected: true,
      connection: connectionPublic(row),
    };
  });

  app.post('/whatsapp/disconnect', async (request, reply) => {
    const auth = requireAuth(request);
    if (auth.role === 'employee') {
      return reply.code(403).send({ error: 'FORBIDDEN' });
    }

    const row = await prisma.businessWhatsAppConnection.findUnique({
      where: { businessId: auth.businessId },
    });
    if (!row) {
      return { connected: false };
    }

    await prisma.businessWhatsAppConnection.update({
      where: { id: row.id },
      data: {
        status: 'disconnected',
        tokenCiphertext: '',
        lastError: null,
      },
    });

    return { connected: false };
  });
};
