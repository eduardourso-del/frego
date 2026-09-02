import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  isReversalMarker,
  isReversedTx,
  saleIdFromMeta,
  shouldOmitFromLedger,
} from './ledger-meta.js';
import {
  earnLotState,
  earnLotStateFromPools,
  formatSaleSummary,
  groupCounterSales,
  reverseBlockForEarn,
} from './tx-reverse.js';
import { poolLotsFifo } from './wallet.js';

describe('ledger meta', () => {
  it('omits reversed originals and reversal markers', () => {
    assert.equal(shouldOmitFromLedger({ reversedAt: '2026-09-02T12:00:00Z' }), true);
    assert.equal(shouldOmitFromLedger({ reversalOf: ['tx1'] }), true);
    assert.equal(shouldOmitFromLedger({ saleId: 'abc', role: 'earn' }), false);
    assert.equal(isReversedTx({ reversedAt: '2026-09-02T12:00:00Z' }), true);
    assert.equal(isReversalMarker({ reversalOf: 'tx1' }), true);
    assert.equal(saleIdFromMeta({ saleId: 'sale-1' }), 'sale-1');
  });
});

describe('counter sales', () => {
  it('groups apply + earn + cashback under one saleId', () => {
    const createdAt = new Date('2026-09-02T15:00:00Z');
    const sales = groupCounterSales([
      {
        id: 'apply',
        type: 'redeem',
        quantity: 1000,
        unitKind: 'cashback_cents',
        amountCents: 4000,
        createdAt,
        actorTeamMemberId: 'staff',
        metadata: { saleId: 's1', role: 'apply' },
      },
      {
        id: 'earn',
        type: 'stamp',
        quantity: 40,
        unitKind: 'points',
        amountCents: 4000,
        createdAt,
        actorTeamMemberId: 'staff',
        metadata: { saleId: 's1', role: 'earn' },
      },
      {
        id: 'cb',
        type: 'stamp',
        quantity: 150,
        unitKind: 'cashback_cents',
        amountCents: 3000,
        createdAt,
        actorTeamMemberId: 'staff',
        metadata: { saleId: 's1', role: 'cashback' },
      },
    ]);
    assert.equal(sales.length, 1);
    assert.equal(sales[0]?.saleId, 's1');
    assert.equal(sales[0]?.items.length, 3);
    assert.match(sales[0]?.summary ?? '', /cashback/);
    assert.match(sales[0]?.summary ?? '', /pts/);
  });

  it('skips reversed rows and voucher redeems', () => {
    const createdAt = new Date();
    const sales = groupCounterSales([
      {
        id: 'old',
        type: 'stamp',
        quantity: 1,
        unitKind: 'stamps',
        amountCents: null,
        createdAt,
        actorTeamMemberId: 'staff',
        metadata: { saleId: 'gone', reversedAt: createdAt.toISOString() },
      },
      {
        id: 'voucher',
        type: 'redeem',
        quantity: 1,
        unitKind: 'stamps',
        amountCents: null,
        createdAt,
        actorTeamMemberId: 'staff',
        metadata: {
          voucherCode: 'K7M2PQ',
          voucherDisplay: 'K7M-2PQ',
          expiresAt: new Date(Date.now() + 86_400_000).toISOString(),
        },
      },
    ]);
    assert.equal(sales.length, 0);
  });

  it('formats a stamp-only sale', () => {
    assert.equal(
      formatSaleSummary([
        {
          id: 't',
          type: 'stamp',
          quantity: 1,
          unitKind: 'stamps',
          amountCents: null,
          role: 'earn',
        },
      ]),
      '+1 carimbo',
    );
  });
});

describe('earn reverse guards', () => {
  it('blocks when the lot was consumed or expired', () => {
    const earned = new Date(Date.UTC(2026, 0, 1, 12));
    const { lots, expiredLots } = poolLotsFifo(
      [
        { kind: 'earn', quantity: 10, at: earned, id: 'earn-1' },
        { kind: 'redeem', quantity: 4, at: new Date(Date.UTC(2026, 0, 2)), id: 'r' },
      ],
      30,
      new Date(Date.UTC(2026, 0, 3)),
    );
    const state = earnLotState(lots, expiredLots, 'earn-1');
    assert.equal(reverseBlockForEarn(state, 10), 'used');
    assert.equal(reverseBlockForEarn({ remaining: 10, expired: true, originalQuantity: 10 }, 10), 'expired');
    assert.equal(
      reverseBlockForEarn({ remaining: 10, expired: false, originalQuantity: 10 }, 10),
      null,
    );
  });

  it('returns null when the earn is not in that pool so callers can search the others', () => {
    const earned = new Date(Date.UTC(2026, 0, 1, 12));
    const cashback = poolLotsFifo(
      [{ kind: 'earn', quantity: 150, at: earned, id: 'cb-1' }],
      null,
      new Date(Date.UTC(2026, 0, 1, 13)),
    );
    const stamps = poolLotsFifo([], null, new Date(Date.UTC(2026, 0, 1, 13)));
    assert.equal(earnLotState(stamps.lots, stamps.expiredLots, 'cb-1'), null);
    const found = earnLotStateFromPools([stamps, cashback], 'cb-1');
    assert.equal(found?.remaining, 150);
    assert.equal(reverseBlockForEarn(found, 150), null);
    assert.equal(reverseBlockForEarn(earnLotStateFromPools([stamps], 'cb-1'), 150), 'used');
  });
});
