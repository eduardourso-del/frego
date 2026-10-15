/** Renew while the business token is still inside this window. */
export const RENEW_WITHIN_MS = 14 * 24 * 60 * 60 * 1000;

/** Ask Meta again after this, even when expiry is far away. */
export const CHECK_INTERVAL_MS = 24 * 60 * 60 * 1000;

export const WHATSAPP_GRANT_LOST_MESSAGE =
  'A Meta retirou o acesso a este WhatsApp. Conecte de novo para os avisos voltarem.';

const OFFBOARD_EVENTS = new Set([
  'PARTNER_REMOVED',
  'PARTNER_APP_UNINSTALLED',
  'ACCOUNT_OFFBOARDED',
  'ACCOUNT_DELETED',
  'DISABLED_UPDATE',
]);

export type TokenClock = {
  expiresAt: Date | null;
  neverExpires: boolean;
};

export function isPartnerOffboardEvent(event: string | undefined): boolean {
  return Boolean(event && OFFBOARD_EVENTS.has(event));
}

export function isGrantLostSend(error: {
  code?: number;
  subcode?: number;
  message?: string;
}): boolean {
  if (error.code === 190) return true;
  if (error.code === 100 && error.subcode === 33) return true;
  return /missing permissions|cannot be loaded due to missing permissions/i.test(
    error.message ?? '',
  );
}

export function needsRenewal(token: TokenClock, now = new Date()): boolean {
  if (token.neverExpires || !token.expiresAt) return false;
  return token.expiresAt.getTime() - now.getTime() <= RENEW_WITHIN_MS;
}

export function needsHealthCheck(checkedAt: Date | null, now = new Date()): boolean {
  if (!checkedAt) return true;
  return now.getTime() - checkedAt.getTime() >= CHECK_INTERVAL_MS;
}

/**
 * A token with no messaging scope can still be healthy if the phone answers.
 * A failed phone read plus a missing scope means Meta dropped the grant.
 */
export function interpretAccess(
  inspection: { valid: boolean; hasMessaging: boolean } | null,
  probe: 'ok' | 'lost' | 'unknown',
): 'healthy' | 'lost' | 'unknown' {
  if (!inspection) return 'unknown';
  if (!inspection.valid) return 'lost';
  if (inspection.hasMessaging) return 'healthy';
  if (probe === 'lost') return 'lost';
  if (probe === 'ok') return 'healthy';
  return 'unknown';
}

export function chooseExchangedToken(
  current: TokenClock & { valid: boolean; hasMessaging: boolean },
  exchanged: (TokenClock & { valid: boolean; hasMessaging: boolean }) | null,
): 'current' | 'exchanged' {
  if (!exchanged?.valid || !exchanged.hasMessaging) return 'current';
  if (!current.valid || !current.hasMessaging) return 'exchanged';
  if (exchanged.neverExpires && !current.neverExpires) return 'exchanged';
  if (current.neverExpires && !exchanged.neverExpires) return 'current';
  if (!exchanged.neverExpires && !exchanged.expiresAt && current.expiresAt) {
    return 'current';
  }
  if (
    exchanged.expiresAt &&
    current.expiresAt &&
    exchanged.expiresAt.getTime() < current.expiresAt.getTime()
  ) {
    return 'current';
  }
  return 'exchanged';
}
