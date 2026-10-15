import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  GRACE_MS,
  effectivePaidTier,
  resolveAccess,
  upgradeDifferenceCents,
  type BillingSnapshot,
} from './plan-access.js';

const NOW = new Date('2026-10-14T15:00:00.000Z');

function snap(partial: Partial<BillingSnapshot> = {}): BillingSnapshot {
  return {
    businessStatus: 'active',
    now: NOW,
    trialEndsAt: null,
    cortesiaTier: null,
    paidTier: null,
    scheduledTier: null,
    cancelAtPeriodEnd: false,
    periodEndsAt: null,
    pastDueAt: null,
    paidReplacedCortesia: false,
    ...partial,
  };
}

describe('resolveAccess', () => {
  it('keeps a pending Estabelecimento closed even with a Cortesia', () => {
    const access = resolveAccess(
      snap({ businessStatus: 'pending', cortesiaTier: 'growth' }),
    );
    assert.equal(access.mode, 'pending');
    assert.equal(access.publicPage, false);
  });

  it('keeps a suspended Estabelecimento closed', () => {
    assert.equal(
      resolveAccess(snap({ businessStatus: 'suspended', paidTier: 'enterprise' }))
        .mode,
      'suspended',
    );
  });

  it('gives the trial Enterprise, including after an early payment', () => {
    const trialEndsAt = new Date(NOW.getTime() + 60_000);
    const access = resolveAccess(
      snap({ trialEndsAt, paidTier: 'starter', businessStatus: 'trial' }),
    );
    assert.equal(access.mode, 'open');
    assert.equal(access.tier, 'enterprise');
    assert.equal(access.source, 'trial');
    assert.equal(access.features.intelligence, true);
    assert.equal(access.features.whatsapp, true);
  });

  it('locks when the trial ends without a confirmed payment', () => {
    const access = resolveAccess(
      snap({ trialEndsAt: new Date(NOW.getTime() - 1000) }),
    );
    assert.equal(access.mode, 'locked');
    assert.equal(access.publicPage, false);
  });

  it('follows a Cortesia immediately, including during the trial', () => {
    const access = resolveAccess(
      snap({
        trialEndsAt: new Date(NOW.getTime() + 86_400_000),
        cortesiaTier: 'starter',
      }),
    );
    assert.equal(access.tier, 'starter');
    assert.equal(access.source, 'cortesia');
    assert.equal(access.features.whatsapp, false);
    assert.equal(access.features.audiences, false);
  });

  it('applies a payment that replaced a Cortesia during the trial', () => {
    const access = resolveAccess(
      snap({
        trialEndsAt: new Date(NOW.getTime() + 86_400_000),
        cortesiaTier: 'starter',
        paidTier: 'growth',
        paidReplacedCortesia: true,
      }),
    );
    assert.equal(access.tier, 'growth');
    assert.equal(access.source, 'paid');
    assert.equal(access.features.whatsapp, true);
    assert.equal(access.features.reports, false);
  });

  it('keeps the paid Plano open for 3 days after the due date, then locks', () => {
    const pastDueAt = new Date(NOW.getTime() - GRACE_MS + 1000);
    const during = resolveAccess(snap({ paidTier: 'growth', pastDueAt }));
    assert.equal(during.mode, 'open');
    assert.equal(during.source, 'grace');
    assert.equal(during.publicPage, true);

    const after = resolveAccess(
      snap({
        paidTier: 'growth',
        pastDueAt: new Date(NOW.getTime() - GRACE_MS),
      }),
    );
    assert.equal(after.mode, 'locked');
  });

  it('keeps Growth until a scheduled downgrade reaches the period end', () => {
    const before = resolveAccess(
      snap({
        paidTier: 'growth',
        scheduledTier: 'starter',
        periodEndsAt: new Date(NOW.getTime() + 86_400_000),
      }),
    );
    assert.equal(before.tier, 'growth');

    const ended = snap({
      paidTier: 'growth',
      scheduledTier: 'starter',
      periodEndsAt: new Date(NOW.getTime() - 1000),
    });
    assert.equal(effectivePaidTier(ended), 'starter');
    assert.equal(resolveAccess(ended).tier, 'starter');
  });

  it('locks after a cancel reaches the period end', () => {
    const access = resolveAccess(
      snap({
        paidTier: 'starter',
        cancelAtPeriodEnd: true,
        periodEndsAt: new Date(NOW.getTime() - 1000),
      }),
    );
    assert.equal(access.mode, 'locked');
  });

  it('splits features across the three Planos', () => {
    const starter = resolveAccess(snap({ paidTier: 'starter' }));
    assert.equal(starter.features.audiences, false);
    assert.equal(starter.features.pesquisas, false);
    assert.equal(starter.features.extraLocations, true);

    const growth = resolveAccess(snap({ paidTier: 'growth' }));
    assert.equal(growth.features.audiences, true);
    assert.equal(growth.features.pesquisas, false);
    assert.equal(growth.features.whatsapp, true);
    assert.equal(growth.features.intelligence, false);
    assert.equal(growth.features.reports, false);
    assert.equal(growth.features.extraLocations, true);

    const enterprise = resolveAccess(snap({ paidTier: 'enterprise' }));
    assert.equal(enterprise.features.pesquisas, true);
    assert.equal(enterprise.features.intelligence, true);
    assert.equal(enterprise.features.reports, true);
    assert.equal(enterprise.features.extraLocations, true);
  });
});

describe('upgradeDifferenceCents', () => {
  it('charges only the gap between Planos', () => {
    assert.equal(upgradeDifferenceCents('starter', 'growth'), 4000);
    assert.equal(upgradeDifferenceCents('growth', 'enterprise'), 4000);
    assert.equal(upgradeDifferenceCents('starter', 'enterprise'), 8000);
  });
});
