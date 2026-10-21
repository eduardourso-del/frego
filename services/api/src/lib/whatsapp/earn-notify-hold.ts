import { GoogleAuth } from 'google-auth-library';
import { Prisma, prisma } from '@frego/db';
import type { WalletSnapshot } from '../wallet.js';
import type { EarnNotifyInput } from './earn-message.js';
import {
  EARN_NOTIFY_FLUSH_DELAY_MS,
  EARN_NOTIFY_QUIET_MS,
  activeHold,
  holdToNotifyInput,
  mergeEarnHold,
  parseEarnHoldPayload,
  payloadFromInput,
  releaseEarnHold,
  type EarnNotifyHoldPayload,
} from './earn-hold.js';
import { deliverEarnNotify } from './earn-notify.js';

const FLUSH_BATCH = 20;
const FLUSH_INTERVAL_MS = 5_000;

const tasksAuth = new GoogleAuth({
  scopes: ['https://www.googleapis.com/auth/cloud-tasks'],
});

type HoldLog = NonNullable<EarnNotifyInput['log']>;

function isUniqueConflict(err: unknown): boolean {
  return (
    err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002'
  );
}

function isMissingHoldTable(err: unknown): boolean {
  return (
    err instanceof Error &&
    err.message.includes('earn_notify_holds') &&
    err.message.includes('does not exist')
  );
}

function toJson(payload: EarnNotifyHoldPayload): Prisma.InputJsonValue {
  return JSON.parse(JSON.stringify(payload)) as Prisma.InputJsonValue;
}

/**
 * Fold this earn into the open hold, or start one.
 * Returns the previous burst when it cannot share this window and must send now.
 */
export async function stageEarnNotify(
  input: EarnNotifyInput,
): Promise<EarnNotifyHoldPayload | null> {
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      return await prisma.$transaction(async (tx) => {
        const locked = await tx.$queryRaw<{ id: string; payload: unknown }[]>`
          SELECT id, payload
          FROM earn_notify_holds
          WHERE business_id = ${input.businessId}
            AND customer_id = ${input.customerId}
          FOR UPDATE
        `;
        const row = locked[0] ?? null;
        const existing = activeHold(
          row ? parseEarnHoldPayload(row.payload) : null,
        );
        const merged = mergeEarnHold(existing, input);
        const sendAfter = new Date(Date.now() + EARN_NOTIFY_QUIET_MS);
        const payload = toJson(merged.next);

        if (row && merged.flushNow) {
          await tx.earnNotifyHold.delete({ where: { id: row.id } });
        }
        if (!row || merged.flushNow) {
          await tx.earnNotifyHold.create({
            data: {
              businessId: input.businessId,
              customerId: input.customerId,
              sendAfter,
              payload,
            },
          });
        } else {
          await tx.earnNotifyHold.update({
            where: { id: row.id },
            data: {
              sendAfter,
              payload,
              version: { increment: 1 },
            },
          });
        }
        return merged.flushNow;
      });
    } catch (err) {
      if (attempt === 0 && isUniqueConflict(err)) continue;
      throw err;
    }
  }
  return null;
}

/** Drop a reversed sale from the open hold. No-op when the message already went out. */
export async function releaseEarnNotifyHold(input: {
  businessId: string;
  customerId: string;
  saleId: string | null;
  transactionIds: string[];
  wallet: WalletSnapshot;
}): Promise<void> {
  await prisma.$transaction(async (tx) => {
    const locked = await tx.$queryRaw<{ id: string; payload: unknown }[]>`
      SELECT id, payload
      FROM earn_notify_holds
      WHERE business_id = ${input.businessId}
        AND customer_id = ${input.customerId}
      FOR UPDATE
    `;
    const row = locked[0];
    if (!row) return;
    const existing = activeHold(parseEarnHoldPayload(row.payload));
    if (!existing) {
      await tx.earnNotifyHold.delete({ where: { id: row.id } });
      return;
    }
    const next = releaseEarnHold(
      existing,
      { saleId: input.saleId, transactionIds: input.transactionIds },
      input.wallet,
    );
    if (!next) {
      await tx.earnNotifyHold.delete({ where: { id: row.id } });
      return;
    }
    await tx.earnNotifyHold.update({
      where: { id: row.id },
      data: {
        payload: toJson(next),
        version: { increment: 1 },
      },
    });
  });
}

type HeldRow = {
  id: string;
  version: number;
  payload: Prisma.JsonValue;
};

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Mark this version sent, then deliver it.
 * A newer earn wins the version check and is left in place.
 * The row stays so a second task for the same burst does not send again.
 */
async function sendClaimedHold(row: HeldRow, log?: HoldLog): Promise<boolean> {
  const payload = parseEarnHoldPayload(row.payload);
  if (!payload) {
    log?.('earn_notify_hold_invalid', { id: row.id });
    await prisma.earnNotifyHold.deleteMany({ where: { id: row.id } });
    return false;
  }
  if (payload.sentAt) {
    log?.('earn_notify_flush_already_sent', { id: row.id });
    return false;
  }
  const marked = await prisma.earnNotifyHold.updateMany({
    where: { id: row.id, version: row.version },
    data: {
      version: { increment: 1 },
      sendAfter: new Date(Date.now() + 24 * 60 * 60 * 1000),
      payload: toJson({ ...payload, sentAt: new Date().toISOString() }),
    },
  });
  if (marked.count !== 1) return false;
  try {
    await deliverEarnNotify({ ...holdToNotifyInput(payload), log });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'earn_notify_failed';
    log?.('earn_notify_flush_failed', {
      id: row.id,
      businessId: payload.businessId,
      customerId: payload.customerId,
      error: message,
    });
  }
  return true;
}

/**
 * Send holds whose quiet window has ended.
 * A task names one Cliente so a single carimbo is loaded directly. The minute
 * job passes no target and sends every hold that is already due.
 */
export async function flushDueEarnNotifies(
  log?: HoldLog,
  target?: {
    businessId: string;
    customerId: string;
    /** Cloud Tasks attempt. 0 is the first try. */
    retryCount?: number;
    /** What this earn looked like when its task was scheduled. */
    snapshot?: EarnNotifyInput;
  },
): Promise<{ claimed: number; retry?: boolean }> {
  try {
    if (target) {
      const row = await prisma.earnNotifyHold.findUnique({
        where: {
          businessId_customerId: {
            businessId: target.businessId,
            customerId: target.customerId,
          },
        },
      });
      if (!row) {
        if (target.snapshot && (target.retryCount ?? 0) === 0) {
          const marker = payloadFromInput(target.snapshot);
          marker.sentAt = new Date().toISOString();
          try {
            await prisma.earnNotifyHold.create({
              data: {
                businessId: target.businessId,
                customerId: target.customerId,
                sendAfter: new Date(Date.now() + 24 * 60 * 60 * 1000),
                payload: toJson(marker),
              },
            });
          } catch (err) {
            if (isUniqueConflict(err)) {
              log?.('earn_notify_flush_already_sent', {
                businessId: target.businessId,
                customerId: target.customerId,
              });
              return { claimed: 0 };
            }
            throw err;
          }
          log?.('earn_notify_flush_snapshot', {
            businessId: target.businessId,
            customerId: target.customerId,
            unitKind: target.snapshot.unitKind,
          });
          await deliverEarnNotify({ ...target.snapshot, log });
          return { claimed: 1 };
        }
        log?.('earn_notify_flush_miss', {
          businessId: target.businessId,
          customerId: target.customerId,
        });
        return { claimed: 0 };
      }
      const opened = parseEarnHoldPayload(row.payload);
      if (opened?.sentAt) {
        log?.('earn_notify_flush_already_sent', { id: row.id });
        return { claimed: 0 };
      }
      const wait = row.sendAfter.getTime() - Date.now();
      if (wait > 15_000) return { claimed: 0, retry: true };
      if (wait > 0) await delay(wait + 300);
      const fresh = await prisma.earnNotifyHold.findUnique({
        where: { id: row.id },
      });
      if (!fresh) return { claimed: 0 };
      if (fresh.sendAfter.getTime() - Date.now() > 500) {
        // A later earn moved the window. Its own task sends the burst.
        return { claimed: 0 };
      }
      const sent = await sendClaimedHold(fresh, log);
      return { claimed: sent ? 1 : 0 };
    }

    const due = await prisma.earnNotifyHold.findMany({
      where: { sendAfter: { lte: new Date() } },
      orderBy: { sendAfter: 'asc' },
      take: FLUSH_BATCH,
    });
    let claimed = 0;
    for (const row of due) {
      if (await sendClaimedHold(row, log)) claimed += 1;
    }
    return { claimed };
  } catch (err) {
    if (isMissingHoldTable(err)) return { claimed: 0 };
    throw err;
  }
}

/**
 * Ask Cloud Tasks to flush this Cliente's hold shortly after the quiet window.
 * The body names the Cliente, so one carimbo is not lost in a scan that skips its row.
 */
async function scheduleEarnNotifyFlush(input: EarnNotifyInput): Promise<void> {
  const log = input.log;
  const queue = process.env.CLOUD_TASKS_QUEUE?.trim();
  const url = process.env.EARN_NOTIFY_FLUSH_URL?.trim();
  const secret = process.env.REMINDER_SECRET?.trim();
  if (!queue && !url) return;
  if (!queue || !url || !secret) {
    log?.('earn_notify_task_skipped', { reason: 'incomplete_config' });
    return;
  }

  try {
    const client = await tasksAuth.getClient();
    const token = await client.getAccessToken();
    if (!token.token) {
      log?.('earn_notify_task_skipped', { reason: 'no_token' });
      return;
    }
    const scheduleTime = new Date(Date.now() + EARN_NOTIFY_FLUSH_DELAY_MS);
    const response = await fetch(`https://cloudtasks.googleapis.com/v2/${queue}/tasks`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token.token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        task: {
          scheduleTime: scheduleTime.toISOString(),
          httpRequest: {
            httpMethod: 'POST',
            url,
            headers: {
              'Content-Type': 'application/json',
              'x-reminder-secret': secret,
            },
            body: Buffer.from(
              JSON.stringify({
                businessId: input.businessId,
                businessName: input.businessName,
                customerId: input.customerId,
                toE164: input.toE164,
                unitKind: input.unitKind,
                quantity: input.quantity,
                amountCents: input.amountCents ?? null,
                cashbackCents: input.cashbackCents ?? null,
                saleId: input.saleId ?? null,
                transactionId: input.transactionId ?? null,
                wallet: input.wallet,
                stampEarn: input.stampEarn ?? null,
                summaryLine: input.summaryLine ?? null,
                pesquisa: input.pesquisa ?? null,
              }),
            ).toString('base64'),
          },
        },
      }),
    });
    if (!response.ok) {
      log?.('earn_notify_task_failed', { status: response.status });
      return;
    }
    log?.('earn_notify_task_scheduled', { scheduleTime: scheduleTime.toISOString() });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'earn_notify_task_failed';
    log?.('earn_notify_task_failed', { error: message });
  }
}

export async function queueEarnNotify(input: EarnNotifyInput): Promise<void> {
  try {
    const flushNow = await stageEarnNotify(input);
    if (flushNow) {
      await deliverEarnNotify({ ...holdToNotifyInput(flushNow), log: input.log });
    }
    const held = await prisma.earnNotifyHold.findUnique({
      where: {
        businessId_customerId: {
          businessId: input.businessId,
          customerId: input.customerId,
        },
      },
    });
    if (!held) {
      input.log?.('earn_notify_hold_invisible', {
        businessId: input.businessId,
        customerId: input.customerId,
      });
      await deliverEarnNotify(input);
      await prisma.earnNotifyHold
        .deleteMany({
          where: {
            businessId: input.businessId,
            customerId: input.customerId,
          },
        })
        .catch(() => undefined);
      return;
    }
    const parsed = parseEarnHoldPayload(held.payload);
    await scheduleEarnNotifyFlush(
      parsed ? { ...holdToNotifyInput(parsed), log: input.log } : input,
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : 'earn_notify_hold_failed';
    input.log?.('earn_notify_hold_failed', {
      businessId: input.businessId,
      customerId: input.customerId,
      error: message,
    });
    await deliverEarnNotify(input);
  }
}

let flushTimer: ReturnType<typeof setTimeout> | null = null;

/**
 * While this process has CPU, flush due holds every few seconds.
 * Production does not rely on this: each earn schedules a Cloud Task, and the
 * minute Scheduler job is only the backstop when that task was not created.
 */
export function startEarnNotifyFlushSchedule(log: {
  info: (obj: object, msg?: string) => void;
  error: (obj: object, msg?: string) => void;
}): void {
  if (process.env.EARN_NOTIFY_FLUSH === '0') return;
  // Production sends from the Cloud Task. This timer is for local dev, where
  // the process stays awake. On Cloud Run it fights the request pool for connections.
  if (
    process.env.NODE_ENV === 'production' &&
    process.env.EARN_NOTIFY_FLUSH !== '1'
  ) {
    return;
  }
  if (flushTimer) return;
  const tick = () => {
    flushTimer = setTimeout(() => {
      void flushDueEarnNotifies((msg, extra) => log.info(extra ?? {}, msg))
        .catch((err: unknown) => {
          log.error({ err }, 'earn_notify_flush_failed');
        })
        .finally(tick);
    }, FLUSH_INTERVAL_MS);
    flushTimer.unref?.();
  };
  tick();
}
