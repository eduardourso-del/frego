import { timingSafeEqual } from 'node:crypto';
import type { FastifyPluginAsync } from 'fastify';
import type { EarnNotifyInput } from '../lib/whatsapp/earn-message.js';
import { flushDueEarnNotifies } from '../lib/whatsapp/earn-notify-hold.js';

function secretMatches(provided: string, expected: string): boolean {
  const left = Buffer.from(provided);
  const right = Buffer.from(expected);
  if (left.length !== right.length) return false;
  return timingSafeEqual(left, right);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function readSnapshot(body: Record<string, unknown>): EarnNotifyInput | undefined {
  if (
    (body.unitKind !== 'stamps' &&
      body.unitKind !== 'points' &&
      body.unitKind !== 'cashback') ||
    typeof body.businessId !== 'string' ||
    typeof body.businessName !== 'string' ||
    typeof body.customerId !== 'string' ||
    typeof body.toE164 !== 'string' ||
    typeof body.quantity !== 'number' ||
    !isRecord(body.wallet)
  ) {
    return undefined;
  }
  return {
    businessId: body.businessId,
    businessName: body.businessName,
    customerId: body.customerId,
    toE164: body.toE164,
    unitKind: body.unitKind,
    quantity: body.quantity,
    amountCents: typeof body.amountCents === 'number' ? body.amountCents : null,
    cashbackCents:
      typeof body.cashbackCents === 'number' ? body.cashbackCents : null,
    saleId: typeof body.saleId === 'string' ? body.saleId : null,
    transactionId:
      typeof body.transactionId === 'string' ? body.transactionId : null,
    wallet: body.wallet as EarnNotifyInput['wallet'],
    stampEarn:
      isRecord(body.stampEarn) &&
      typeof body.stampEarn.cartela === 'boolean' &&
      typeof body.stampEarn.label === 'string' &&
      typeof body.stampEarn.balance === 'number'
        ? {
            cartela: body.stampEarn.cartela,
            label: body.stampEarn.label,
            balance: body.stampEarn.balance,
          }
        : null,
    summaryLine: typeof body.summaryLine === 'string' ? body.summaryLine : null,
    pesquisa:
      isRecord(body.pesquisa) &&
      typeof body.pesquisa.sentence === 'string' &&
      typeof body.pesquisa.url === 'string' &&
      typeof body.pesquisa.conviteId === 'string'
        ? {
            sentence: body.pesquisa.sentence,
            url: body.pesquisa.url,
            conviteId: body.pesquisa.conviteId,
          }
        : null,
  };
}

export const earnNotifyRoutes: FastifyPluginAsync = async (app) => {
  /**
   * Send earn holds whose quiet window has ended.
   * Each earn schedules a Cloud Task to POST here about 13s later.
   * The minute Scheduler job is the backstop when that task was not created.
   */
  app.post('/internal/earn-notifies', async (request, reply) => {
    const expected = process.env.REMINDER_SECRET?.trim();
    const header = request.headers['x-reminder-secret'];
    const provided = typeof header === 'string' ? header : '';
    if (!expected || !secretMatches(provided, expected)) {
      return reply.code(404).send({ error: 'NOT_FOUND' });
    }
    const body = request.body;
    let target:
      | {
          businessId: string;
          customerId: string;
          retryCount: number;
          snapshot?: EarnNotifyInput;
        }
      | undefined;
    if (isRecord(body) && typeof body.businessId === 'string' && typeof body.customerId === 'string') {
      const retryHeader = request.headers['x-cloudtasks-taskretrycount'];
      const retryCount = typeof retryHeader === 'string' ? Number(retryHeader) : 0;
      target = {
        businessId: body.businessId,
        customerId: body.customerId,
        retryCount: Number.isFinite(retryCount) ? retryCount : 0,
        snapshot: readSnapshot(body),
      };
    }
    const result = await flushDueEarnNotifies(
      (msg, extra) => request.log.info(extra ?? {}, msg),
      target,
    );
    if (result.retry) return reply.code(503).send({ ok: false, ...result });
    return { ok: true, claimed: result.claimed };
  });
};
