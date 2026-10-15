import { prisma } from '@frego/db';
import { decryptToken, encryptToken } from './crypto.js';
import {
  exchangeLongLivedToken,
  inspectAccessToken,
  probePhoneAccess,
  type AccessTokenInspection,
} from './meta-oauth.js';
import {
  WHATSAPP_GRANT_LOST_MESSAGE,
  chooseExchangedToken,
  interpretAccess,
  isGrantLostSend,
  needsHealthCheck,
  needsRenewal,
} from './token-grant.js';

type Log = (msg: string, extra?: Record<string, unknown>) => void;

export type MaintainResult = {
  skipped: boolean;
  renewed: boolean;
  grantLost: boolean;
  decryptFailed: boolean;
  expiresAt: Date | null;
  accessToken?: string;
  error?: string;
};

const idle: MaintainResult = {
  skipped: true,
  renewed: false,
  grantLost: false,
  decryptFailed: false,
  expiresAt: null,
};

export type AdoptedToken = {
  ok: true;
  accessToken: string;
  expiresAt: Date | null;
  inspected: boolean;
  extended: boolean;
};

/**
 * On connect: keep a token that can send, and exchange it for a longer one
 * when Meta still includes whatsapp_business_messaging.
 */
export async function adoptBusinessToken(
  accessToken: string,
  phoneNumberId: string,
  log?: Log,
): Promise<AdoptedToken | { ok: false; reason: 'grant_lost' }> {
  const inspected = await inspectAccessToken(accessToken);
  if (!inspected.ok) {
    log?.('whatsapp_token_inspect_failed', { error: inspected.error });
    return {
      ok: true,
      accessToken,
      expiresAt: null,
      inspected: false,
      extended: false,
    };
  }

  const access = await classify(inspected.inspection, accessToken, phoneNumberId);
  if (access === 'lost') return { ok: false, reason: 'grant_lost' };
  if (access === 'unknown') {
    return {
      ok: true,
      accessToken,
      expiresAt: inspected.inspection.expiresAt,
      inspected: true,
      extended: false,
    };
  }

  const refreshed = await refreshIfBetter(accessToken, inspected.inspection, log);
  return {
    ok: true,
    accessToken: refreshed.accessToken,
    expiresAt: refreshed.expiresAt,
    inspected: true,
    extended: refreshed.extended,
  };
}

export async function maintainStoredConnection(
  connectionId: string,
  opts?: { force?: boolean; log?: Log },
): Promise<MaintainResult> {
  const row = await prisma.businessWhatsAppConnection.findUnique({
    where: { id: connectionId },
  });
  if (!row || row.status !== 'connected' || !row.tokenCiphertext) {
    return { ...idle, grantLost: row?.status === 'error' };
  }

  // One check a day. Renewal runs inside that check, so a failed exchange
  // waits until the next day instead of retrying on every stamp.
  const due = Boolean(opts?.force) || needsHealthCheck(row.tokenCheckedAt);
  let accessToken: string;
  try {
    accessToken = decryptToken(row.tokenCiphertext, row.tokenKeyVersion);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'decrypt_failed';
    await prisma.businessWhatsAppConnection.update({
      where: { id: row.id },
      data: { status: 'error', lastError: message },
    });
    return { ...idle, skipped: false, decryptFailed: true, error: message };
  }

  if (!due) {
    return { ...idle, expiresAt: row.tokenExpiresAt, accessToken };
  }

  const inspected = await inspectAccessToken(accessToken);
  if (!inspected.ok) {
    opts?.log?.('whatsapp_token_inspect_failed', {
      businessId: row.businessId,
      error: inspected.error,
    });
    return { ...idle, expiresAt: row.tokenExpiresAt, accessToken };
  }

  const access = await classify(
    inspected.inspection,
    accessToken,
    row.phoneNumberId,
  );
  if (access === 'unknown') {
    opts?.log?.('whatsapp_token_check_unknown', { businessId: row.businessId });
    await prisma.businessWhatsAppConnection.update({
      where: { id: row.id },
      data: { tokenCheckedAt: new Date() },
    });
    return { ...idle, expiresAt: row.tokenExpiresAt, accessToken };
  }
  if (access === 'lost') {
    await markWhatsAppGrantLost(row.id, opts?.log);
    return { ...idle, skipped: false, grantLost: true };
  }

  const shouldExchange = needsRenewal(inspected.inspection);
  const refreshed = shouldExchange
    ? await refreshIfBetter(accessToken, inspected.inspection, opts?.log)
    : {
        accessToken,
        expiresAt: inspected.inspection.neverExpires
          ? null
          : (inspected.inspection.expiresAt ?? row.tokenExpiresAt),
        extended: false,
      };

  if (refreshed.extended && refreshed.accessToken !== accessToken) {
    const encrypted = encryptToken(refreshed.accessToken);
    await prisma.businessWhatsAppConnection.update({
      where: { id: row.id },
      data: {
        tokenCiphertext: encrypted.ciphertext,
        tokenKeyVersion: encrypted.keyVersion,
        tokenExpiresAt: refreshed.expiresAt,
        tokenCheckedAt: new Date(),
        lastError: null,
      },
    });
    opts?.log?.('whatsapp_token_renewed', { businessId: row.businessId });
    return {
      skipped: false,
      renewed: true,
      grantLost: false,
      decryptFailed: false,
      expiresAt: refreshed.expiresAt,
      accessToken: refreshed.accessToken,
    };
  }

  await prisma.businessWhatsAppConnection.update({
    where: { id: row.id },
    data: {
      tokenExpiresAt: inspected.inspection.neverExpires
        ? null
        : (refreshed.expiresAt ?? row.tokenExpiresAt),
      tokenCheckedAt: new Date(),
    },
  });
  return {
    skipped: false,
    renewed: false,
    grantLost: false,
    decryptFailed: false,
    expiresAt: refreshed.expiresAt,
    accessToken: refreshed.accessToken,
  };
}

export async function maintainAllWhatsAppConnections(log?: Log): Promise<
  Array<{
    businessId: string;
    renewed: boolean;
    grantLost: boolean;
    skipped: boolean;
  }>
> {
  const rows = await prisma.businessWhatsAppConnection.findMany({
    where: { status: 'connected' },
    select: { id: true, businessId: true },
  });
  const results = [];
  for (const row of rows) {
    try {
      const result = await maintainStoredConnection(row.id, { force: true, log });
      results.push({
        businessId: row.businessId,
        renewed: result.renewed,
        grantLost: result.grantLost,
        skipped: result.skipped,
      });
    } catch (err) {
      log?.('whatsapp_maintain_failed', {
        businessId: row.businessId,
        error: err instanceof Error ? err.message : 'maintain_failed',
      });
    }
  }
  return results;
}

export async function markWhatsAppGrantLost(
  connectionId: string,
  log?: Log,
): Promise<void> {
  await prisma.businessWhatsAppConnection.update({
    where: { id: connectionId },
    data: {
      status: 'error',
      lastError: WHATSAPP_GRANT_LOST_MESSAGE,
      tokenCheckedAt: new Date(),
    },
  });
  log?.('whatsapp_grant_lost', { connectionId });
}

export async function markWhatsAppGrantLostByWaba(wabaId: string): Promise<void> {
  await prisma.businessWhatsAppConnection.updateMany({
    where: { wabaId, status: { not: 'disconnected' } },
    data: {
      status: 'error',
      lastError: WHATSAPP_GRANT_LOST_MESSAGE,
      tokenCheckedAt: new Date(),
    },
  });
}

export async function recordWhatsAppSendFailure(
  connectionId: string,
  result: { error?: string; errorCode?: number; errorSubcode?: number },
  log?: Log,
): Promise<'grant_lost' | 'failed'> {
  if (
    isGrantLostSend({
      code: result.errorCode,
      subcode: result.errorSubcode,
      message: result.error,
    })
  ) {
    await markWhatsAppGrantLost(connectionId, log);
    return 'grant_lost';
  }
  await prisma.businessWhatsAppConnection.update({
    where: { id: connectionId },
    data: { lastError: (result.error ?? 'send_failed').slice(0, 500) },
  });
  return 'failed';
}

async function classify(
  inspection: AccessTokenInspection,
  accessToken: string,
  phoneNumberId: string,
): Promise<'healthy' | 'lost' | 'unknown'> {
  if (!inspection.valid) return 'lost';
  if (inspection.hasMessaging) return 'healthy';
  const probe = await probePhoneAccess(phoneNumberId, accessToken);
  return interpretAccess(inspection, probe);
}

async function refreshIfBetter(
  accessToken: string,
  current: AccessTokenInspection,
  log?: Log,
): Promise<{ accessToken: string; expiresAt: Date | null; extended: boolean }> {
  const exchanged = await exchangeLongLivedToken(accessToken);
  if (!exchanged.ok) {
    log?.('whatsapp_token_exchange_failed', { error: exchanged.error });
    return { accessToken, expiresAt: current.expiresAt, extended: false };
  }
  const next = await inspectAccessToken(exchanged.accessToken);
  if (!next.ok) {
    log?.('whatsapp_token_inspect_failed', { error: next.error });
    return { accessToken, expiresAt: current.expiresAt, extended: false };
  }
  if (chooseExchangedToken(current, next.inspection) === 'current') {
    log?.('whatsapp_token_exchange_discarded', {
      hasMessaging: next.inspection.hasMessaging,
    });
    return { accessToken, expiresAt: current.expiresAt, extended: false };
  }
  return {
    accessToken: exchanged.accessToken,
    expiresAt: next.inspection.expiresAt,
    extended: true,
  };
}
