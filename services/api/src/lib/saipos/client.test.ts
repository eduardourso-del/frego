import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { fetchSaiposSales } from './client.js';

const start = new Date('2026-11-19T08:00:00.000Z');
const end = new Date('2026-11-19T14:00:00.000Z');

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

describe('fetchSaiposSales', () => {
  it('retries a connection-pool timeout and then reads the sales', async () => {
    let calls = 0;
    const slept: number[] = [];
    const result = await fetchSaiposSales(
      'token',
      start,
      end,
      async () => {
        calls += 1;
        if (calls < 3) {
          return jsonResponse(504, {
            message: 'Timed out acquiring connection from connection pool.',
          });
        }
        return jsonResponse(200, [{ id_sale: 1 }]);
      },
      async (ms) => {
        slept.push(ms);
      },
    );
    assert.equal(result.ok, true);
    if (result.ok) assert.equal(result.sales.length, 1);
    assert.equal(calls, 3);
    assert.deepEqual(slept, [1000, 3000]);
  });

  it('does not retry a refused token', async () => {
    let calls = 0;
    const result = await fetchSaiposSales(
      'token',
      start,
      end,
      async () => {
        calls += 1;
        return jsonResponse(401, { message: 'Unauthorized' });
      },
      async () => {
        throw new Error('should not sleep');
      },
    );
    assert.equal(result.ok, false);
    if (!result.ok) assert.equal(result.status, 401);
    assert.equal(calls, 1);
  });
});
