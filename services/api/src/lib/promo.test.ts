import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  evaluatePromoEntitlement,
  redemptionInPeriod,
  startOfWeekMonday,
  ymdInSaoPaulo,
} from './promo.js';
import { createVoucherMeta } from './voucher.js';

/** 15:00 UTC = 12:00 in America/Sao_Paulo (no DST). */
function spNoon(ymd: string): Date {
  return new Date(`${ymd}T15:00:00.000Z`);
}

describe('America/Sao_Paulo calendar', () => {
  it('keeps evening service on the São Paulo day, not UTC', () => {
    // 02:30 UTC on 21 Dec is 23:30 on 20 Dec in São Paulo.
    const evening = new Date('2026-12-21T02:30:00.000Z');
    assert.equal(ymdInSaoPaulo(evening), '2026-12-20');
  });

  it('weeks start on Monday', () => {
    assert.equal(startOfWeekMonday('2026-12-20'), '2026-12-14'); // Sunday
    assert.equal(startOfWeekMonday('2026-12-21'), '2026-12-21'); // Monday
    assert.equal(startOfWeekMonday('2026-12-24'), '2026-12-21'); // Thursday
  });
});

describe('evaluatePromoEntitlement', () => {
  it('allows Resgatar when active with default calendar', () => {
    const got = evaluatePromoEntitlement(
      {
        startsOn: null,
        endsOn: null,
        weekdays: [],
        redeemMax: 1,
        redeemPeriod: 'campaign',
      },
      [],
      spNoon('2026-12-24'),
    );
    assert.equal(got.canRedeem, true);
    assert.equal(got.rewardsAvailable, 1);
    assert.equal(got.lockedReason, null);
  });

  it('gates on inclusive start/end dates', () => {
    const campaign = {
      startsOn: '2026-12-01',
      endsOn: '2026-12-31',
      weekdays: [] as number[],
      redeemMax: 1,
      redeemPeriod: 'campaign' as const,
    };
    assert.equal(
      evaluatePromoEntitlement(campaign, [], spNoon('2026-11-30'))
        .lockedReason,
      'outside_dates',
    );
    assert.equal(
      evaluatePromoEntitlement(campaign, [], spNoon('2026-12-01')).canRedeem,
      true,
    );
    assert.equal(
      evaluatePromoEntitlement(campaign, [], spNoon('2026-12-31')).canRedeem,
      true,
    );
    assert.equal(
      evaluatePromoEntitlement(campaign, [], spNoon('2027-01-01'))
        .lockedReason,
      'outside_dates',
    );
  });

  it('gates on weekdays (Thursday only)', () => {
    const campaign = {
      startsOn: null,
      endsOn: null,
      weekdays: [4],
      redeemMax: 1,
      redeemPeriod: 'campaign' as const,
    };
    const thu = evaluatePromoEntitlement(campaign, [], spNoon('2026-12-24'));
    assert.equal(thu.canRedeem, true);
    const fri = evaluatePromoEntitlement(campaign, [], spNoon('2026-12-25'));
    assert.equal(fri.lockedReason, 'wrong_weekday');
    assert.equal(fri.unlocksAt, '2026-12-31');
  });

  it('counts Resgatar toward quota even if the Voucher expired unused', () => {
    const expired = createVoucherMeta(new Date('2026-12-01T12:00:00.000Z'));
    const got = evaluatePromoEntitlement(
      {
        startsOn: '2026-12-01',
        endsOn: '2026-12-31',
        weekdays: [],
        redeemMax: 1,
        redeemPeriod: 'campaign',
      },
      [{ createdAt: new Date('2026-12-01T12:00:00.000Z'), metadata: expired }],
      spNoon('2026-12-20'),
    );
    assert.equal(got.canRedeem, false);
    assert.equal(got.lockedReason, 'quota_exhausted');
  });

  it('blocks a second open Voucher', () => {
    const open = createVoucherMeta(spNoon('2026-12-24'));
    const got = evaluatePromoEntitlement(
      {
        startsOn: null,
        endsOn: null,
        weekdays: [],
        redeemMax: null,
        redeemPeriod: null,
      },
      [{ createdAt: spNoon('2026-12-24'), metadata: open }],
      new Date(spNoon('2026-12-24').getTime() + 60_000),
    );
    assert.equal(got.lockedReason, 'open_voucher');
    assert.equal(got.canRedeem, false);
  });

  it('allows another Resgatar next week when period is week', () => {
    const campaign = {
      startsOn: null,
      endsOn: null,
      weekdays: [] as number[],
      redeemMax: 1,
      redeemPeriod: 'week' as const,
    };
    const sunday = evaluatePromoEntitlement(
      campaign,
      [{ createdAt: spNoon('2026-12-20'), metadata: {} }],
      spNoon('2026-12-20'),
    );
    assert.equal(sunday.lockedReason, 'quota_exhausted');

    const monday = evaluatePromoEntitlement(
      campaign,
      [{ createdAt: spNoon('2026-12-20'), metadata: {} }],
      spNoon('2026-12-21'),
    );
    assert.equal(monday.canRedeem, true);
  });

  it('once-per-campaign does not reset on 1 Jan', () => {
    const campaign = {
      startsOn: '2026-11-15',
      endsOn: '2027-01-15',
      weekdays: [] as number[],
      redeemMax: 1,
      redeemPeriod: 'campaign' as const,
    };
    const afterNewYear = evaluatePromoEntitlement(
      campaign,
      [{ createdAt: spNoon('2026-12-20'), metadata: {} }],
      spNoon('2027-01-02'),
    );
    assert.equal(afterNewYear.lockedReason, 'quota_exhausted');

    const yearPeriod = evaluatePromoEntitlement(
      { ...campaign, redeemPeriod: 'year' },
      [{ createdAt: spNoon('2026-12-20'), metadata: {} }],
      spNoon('2027-01-02'),
    );
    assert.equal(yearPeriod.canRedeem, true);
  });
});

describe('redemptionInPeriod', () => {
  it('treats campaign as the whole ledger', () => {
    assert.equal(
      redemptionInPeriod(
        spNoon('2025-01-01'),
        'campaign',
        spNoon('2026-12-24'),
      ),
      true,
    );
  });
});
