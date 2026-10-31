import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { maxCashbackUseCents } from './cashback-use.js';

describe('maxCashbackUseCents', () => {
  it('keeps the saldo until a compra is typed', () => {
    assert.equal(maxCashbackUseCents(null, 1000, 3), 1000);
  });

  it('caps at the smaller of saldo and compra when no Múltiplo is set', () => {
    assert.equal(maxCashbackUseCents(3000, 1000, null), 1000);
    assert.equal(maxCashbackUseCents(800, 1000, null), 800);
  });

  it('caps at the compra divided by the Múltiplo, rounded down', () => {
    assert.equal(maxCashbackUseCents(3000, 1000, 3), 1000);
    assert.equal(maxCashbackUseCents(2400, 1000, 3), 800);
    assert.equal(maxCashbackUseCents(1000, 1000, 3), 333);
  });

  it('does not treat 1 as a Múltiplo', () => {
    assert.equal(maxCashbackUseCents(2400, 1000, 1), 1000);
  });

  it('returns 0 when the compra cannot cover one centavo at that multiple', () => {
    assert.equal(maxCashbackUseCents(2, 1000, 3), 0);
  });
});
