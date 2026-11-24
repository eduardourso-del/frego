import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  checkInRewards,
  evaluateCheckInQuota,
  foldCheckIns,
  laterResgatePossible,
  redemptionInFusoPeriod,
} from './check-in.js';

const rio = 'America/Rio_Branco';

describe('later Resgate on a Campanha de check-in', () => {
  it('stays open with no cap', () => {
    assert.equal(
      laterResgatePossible({
        redeemMax: null,
        redeemPeriod: null,
        redeemedInCampaign: 4,
      }),
      true,
    );
  });

  it('stops when nesta campanha is used up', () => {
    assert.equal(
      laterResgatePossible({
        redeemMax: 1,
        redeemPeriod: 'campaign',
        redeemedInCampaign: 1,
      }),
      false,
    );
    assert.equal(
      laterResgatePossible({
        redeemMax: 1,
        redeemPeriod: 'campaign',
        redeemedInCampaign: 0,
      }),
      true,
    );
  });

  it('keeps a periodic cap open for a later period', () => {
    assert.equal(
      laterResgatePossible({
        redeemMax: 1,
        redeemPeriod: 'day',
        redeemedInCampaign: 9,
      }),
      true,
    );
  });
});

describe('check-in quota in the Fuso', () => {
  it('counts a Resgate on the Rio Branco day, not São Paulo', () => {
    // 02:30 UTC is 21:30 the previous day in Rio Branco (UTC−5) and 23:30 in São Paulo.
    const redeemAt = new Date('2026-06-15T02:30:00.000Z');
    const now = new Date('2026-06-15T03:30:00.000Z');
    assert.equal(
      redemptionInFusoPeriod(redeemAt, 'day', now, rio),
      true,
    );
    const quota = evaluateCheckInQuota(
      { redeemMax: 1, redeemPeriod: 'day' },
      [{ createdAt: redeemAt, quantity: 1 }],
      rio,
      now,
    );
    assert.equal(quota.exhausted, true);
    assert.equal(quota.unlocksAt, '2026-06-15');
  });

  it('week starts Monday', () => {
    const monday = new Date('2026-06-15T15:00:00.000Z');
    const sunday = new Date('2026-06-14T15:00:00.000Z');
    assert.equal(
      redemptionInFusoPeriod(sunday, 'week', monday, 'America/Sao_Paulo'),
      false,
    );
    assert.equal(
      redemptionInFusoPeriod(monday, 'week', monday, 'America/Sao_Paulo'),
      true,
    );
  });
});

describe('fold standing Check-ins', () => {
  it('keeps counted, consumed and ended, and drops a removed row', () => {
    const folded = foldCheckIns([
      {
        campaignId: 'a',
        membershipId: 'm1',
        status: 'counted',
        civilDate: '2026-11-18',
      },
      {
        campaignId: 'a',
        membershipId: 'm1',
        status: 'consumed',
        civilDate: '2026-11-17',
      },
      {
        campaignId: 'a',
        membershipId: 'm2',
        status: 'ended',
        civilDate: '2026-11-18',
      },
      {
        campaignId: 'a',
        membershipId: 'm3',
        status: 'removed',
        civilDate: '2026-11-18',
      },
    ]);
    assert.equal(folded.checkIns, 3);
    assert.equal(folded.customers, 2);
    assert.equal(folded.byCampaign.get('a')?.checkIns, 3);
    assert.equal(folded.byCampaign.get('a')?.people.size, 2);
    assert.equal(folded.byDay.get('2026-11-18'), 2);
    assert.equal(folded.byDay.get('2026-11-17'), 1);
  });
});

describe('sets from counted Check-ins', () => {
  it('banks past X and lets the cap hold a set', () => {
    assert.equal(checkInRewards(10, 8, null), 1);
    assert.equal(checkInRewards(16, 8, null), 2);
    assert.equal(checkInRewards(16, 8, 1), 1);
    assert.equal(checkInRewards(3, 8, null), 0);
  });
});
