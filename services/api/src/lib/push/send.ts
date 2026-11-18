import { prisma } from '@frego/db';
import type { MulticastMessage } from 'firebase-admin/messaging';
import { getFirebaseMessaging } from '../firebase.js';

export const FCM_BATCH_SIZE = 500;

/** Public https logo, or null when the estabelecimento has nothing we can show. */
export function pushLogoUrl(value: string | null | undefined): string | null {
  const trimmed = value?.trim();
  if (!trimmed) return null;
  try {
    const url = new URL(trimmed);
    if (url.protocol !== 'https:') return null;
    return url.toString();
  } catch {
    return null;
  }
}

export async function businessPushLogo(
  businessId: string,
): Promise<string | null> {
  const business = await prisma.business.findUnique({
    where: { id: businessId },
    select: { logoUrl: true },
  });
  return pushLogoUrl(business?.logoUrl);
}

/**
 * Alert for both platforms.
 *
 * Android is data-only so the app can draw the logo as the small right-hand
 * picture. An FCM image becomes a wide picture when the notification opens.
 * iOS keeps a normal alert. `logoUrl` asks the notification extension to
 * attach that same small picture.
 */
export function fcmAlertMessage(input: {
  tokens: string[];
  title: string;
  body: string;
  data: Record<string, string>;
  logoUrl?: string | null;
}): MulticastMessage {
  const logo = pushLogoUrl(input.logoUrl);
  const data: Record<string, string> = {
    ...input.data,
    title: input.title,
    body: input.body,
  };
  if (logo) data.logoUrl = logo;
  return {
    tokens: input.tokens,
    data,
    android: { priority: 'high' },
    apns: apnsWithData(
      data,
      { title: input.title, body: input.body },
      logo != null,
    ),
  };
}

/** iOS needs custom keys next to `aps` or a tap arrives with an empty data map. */
export function apnsWithData(
  data: Record<string, string>,
  alert?: { title: string; body: string },
  mutableContent = false,
): NonNullable<MulticastMessage['apns']> {
  return {
    headers: {
      'apns-priority': '10',
      ...(alert ? { 'apns-push-type': 'alert' } : {}),
    },
    payload: {
      aps: {
        sound: 'default',
        ...(alert ? { alert } : {}),
        ...(mutableContent ? { mutableContent: true } : {}),
      },
      ...data,
    },
  };
}

const STALE_FCM_TOKEN_CODES = new Set([
  'messaging/registration-token-not-registered',
  'messaging/invalid-registration-token',
]);

export function chunkTokens(
  tokens: string[],
  size = FCM_BATCH_SIZE,
): string[][] {
  if (size <= 0) return [tokens];
  const chunks: string[][] = [];
  for (let i = 0; i < tokens.length; i += size) {
    chunks.push(tokens.slice(i, i + size));
  }
  return chunks;
}

export function isStaleFcmTokenError(error: {
  code?: string;
} | null | undefined): boolean {
  return Boolean(error?.code && STALE_FCM_TOKEN_CODES.has(error.code));
}

export async function sendAndPruneFcm(
  buildMessage: (tokens: string[]) => MulticastMessage,
  tokens: string[],
): Promise<{ sentCount: number; failedCount: number; errors: string[] }> {
  if (tokens.length === 0) {
    return { sentCount: 0, failedCount: 0, errors: [] };
  }

  const messaging = getFirebaseMessaging();
  let sentCount = 0;
  let failedCount = 0;
  const staleTokens: string[] = [];
  const errors: string[] = [];

  for (const batch of chunkTokens(tokens)) {
    const response = await messaging.sendEachForMulticast(buildMessage(batch));
    sentCount += response.successCount;
    failedCount += response.failureCount;
    response.responses.forEach((item, index) => {
      if (item.success) return;
      const token = batch[index];
      const code = item.error?.code ?? item.error?.message ?? 'unknown';
      if (!errors.includes(code)) errors.push(code);
      if (token && isStaleFcmTokenError(item.error)) {
        staleTokens.push(token);
      }
    });
  }

  if (staleTokens.length) {
    await prisma.deviceToken.deleteMany({
      where: { token: { in: staleTokens } },
    });
  }

  return { sentCount, failedCount, errors };
}
