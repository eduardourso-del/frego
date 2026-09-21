import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  foldCampaignReturn,
  foldStoreCampaignReturn,
  nextFulfillAmountCents,
  voucherBelongsToPeriod,
} from './campaign-return.js';

const usedMeta = {
  voucherCode: 'K7M2PQ',
  voucherDisplay: 'K7M-2PQ',
  expiresAt: '2026-09-17T12:00:00.000Z',
  usedAt: '2026-09-16T12:00:00.000Z',
  usedByTeamMemberId: 'staff-1',
};

const openMeta = {
  voucherCode: 'OPEN01',
  voucherDisplay: 'OPE-N01',
  expiresAt: '2026-09-17T12:00:00.000Z',
};

const at = new Date('2026-09-16T12:00:00.000Z');

describe('voucherBelongsToPeriod', () => {
  const from = new Date('2026-09-16T03:00:00.000Z');
  const to = new Date('2026-09-17T03:00:00.000Z');
  const issuedYesterday = new Date('2026-09-15T12:00:00.000Z');

  it('counts a voucher issued earlier and confirmed in the period', () => {
    assert.equal(
      voucherBelongsToPeriod(
        {
          type: 'redeem',
          amountCents: 6000,
          createdAt: issuedYesterday,
          metadata: {
            ...usedMeta,
            usedAt: '2026-09-16T11:08:00.000Z',
          },
        },
        { from, to },
      ),
      true,
    );
  });

  it('does not count a voucher confirmed after the period', () => {
    assert.equal(
      voucherBelongsToPeriod(
        {
          type: 'redeem',
          amountCents: 6000,
          createdAt: from,
          metadata: {
            ...usedMeta,
            usedAt: '2026-09-18T12:00:00.000Z',
          },
        },
        { from, to },
      ),
      false,
    );
  });
});

describe('nextFulfillAmountCents', () => {
  it('stores amount on first fulfill', () => {
    assert.equal(
      nextFulfillAmountCents({
        alreadyUsed: false,
        existingAmountCents: null,
        incomingAmountCents: 4590,
      }),
      4590,
    );
  });

  it('stores zero on first fulfill', () => {
    assert.equal(
      nextFulfillAmountCents({
        alreadyUsed: false,
        existingAmountCents: null,
        incomingAmountCents: 0,
      }),
      0,
    );
  });

  it('leaves amount unchanged when omitted', () => {
    assert.equal(
      nextFulfillAmountCents({
        alreadyUsed: false,
        existingAmountCents: null,
        incomingAmountCents: undefined,
      }),
      undefined,
    );
  });

  it('backfills when already used without amount', () => {
    assert.equal(
      nextFulfillAmountCents({
        alreadyUsed: true,
        existingAmountCents: null,
        incomingAmountCents: 2000,
      }),
      2000,
    );
  });

  it('does not overwrite a stored amount', () => {
    assert.equal(
      nextFulfillAmountCents({
        alreadyUsed: true,
        existingAmountCents: 1500,
        incomingAmountCents: 9999,
      }),
      undefined,
    );
  });
});

describe('foldCampaignReturn', () => {
  it('sums used voucher amounts and coverage', () => {
    const fold = foldCampaignReturn(
      [
        {
          type: 'redeem',
          amountCents: 4500,
          metadata: usedMeta,
          createdAt: at,
        },
        {
          type: 'redeem',
          amountCents: 0,
          metadata: usedMeta,
          createdAt: at,
        },
        {
          type: 'redeem',
          amountCents: null,
          metadata: usedMeta,
          createdAt: at,
        },
        {
          type: 'redeem',
          amountCents: 9900,
          metadata: openMeta,
          createdAt: at,
        },
      ],
      { isCashback: false },
    );
    assert.equal(fold.revenueCents, 4500);
    assert.deepEqual(fold.coverage, { withAmount: 2, used: 3 });
  });

  it('sums cashback apply amounts', () => {
    const fold = foldCampaignReturn(
      [
        {
          type: 'redeem',
          amountCents: 4000,
          unitKind: 'cashback_cents',
          createdAt: at,
        },
        {
          type: 'stamp',
          amountCents: 4000,
          unitKind: 'cashback_cents',
          createdAt: at,
        },
      ],
      { isCashback: true },
    );
    assert.equal(fold.revenueCents, 4000);
    assert.deepEqual(fold.coverage, { withAmount: 1, used: 1 });
  });

  it('attributes expired-then-accepted tickets to the confirm day', () => {
    const fold = foldCampaignReturn(
      [
        {
          type: 'redeem',
          amountCents: 6000,
          createdAt: new Date('2026-09-15T12:00:00.000Z'),
          metadata: {
            ...usedMeta,
            usedAt: '2026-09-16T11:08:00.000Z',
          },
        },
      ],
      {
        isCashback: false,
        range: {
          from: new Date('2026-09-16T03:00:00.000Z'),
          to: new Date('2026-09-17T03:00:00.000Z'),
        },
      },
    );
    assert.equal(fold.revenueCents, 6000);
    assert.deepEqual(fold.coverage, { withAmount: 1, used: 1 });
  });
});

describe('foldStoreCampaignReturn', () => {
  it('adds voucher tickets and cashback apply amounts', () => {
    const fold = foldStoreCampaignReturn([
      {
        type: 'redeem',
        amountCents: 2500,
        metadata: usedMeta,
        createdAt: at,
      },
      {
        type: 'redeem',
        amountCents: 8000,
        unitKind: 'cashback_cents',
        createdAt: at,
      },
    ]);
    assert.equal(fold.revenueCents, 10500);
    assert.deepEqual(fold.coverage, { withAmount: 2, used: 2 });
  });
});
