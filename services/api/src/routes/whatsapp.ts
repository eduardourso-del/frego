import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { prisma } from '@frego/db';
import { requireAuth } from '../plugins/auth.js';
import {
  currentTokenKeyVersion,
  decryptToken,
  encryptToken,
} from '../lib/whatsapp/crypto.js';
import { sendWhatsAppTemplate } from '../lib/whatsapp/client.js';
import {
  exchangeEmbeddedSignupCode,
  fetchPhoneCoexistenceFlags,
  fetchSharedWabaPhone,
  initiateSmbAppDataSync,
  registerCloudApiPhone,
  subscribeWabaWebhooks,
} from '../lib/whatsapp/meta-oauth.js';
import {
  CAMPAIGN_TEMPLATE_LANG,
  CAMPAIGN_TEMPLATE_NAME,
  EARN_TEMPLATE_LANG,
  EARN_TEMPLATE_NAME,
  WELCOME_TEMPLATE_LANG,
  WELCOME_TEMPLATE_NAME,
  ensureCampaignTemplate,
  ensureEarnTemplate,
  ensureWelcomeTemplate,
  fetchCampaignTemplateState,
  fetchEarnTemplateState,
  fetchWelcomeTemplateState,
} from '../lib/whatsapp/templates.js';

const callbackBody = z.object({
  code: z.string().min(1),
  /** Meta FINISH_WHATSAPP_BUSINESS_APP_ONBOARDING (keep Business app). */
  coexistence: z.boolean().optional(),
  wabaId: z.string().min(1).optional(),
  phoneNumberId: z.string().min(1).optional(),
});

const testSendBody = z.object({
  toE164: z.string().min(8).max(32),
});

function normalizeToE164(raw: string): string | null {
  const digits = raw.replace(/\D/g, '');
  if (digits.length < 10) return null;
  if (digits.startsWith('55') && digits.length >= 12) return `+${digits}`;
  if (digits.length === 10 || digits.length === 11) return `+55${digits}`;
  if (raw.trim().startsWith('+') && digits.length >= 10) return `+${digits}`;
  return `+${digits}`;
}

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
  templateEarnStatus: string;
  templateEarnId: string | null;
  templateEarnSyncedAt: Date | null;
  templateWelcomeName: string;
  templateWelcomeLang: string;
  templateWelcomeStatus: string;
  templateWelcomeId: string | null;
  templateWelcomeSyncedAt: Date | null;
  templateCampaignName: string;
  templateCampaignLang: string;
  templateCampaignStatus: string;
  templateCampaignId: string | null;
  templateCampaignSyncedAt: Date | null;
  coexistence: boolean;
  smbSyncStartedAt: Date | null;
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
    templateEarnStatus: row.templateEarnStatus,
    templateEarnId: row.templateEarnId,
    templateEarnSyncedAt: row.templateEarnSyncedAt,
    templateWelcomeName: row.templateWelcomeName,
    templateWelcomeLang: row.templateWelcomeLang,
    templateWelcomeStatus: row.templateWelcomeStatus,
    templateWelcomeId: row.templateWelcomeId,
    templateWelcomeSyncedAt: row.templateWelcomeSyncedAt,
    templateCampaignName: row.templateCampaignName,
    templateCampaignLang: row.templateCampaignLang,
    templateCampaignStatus: row.templateCampaignStatus,
    templateCampaignId: row.templateCampaignId,
    templateCampaignSyncedAt: row.templateCampaignSyncedAt,
    coexistence: row.coexistence,
    smbSyncStartedAt: row.smbSyncStartedAt,
    connectedAt: row.connectedAt,
    webhookSubscribedAt: row.webhookSubscribedAt,
    lastError: row.lastError,
  };
}

async function applyEarnTemplateState(
  connectionId: string,
  accessToken: string,
  wabaId: string,
  mode: 'ensure' | 'sync',
) {
  const result =
    mode === 'ensure'
      ? await ensureEarnTemplate(wabaId, accessToken)
      : await fetchEarnTemplateState(wabaId, accessToken);

  return prisma.businessWhatsAppConnection.update({
    where: { id: connectionId },
    data: {
      templateEarnName: EARN_TEMPLATE_NAME,
      templateEarnLang: EARN_TEMPLATE_LANG,
      templateEarnStatus: result.status,
      templateEarnId: result.templateId,
      templateEarnSyncedAt: new Date(),
      ...(result.error && result.status === 'missing'
        ? { lastError: result.error }
        : result.status === 'approved'
          ? { lastError: null }
          : {}),
    },
  });
}

async function applyWelcomeTemplateState(
  connectionId: string,
  accessToken: string,
  wabaId: string,
  mode: 'ensure' | 'sync',
) {
  const result =
    mode === 'ensure'
      ? await ensureWelcomeTemplate(wabaId, accessToken)
      : await fetchWelcomeTemplateState(wabaId, accessToken);

  return prisma.businessWhatsAppConnection.update({
    where: { id: connectionId },
    data: {
      templateWelcomeName: WELCOME_TEMPLATE_NAME,
      templateWelcomeLang: WELCOME_TEMPLATE_LANG,
      templateWelcomeStatus: result.status,
      templateWelcomeId: result.templateId,
      templateWelcomeSyncedAt: new Date(),
      ...(result.error && result.status === 'missing'
        ? { lastError: result.error }
        : {}),
    },
  });
}

async function applyCampaignTemplateState(
  connectionId: string,
  accessToken: string,
  wabaId: string,
  mode: 'ensure' | 'sync',
) {
  const result =
    mode === 'ensure'
      ? await ensureCampaignTemplate(wabaId, accessToken)
      : await fetchCampaignTemplateState(wabaId, accessToken);

  return prisma.businessWhatsAppConnection.update({
    where: { id: connectionId },
    data: {
      templateCampaignName: CAMPAIGN_TEMPLATE_NAME,
      templateCampaignLang: CAMPAIGN_TEMPLATE_LANG,
      templateCampaignStatus: result.status,
      templateCampaignId: result.templateId,
      templateCampaignSyncedAt: new Date(),
      ...(result.error && result.status === 'missing'
        ? { lastError: result.error }
        : {}),
    },
  });
}

async function applyAllTemplateStates(
  connectionId: string,
  accessToken: string,
  wabaId: string,
  mode: 'ensure' | 'sync',
) {
  await applyEarnTemplateState(connectionId, accessToken, wabaId, mode);
  await applyWelcomeTemplateState(connectionId, accessToken, wabaId, mode);
  return applyCampaignTemplateState(connectionId, accessToken, wabaId, mode);
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

    const parsed = callbackBody.parse(request.body);
    const { code } = parsed;

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
      shared = await fetchSharedWabaPhone(accessToken, {
        preferredPhoneNumberId: parsed.phoneNumberId ?? null,
        preferredWabaId: parsed.wabaId ?? null,
      });
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

    const phoneFlags = await fetchPhoneCoexistenceFlags(
      shared.phoneNumberId,
      accessToken,
    );
    const coexistence =
      Boolean(parsed.coexistence) || phoneFlags.isOnBizApp;

    const subscribed = await subscribeWabaWebhooks(
      shared.wabaId,
      accessToken,
    );

    // Coexistence numbers are already registered on Cloud API — do not re-register.
    let registerError: string | null = null;
    if (!coexistence) {
      const registered = await registerCloudApiPhone(
        shared.phoneNumberId,
        accessToken,
      );
      if (!registered.ok) {
        registerError = registered.error ?? 'PHONE_NOT_REGISTERED';
        request.log.warn(
          {
            businessId: auth.businessId,
            phoneNumberId: shared.phoneNumberId,
            error: registerError,
          },
          'whatsapp_phone_register_failed',
        );
      }
    }

    let smbContactsSyncRequestId: string | null = null;
    let smbHistorySyncRequestId: string | null = null;
    let smbSyncStartedAt: Date | null = null;
    let smbSyncError: string | null = null;

    if (coexistence) {
      // Meta requires contacts + history sync within 24h of coexistence onboard.
      const contacts = await initiateSmbAppDataSync(
        shared.phoneNumberId,
        accessToken,
        'smb_app_state_sync',
      );
      const history = await initiateSmbAppDataSync(
        shared.phoneNumberId,
        accessToken,
        'history',
      );
      smbSyncStartedAt = new Date();
      smbContactsSyncRequestId = contacts.requestId ?? null;
      smbHistorySyncRequestId = history.requestId ?? null;
      if (!contacts.ok || !history.ok) {
        smbSyncError = [contacts.error, history.error]
          .filter(Boolean)
          .join('; ');
        request.log.warn(
          {
            businessId: auth.businessId,
            phoneNumberId: shared.phoneNumberId,
            contactsOk: contacts.ok,
            historyOk: history.ok,
            error: smbSyncError,
          },
          'whatsapp_smb_sync_failed',
        );
      }
    }

    // phone_number_id is unique — clear if another business held it
    const existingPhone = await prisma.businessWhatsAppConnection.findUnique({
      where: { phoneNumberId: shared.phoneNumberId },
    });
    if (existingPhone && existingPhone.businessId !== auth.businessId) {
      await prisma.businessWhatsAppConnection.delete({
        where: { id: existingPhone.id },
      });
    }

    const lastError = coexistence
      ? smbSyncError
      : registerError;

    let row = await prisma.businessWhatsAppConnection.upsert({
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
        templateEarnName: EARN_TEMPLATE_NAME,
        templateEarnLang: EARN_TEMPLATE_LANG,
        templateEarnStatus: 'missing',
        coexistence,
        smbSyncStartedAt,
        smbContactsSyncRequestId,
        smbHistorySyncRequestId,
        status: 'connected',
        webhookSubscribedAt: subscribed ? new Date() : null,
        connectedAt: new Date(),
        lastError,
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
        templateEarnName: EARN_TEMPLATE_NAME,
        templateEarnLang: EARN_TEMPLATE_LANG,
        coexistence,
        smbSyncStartedAt,
        smbContactsSyncRequestId,
        smbHistorySyncRequestId,
        status: 'connected',
        webhookSubscribedAt: subscribed ? new Date() : null,
        connectedAt: new Date(),
        lastError,
      },
    });

    try {
      row = await applyAllTemplateStates(
        row.id,
        accessToken,
        shared.wabaId,
        'ensure',
      );
    } catch (err) {
      request.log.warn(
        {
          businessId: auth.businessId,
          error: err instanceof Error ? err.message : 'template_ensure_failed',
        },
        'whatsapp_template_ensure_failed',
      );
    }

    request.log.info(
      {
        businessId: auth.businessId,
        wabaId: shared.wabaId,
        coexistence,
        templateStatus: row.templateEarnStatus,
      },
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
        templateEarnStatus: 'missing',
        templateEarnId: null,
        templateEarnSyncedAt: null,
        templateWelcomeStatus: 'missing',
        templateWelcomeId: null,
        templateWelcomeSyncedAt: null,
        templateCampaignStatus: 'missing',
        templateCampaignId: null,
        templateCampaignSyncedAt: null,
        coexistence: false,
        smbSyncStartedAt: null,
        smbContactsSyncRequestId: null,
        smbHistorySyncRequestId: null,
      },
    });

    return { connected: false };
  });

  /** Re-run Cloud API phone registration for the connected number. */
  app.post('/whatsapp/register-phone', async (request, reply) => {
    const auth = requireAuth(request);
    if (auth.role === 'employee') {
      return reply.code(403).send({ error: 'FORBIDDEN' });
    }

    const row = await prisma.businessWhatsAppConnection.findUnique({
      where: { businessId: auth.businessId },
    });
    if (!row || row.status === 'disconnected' || !row.tokenCiphertext) {
      return reply.code(400).send({ error: 'NOT_CONNECTED' });
    }
    if (row.coexistence) {
      return reply.code(400).send({
        error: 'COEXISTENCE_NO_REGISTER',
        message:
          'Número em coexistência (app Business + API). Não use /register.',
      });
    }

    let accessToken: string;
    try {
      accessToken = decryptToken(row.tokenCiphertext, row.tokenKeyVersion);
    } catch (err) {
      return reply.code(503).send({
        error: 'TOKEN_DECRYPT_FAILED',
        message: err instanceof Error ? err.message : 'decrypt_failed',
      });
    }

    const registered = await registerCloudApiPhone(
      row.phoneNumberId,
      accessToken,
    );
    const updated = await prisma.businessWhatsAppConnection.update({
      where: { id: row.id },
      data: {
        lastError: registered.ok
          ? null
          : (registered.error ?? 'PHONE_NOT_REGISTERED'),
      },
    });

    if (!registered.ok) {
      return reply.code(400).send({
        error: 'REGISTER_FAILED',
        message: registered.error,
        connection: connectionPublic(updated),
      });
    }

    return {
      ok: true,
      connection: connectionPublic(updated),
    };
  });

  /**
   * Create earn template on the WABA if missing, or refresh approval status.
   */
  app.post('/whatsapp/ensure-template', async (request, reply) => {
    const auth = requireAuth(request);
    if (auth.role === 'employee') {
      return reply.code(403).send({ error: 'FORBIDDEN' });
    }

    const row = await prisma.businessWhatsAppConnection.findUnique({
      where: { businessId: auth.businessId },
    });
    if (!row || row.status === 'disconnected' || !row.tokenCiphertext) {
      return reply.code(400).send({ error: 'NOT_CONNECTED' });
    }

    let accessToken: string;
    try {
      accessToken = decryptToken(row.tokenCiphertext, row.tokenKeyVersion);
    } catch (err) {
      return reply.code(503).send({
        error: 'TOKEN_DECRYPT_FAILED',
        message: err instanceof Error ? err.message : 'decrypt_failed',
      });
    }

    try {
      const updated = await applyAllTemplateStates(
        row.id,
        accessToken,
        row.wabaId,
        'ensure',
      );
      return { ok: true, connection: connectionPublic(updated) };
    } catch (err) {
      return reply.code(400).send({
        error: 'TEMPLATE_ENSURE_FAILED',
        message: err instanceof Error ? err.message : 'ensure_failed',
      });
    }
  });

  /** Refresh earn template status from Meta without creating. */
  app.post('/whatsapp/sync-template', async (request, reply) => {
    const auth = requireAuth(request);
    if (auth.role === 'employee') {
      return reply.code(403).send({ error: 'FORBIDDEN' });
    }

    const row = await prisma.businessWhatsAppConnection.findUnique({
      where: { businessId: auth.businessId },
    });
    if (!row || row.status === 'disconnected' || !row.tokenCiphertext) {
      return reply.code(400).send({ error: 'NOT_CONNECTED' });
    }

    let accessToken: string;
    try {
      accessToken = decryptToken(row.tokenCiphertext, row.tokenKeyVersion);
    } catch (err) {
      return reply.code(503).send({
        error: 'TOKEN_DECRYPT_FAILED',
        message: err instanceof Error ? err.message : 'decrypt_failed',
      });
    }

    try {
      const updated = await applyAllTemplateStates(
        row.id,
        accessToken,
        row.wabaId,
        'sync',
      );
      return { ok: true, connection: connectionPublic(updated) };
    } catch (err) {
      return reply.code(400).send({
        error: 'TEMPLATE_SYNC_FAILED',
        message: err instanceof Error ? err.message : 'sync_failed',
      });
    }
  });

  /**
   * Send a sample earn template to a phone for pre–App Review testing / demos.
   * Requires connected WABA + approved template.
   */
  app.post('/whatsapp/test-send', async (request, reply) => {
    const auth = requireAuth(request);
    if (auth.role === 'employee') {
      return reply.code(403).send({ error: 'FORBIDDEN' });
    }

    const { toE164: rawTo } = testSendBody.parse(request.body);
    const toE164 = normalizeToE164(rawTo);
    if (!toE164) {
      return reply.code(400).send({
        error: 'INVALID_PHONE',
        message: 'Informe um telefone válido com DDI (ex.: +5511999999999).',
      });
    }

    const row = await prisma.businessWhatsAppConnection.findUnique({
      where: { businessId: auth.businessId },
    });
    if (!row || row.status === 'disconnected' || !row.tokenCiphertext) {
      return reply.code(400).send({ error: 'NOT_CONNECTED' });
    }
    if (row.templateEarnStatus !== 'approved') {
      return reply.code(400).send({
        error: 'TEMPLATE_NOT_APPROVED',
        message:
          'Aguarde o template frego_earn_summary ser aprovado (ou sincronize o status).',
        connection: connectionPublic(row),
      });
    }

    let accessToken: string;
    try {
      accessToken = decryptToken(row.tokenCiphertext, row.tokenKeyVersion);
    } catch (err) {
      return reply.code(503).send({
        error: 'TOKEN_DECRYPT_FAILED',
        message: err instanceof Error ? err.message : 'decrypt_failed',
      });
    }

    const business = await prisma.business.findUnique({
      where: { id: auth.businessId },
      select: { name: true },
    });

    const result = await sendWhatsAppTemplate({
      accessToken,
      phoneNumberId: row.phoneNumberId,
      toE164,
      templateName: row.templateEarnName,
      languageCode: row.templateEarnLang,
      bodyParams: [
        business?.name ?? 'Frego',
        '1 carimbo de teste',
        'Saldo de teste: 1 carimbo',
        'Mensagem de teste do Frego (pré-App Review).',
      ],
    });

    if (!result.ok) {
      const updated = await prisma.businessWhatsAppConnection.update({
        where: { id: row.id },
        data: { lastError: result.error ?? 'test_send_failed' },
      });
      return reply.code(400).send({
        error: 'TEST_SEND_FAILED',
        message: result.error,
        connection: connectionPublic(updated),
      });
    }

    await prisma.businessWhatsAppConnection.update({
      where: { id: row.id },
      data: { lastError: null },
    });

    return {
      ok: true,
      messageId: result.messageId ?? null,
      toE164,
    };
  });
};
