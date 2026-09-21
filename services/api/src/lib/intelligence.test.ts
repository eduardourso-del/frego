import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  buildIntelligence,
  INTEL_INACTIVE_DAYS,
  INTEL_LOOKBACK_DAYS,
  INTEL_PERIOD_LABEL,
  periodLabelFor,
} from './intelligence.js';

function emptyCurrent() {
  return {
    customers: 0,
    returning: 0,
    spenders: [] as { spendCents: number }[],
  };
}

describe('periodLabelFor', () => {
  it('is a fixed lookback, not the Painel picker', () => {
    assert.equal(periodLabelFor(), INTEL_PERIOD_LABEL);
    assert.equal(INTEL_LOOKBACK_DAYS, 90);
    assert.equal(INTEL_INACTIVE_DAYS, 30);
  });
});

describe('buildIntelligence', () => {
  it('keeps the section alive with a cheerful empty card', () => {
    const result = buildIntelligence({
      totalMembers: 0,
      inactiveCount: 0,
      current: emptyCurrent(),
      nearRewardCount: 0,
      hasRewardCampaign: false,
      vipQuietCount: 0,
      txs: [],
    });
    assert.equal(result.periodLabel, INTEL_PERIOD_LABEL);
    assert.ok(result.actions.length >= 1);
    assert.equal(result.actions[0]?.key, 'empty');
  });

  it('surfaces missing, near-reward and high spend as campaign actions', () => {
    const spenders = [
      { spendCents: 80_000 },
      { spendCents: 45_000 },
      { spendCents: 30_000 },
    ];
    const result = buildIntelligence({
      totalMembers: 20,
      inactiveCount: 12,
      current: { customers: 8, returning: 3, spenders },
      nearRewardCount: 5,
      hasRewardCampaign: true,
      vipQuietCount: 0,
      txs: [],
    });
    const keys = result.actions.map((a) => a.key);
    assert.ok(keys.includes('missing'));
    assert.ok(keys.includes('near_reward'));
    assert.ok(keys.includes('high_value'));
    const missing = result.actions.find((a) => a.key === 'missing');
    assert.equal(missing?.audience?.name, 'Quem sumiu');
    assert.equal(missing?.campaign?.suggestedName, 'Volta pra casa');
    assert.equal(missing?.audience?.rules.inactiveDaysMin, INTEL_INACTIVE_DAYS);
    const high = result.actions.find((a) => a.key === 'high_value');
    assert.equal(high?.metric.format, 'money');
    assert.ok((high?.metric.value ?? 0) >= 30_000);
    assert.equal(high?.audience?.rules.windowDays, INTEL_LOOKBACK_DAYS);
    assert.ok(result.actions.length <= 4);
  });

  it('ranks bring-back actions before fill-the-house ones', () => {
    const result = buildIntelligence({
      totalMembers: 40,
      inactiveCount: 10,
      current: {
        customers: 20,
        returning: 4,
        spenders: [{ spendCents: 50_000 }],
      },
      nearRewardCount: 3,
      hasRewardCampaign: true,
      vipQuietCount: 2,
      txs: [],
    });
    const keys = result.actions.map((a) => a.key);
    assert.ok(keys.indexOf('missing') < keys.indexOf('near_reward'));
    assert.ok(keys.indexOf('vip_quiet') < keys.indexOf('near_reward'));
    assert.equal(keys.includes('vip_quiet'), true);
  });

  it('hides near-reward when there is no stamps/spend campaign', () => {
    const result = buildIntelligence({
      totalMembers: 10,
      inactiveCount: 2,
      current: { customers: 8, returning: 1, spenders: [] },
      nearRewardCount: 4,
      hasRewardCampaign: false,
      vipQuietCount: 0,
      txs: [],
    });
    assert.equal(
      result.actions.some((a) => a.key === 'near_reward'),
      false,
    );
  });

  it('flags a quiet Tuesday afternoon when volume is uneven', () => {
    const txs: Array<{ createdAt: Date }> = [];
    // 2026-08-29 (Sat) 18:00 SP = 21:00Z — busy evening
    for (let i = 0; i < 12; i++) {
      txs.push({ createdAt: new Date('2026-08-29T21:00:00.000Z') });
    }
    // Several weekdays at 12:00 SP = 15:00Z
    for (const day of ['2026-08-31', '2026-09-02', '2026-09-03', '2026-09-04']) {
      for (let i = 0; i < 6; i++) {
        txs.push({ createdAt: new Date(`${day}T15:00:00.000Z`) });
      }
    }
    // Tuesday 2026-09-01 15:00 SP = 18:00Z — a single visit
    txs.push({ createdAt: new Date('2026-09-01T18:00:00.000Z') });

    const result = buildIntelligence({
      totalMembers: 4,
      inactiveCount: 0,
      current: { customers: 4, returning: 0, spenders: [] },
      nearRewardCount: 0,
      hasRewardCampaign: false,
      vipQuietCount: 0,
      txs,
    });
    const quiet = result.actions.find((a) => a.key === 'quiet_hours');
    assert.ok(quiet, 'expected a quiet-hours action');
    assert.match(quiet!.title, /Terça/);
    assert.equal(quiet?.campaign?.suggestedName.includes('Terça'), true);
  });
});
