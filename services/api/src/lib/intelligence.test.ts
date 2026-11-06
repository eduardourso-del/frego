import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  buildIntelligence,
  collectPurchases,
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
    assert.equal(missing?.campaign?.suggestedName, 'Volta ao estabelecimento');
    assert.equal(missing?.audience?.rules.inactiveDaysMin, INTEL_INACTIVE_DAYS);
    const high = result.actions.find((a) => a.key === 'high_value');
    assert.equal(high?.metric.format, 'money');
    assert.ok((high?.metric.value ?? 0) >= 30_000);
    assert.equal(high?.audience?.rules.windowDays, INTEL_LOOKBACK_DAYS);
    assert.ok(result.actions.length <= 4);
  });

  it('puts the next visit ahead of a VIP subset', () => {
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
    assert.ok(keys.indexOf('near_reward') < keys.indexOf('vip_quiet'));
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
    assert.match(quiet!.body, /1 visita/);
    assert.match(quiet!.body, /12 visitas/);
    assert.equal(quiet?.metric.value, 1);
  });

  it('suggests a compra threshold when repeat clientes sit under the ticket', () => {
    const members = [
      { membershipId: 'a', visitDays: 4 },
      { membershipId: 'b', visitDays: 3 },
      { membershipId: 'c', visitDays: 3 },
      { membershipId: 'd', visitDays: 2 },
      { membershipId: 'e', visitDays: 2 },
      { membershipId: 'f', visitDays: 2 },
    ];
    const purchases = [
      ...Array.from({ length: 4 }, () => ({
        membershipId: 'a',
        amountCents: 2_000,
      })),
      ...Array.from({ length: 3 }, () => ({
        membershipId: 'b',
        amountCents: 2_200,
      })),
      ...Array.from({ length: 3 }, () => ({
        membershipId: 'c',
        amountCents: 8_000,
      })),
      ...Array.from({ length: 2 }, () => ({
        membershipId: 'd',
        amountCents: 9_000,
      })),
      ...Array.from({ length: 2 }, () => ({
        membershipId: 'e',
        amountCents: 8_500,
      })),
      ...Array.from({ length: 2 }, () => ({
        membershipId: 'f',
        amountCents: 1_800,
      })),
    ];
    const result = buildIntelligence({
      totalMembers: 5,
      inactiveCount: 0,
      current: emptyCurrent(),
      nearRewardCount: 0,
      hasRewardCampaign: false,
      vipQuietCount: 0,
      txs: [],
      members,
      purchases,
    });
    const ticket = result.actions.find((a) => a.key === 'ticket');
    assert.ok(ticket, 'expected a ticket action');
    assert.equal(ticket?.aim, 'Sobe o ticket');
    assert.equal(ticket?.metric.format, 'money');
    assert.equal(ticket?.campaign?.suggestedType, 'promo');
    assert.match(ticket?.campaign?.suggestedName ?? '', /Compra acima de/);
    assert.equal(ticket?.audience, undefined);
    assert.equal(result.actions[0]?.key, 'ticket');
  });

  it('skips the ticket card when compras do not show a gap', () => {
    const purchases = Array.from({ length: 10 }, (_, i) => ({
      membershipId: `m${i}`,
      amountCents: 5_000,
    }));
    const members = purchases.map((p) => ({
      membershipId: p.membershipId,
      visitDays: 2,
    }));
    const result = buildIntelligence({
      totalMembers: 10,
      inactiveCount: 0,
      current: emptyCurrent(),
      nearRewardCount: 0,
      hasRewardCampaign: false,
      vipQuietCount: 0,
      txs: [],
      members,
      purchases,
    });
    assert.equal(
      result.actions.some((a) => a.key === 'ticket'),
      false,
    );
  });

  it('suggests a second-visit campaign when most clientes came once', () => {
    const members = [
      ...Array.from({ length: 8 }, (_, i) => ({
        membershipId: `once-${i}`,
        visitDays: 1,
      })),
      ...Array.from({ length: 2 }, (_, i) => ({
        membershipId: `back-${i}`,
        visitDays: 3,
      })),
    ];
    const result = buildIntelligence({
      totalMembers: 10,
      inactiveCount: 0,
      current: { customers: 10, returning: 2, spenders: [] },
      nearRewardCount: 0,
      hasRewardCampaign: false,
      vipQuietCount: 0,
      txs: [],
      members,
    });
    const once = result.actions.find((a) => a.key === 'one_visit');
    assert.ok(once);
    assert.equal(once?.metric.value, 8);
    assert.equal(once?.audience?.rules.visitsMax, 1);
    assert.equal(once?.audience?.rules.windowDays, INTEL_LOOKBACK_DAYS);
    assert.equal(once?.campaign?.suggestedName, 'Segunda visita');
    assert.equal(once?.campaign?.suggestedType, 'promo');
  });

  it('hides the ticket when the estabelecimento only earns carimbos', () => {
    const members = [
      { membershipId: 'a', visitDays: 6 },
      { membershipId: 'b', visitDays: 5 },
      { membershipId: 'c', visitDays: 4 },
      { membershipId: 'd', visitDays: 2 },
    ];
    const purchases = [
      ...Array.from({ length: 4 }, () => ({
        membershipId: 'a',
        amountCents: 2_000,
      })),
      ...Array.from({ length: 4 }, () => ({
        membershipId: 'b',
        amountCents: 8_000,
      })),
    ];
    const result = buildIntelligence({
      totalMembers: 4,
      inactiveCount: 0,
      current: {
        customers: 4,
        returning: 4,
        spenders: [
          { spendCents: 20_000 },
          { spendCents: 80_000 },
        ],
      },
      nearRewardCount: 0,
      hasRewardCampaign: false,
      vipQuietCount: 0,
      txs: [],
      members,
      purchases,
      earnKinds: ['stamps'],
    });
    assert.equal(result.intro.includes('ticket'), false);
    assert.equal(
      result.actions.some((a) => a.key === 'ticket' || a.key === 'high_value'),
      false,
    );
    const regulars = result.actions.find((a) => a.key === 'regulars');
    assert.ok(regulars);
    assert.equal(regulars?.aim, 'Nova visita');
    assert.equal(regulars?.audience?.rules.visitsMin != null, true);
    assert.ok((regulars?.audience?.rules.visitsMin as number) >= 4);
  });

  it('keeps the ticket when pontos or cashback is how the estabelecimento earns', () => {
    const members = [
      { membershipId: 'a', visitDays: 4 },
      { membershipId: 'b', visitDays: 3 },
      { membershipId: 'c', visitDays: 3 },
      { membershipId: 'f', visitDays: 2 },
    ];
    const purchases = [
      ...Array.from({ length: 4 }, () => ({
        membershipId: 'a',
        amountCents: 2_000,
      })),
      ...Array.from({ length: 3 }, () => ({
        membershipId: 'b',
        amountCents: 2_200,
      })),
      ...Array.from({ length: 3 }, () => ({
        membershipId: 'c',
        amountCents: 8_000,
      })),
      ...Array.from({ length: 2 }, () => ({
        membershipId: 'f',
        amountCents: 1_800,
      })),
    ];
    const result = buildIntelligence({
      totalMembers: 4,
      inactiveCount: 0,
      current: emptyCurrent(),
      nearRewardCount: 0,
      hasRewardCampaign: false,
      vipQuietCount: 0,
      txs: [],
      members,
      purchases,
      earnKinds: ['stamps', 'points'],
    });
    assert.equal(result.actions[0]?.key, 'ticket');
    assert.equal(result.intro.includes('ticket'), true);
  });
});

describe('collectPurchases', () => {
  it('counts one compra when pontos and cashback share a sale', () => {
    const purchases = collectPurchases([
      {
        membershipId: 'a',
        type: 'stamp',
        unitKind: 'points',
        amountCents: 8_000,
        metadata: { saleId: 's1', role: 'earn' },
      },
      {
        membershipId: 'a',
        type: 'stamp',
        unitKind: 'cashback_cents',
        amountCents: 7_500,
        metadata: { saleId: 's1', role: 'cashback' },
      },
      {
        membershipId: 'b',
        type: 'stamp',
        unitKind: 'cashback_cents',
        amountCents: 4_200,
        metadata: { saleId: 's2', role: 'cashback' },
      },
      {
        membershipId: 'c',
        type: 'stamp',
        unitKind: 'stamps',
        amountCents: null,
        metadata: { saleId: 's3', role: 'earn' },
      },
      {
        membershipId: 'a',
        type: 'redeem',
        unitKind: 'cashback_cents',
        amountCents: 8_000,
        metadata: { saleId: 's1', role: 'apply' },
      },
    ]);
    assert.deepEqual(purchases, [
      { membershipId: 'a', amountCents: 8_000 },
      { membershipId: 'b', amountCents: 4_200 },
    ]);
  });
});
