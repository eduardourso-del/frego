import type { FastifyInstance } from 'fastify';

/**
 * Fastify rejects an empty body when Content-Type is application/json
 * (FST_ERR_CTP_EMPTY_JSON_BODY → 400 "Bad Request").
 *
 * The customer app sends that header on every call, including
 * DELETE /me/customer, which has no payload. Treat an empty body as {}.
 */
export function allowEmptyJsonBody(app: FastifyInstance): void {
  app.addContentTypeParser(
    'application/json',
    { parseAs: 'string' },
    (_request, body, done) => {
      const raw = typeof body === 'string' ? body : body.toString('utf8');
      if (raw.length === 0) {
        done(null, {});
        return;
      }
      try {
        done(null, JSON.parse(raw) as unknown);
      } catch {
        const err = Object.assign(
          new Error(
            "Body is not valid JSON but content-type is set to 'application/json'",
          ),
          { statusCode: 400 },
        );
        done(err, undefined);
      }
    },
  );
}
