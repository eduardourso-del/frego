import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  cashbackCentsFromSale,
  pointsFromAmountCents,
  poolLotsFifo,
} from './wallet.js';

describe('cashbackCentsFromSale', () => {
  it('credits percent of paid amount in cents', () => {
    assert.equal(cashbackCentsFromSale(10_000, 5), 500);
    assert.equal(cashbackCentsFromSale(9_200, 5), 460);
  });

  it('floors fractional cents', () => {
    assert.equal(cashbackCentsFromSale(99, 5), 4);
  });

  it('returns 0 for empty sale or zero percent', () => {
    assert.equal(cashbackCentsFromSale(0, 5), 0);
    assert.equal(cashbackCentsFromSale(10_000, 0), 0);
    assert.equal(cashbackCentsFromSale(-1, 5), 0);
  });

  it('caps at maxCents when set', () => {
    assert.equal(cashbackCentsFromSale(100_000, 10, 500), 500);
    assert.equal(cashbackCentsFromSale(1_000, 10, 500), 100);
  });
});

describe('pointsFromAmountCents', () => {
  it('uses whole reais per point', () => {
    assert.equal(pointsFromAmountCents(1250, 1), 12);
    assert.equal(pointsFromAmountCents(1250, 2), 6);
    assert.equal(pointsFromAmountCents(99, 1), 0);
    assert.equal(pointsFromAmountCents(10_000, 10), 10);
    assert.equal(pointsFromAmountCents(999, 10), 0);
  });
});

describe('poolLotsFifo cashback expiry', () => {
  it('expires unused cashback after TTL', () => {
    const earned = new Date(Date.UTC(2026, 0, 1));
    const now = new Date(Date.UTC(2026, 0, 32));
    const { balance } = poolLotsFifo(
      [{ kind: 'earn', quantity: 500, at: earned }],
      30,
      now,
    );
    assert.equal(balance, 0);
  });

  it('keeps balance inside TTL and consumes FIFO on redeem', () => {
    const earned = new Date(Date.UTC(2026, 0, 1, 12));
    const redeemAt = new Date(Date.UTC(2026, 0, 10, 12));
    const now = new Date(Date.UTC(2026, 0, 10, 13));
    const { balance } = poolLotsFifo(
      [
        { kind: 'earn', quantity: 800, at: earned },
        { kind: 'redeem', quantity: 300, at: redeemAt },
      ],
      30,
      now,
    );
    assert.equal(balance, 500);
  });
});
