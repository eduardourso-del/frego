import { timingSafeEqual } from 'node:crypto';
import type { FastifyPluginAsync } from 'fastify';
import { runAccountReminders } from '../lib/reminders/run.js';

function secretMatches(provided: string, expected: string): boolean {
  const left = Buffer.from(provided);
  const right = Buffer.from(expected);
  if (left.length !== right.length) return false;
  return timingSafeEqual(left, right);
}

export const reminderRoutes: FastifyPluginAsync = async (app) => {
  app.post('/internal/reminders', async (request, reply) => {
    const expected = process.env.REMINDER_SECRET?.trim();
    const header = request.headers['x-reminder-secret'];
    const provided = typeof header === 'string' ? header : '';
    if (!expected || !secretMatches(provided, expected)) {
      return reply.code(404).send({ error: 'NOT_FOUND' });
    }
    const result = await runAccountReminders({
      log: (msg, extra) => request.log.info(extra ?? {}, msg),
    });
    return { ok: true, ...result };
  });
};
