import { prisma } from '@frego/db';
import type { MulticastMessage } from 'firebase-admin/messaging';
import { getFirebaseMessaging } from '../firebase.js';

export const FCM_BATCH_SIZE = 500;

/** iOS needs custom keys next to `aps` or a tap arrives with an empty data map. */
export function apnsWithData(
  data: Record<string, string>,
): NonNullable<MulticastMessage['apns']> {
  return {
    headers: { 'apns-priority': '10' },
    payload: {
      aps: { sound: 'default' },
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
