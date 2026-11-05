import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import Fastify from 'fastify';
import { allowEmptyJsonBody } from './json-body.js';

describe('allowEmptyJsonBody', () => {
  it('accepts DELETE with Content-Type application/json and no body', async () => {
    const app = Fastify();
    allowEmptyJsonBody(app);
    app.delete('/me/customer', async () => ({ ok: true }));

    const res = await app.inject({
      method: 'DELETE',
      url: '/me/customer',
      headers: { 'content-type': 'application/json' },
    });

    assert.equal(res.statusCode, 200);
    assert.deepEqual(res.json(), { ok: true });
    await app.close();
  });

  it('still parses a JSON body', async () => {
    const app = Fastify();
    allowEmptyJsonBody(app);
    app.post('/echo', async (request) => request.body);

    const res = await app.inject({
      method: 'POST',
      url: '/echo',
      headers: { 'content-type': 'application/json' },
      payload: '{"name":"Ana"}',
    });

    assert.equal(res.statusCode, 200);
    assert.deepEqual(res.json(), { name: 'Ana' });
    await app.close();
  });

  it('rejects invalid JSON', async () => {
    const app = Fastify();
    allowEmptyJsonBody(app);
    app.post('/echo', async (request) => request.body);

    const res = await app.inject({
      method: 'POST',
      url: '/echo',
      headers: { 'content-type': 'application/json' },
      payload: '{',
    });

    assert.equal(res.statusCode, 400);
    await app.close();
  });
});
