import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  buildStampDestinations,
  nextActivatedAt,
  resolveCartelaWrite,
  resolveStampEarnCampaignId,
} from './stamp-destination.js';
import { isNearRewardCampaign, ledgerPoolEvents } from './wallet.js';

describe('buildStampDestinations', () => {
  it('names the shared row after the only shared Campanha', () => {
    const rows = buildStampDestinations({
      sharedBalance: 4,
      activeShared: [{ id: 'brigadeiro', name: 'Brigadeiro' }],
      activeCartelas: [{ id: 'cafe', name: 'Café', balance: 9 }],
    });
    assert.deepEqual(
      rows.map((r) => [r.label, r.balance, r.cartela, r.earnable, r.campaignId]),
      [
        ['Brigadeiro', 4, false, true, null],
        ['Café', 9, true, true, 'cafe'],
      ],
    );
  });

  it('uses Carimbos when several Campanhas share the pile', () => {
    const rows = buildStampDestinations({
      sharedBalance: 4,
      activeShared: [
        { id: 'a', name: 'Brigadeiro' },
        { id: 'b', name: 'Pudim' },
      ],
      activeCartelas: [],
    });
    assert.equal(rows.length, 1);
    assert.equal(rows[0]?.label, 'Carimbos');
    assert.equal(rows[0]?.campaignId, null);
  });

  it('keeps a waiting shared balance when no shared Campanha is active', () => {
    const rows = buildStampDestinations({
      sharedBalance: 3,
      activeShared: [],
      activeCartelas: [{ id: 'cafe', name: 'Café', balance: 1 }],
    });
    assert.equal(rows[0]?.earnable, false);
    assert.equal(rows[0]?.balance, 3);
    assert.equal(rows[1]?.earnable, true);
  });
});

describe('resolveStampEarnCampaignId', () => {
  const cafe = {
    campaignId: 'cafe',
    label: 'Café',
    balance: 0,
    cartela: true,
    earnable: true,
  };
  const shared = {
    campaignId: null,
    label: 'Brigadeiro',
    balance: 0,
    cartela: false,
    earnable: true,
  };

  it('auto-picks the only destination', () => {
    assert.deepEqual(resolveStampEarnCampaignId([cafe], undefined), {
      ok: true,
      campaignId: 'cafe',
    });
    assert.deepEqual(resolveStampEarnCampaignId([shared], undefined), {
      ok: true,
      campaignId: null,
    });
  });

  it('requires a choice when more than one destination can be stamped', () => {
    const missing = resolveStampEarnCampaignId([shared, cafe], undefined);
    assert.equal(missing.ok, false);
    if (!missing.ok) assert.equal(missing.error, 'STAMP_DESTINATION_REQUIRED');

    assert.deepEqual(resolveStampEarnCampaignId([shared, cafe], 'shared'), {
      ok: true,
      campaignId: null,
    });
    assert.deepEqual(resolveStampEarnCampaignId([shared, cafe], 'cafe'), {
      ok: true,
      campaignId: 'cafe',
    });
  });

  it('rejects a shared Campanha id as if it were a Cartela', () => {
    const got = resolveStampEarnCampaignId([shared, cafe], 'brigadeiro');
    assert.equal(got.ok, false);
  });
});

describe('resolveCartelaWrite', () => {
  it('allows the flag only before the first activation', () => {
    assert.deepEqual(
      resolveCartelaWrite({
        nextType: 'stamps',
        requested: true,
        existing: null,
      }),
      { ok: true, cartela: true },
    );
    const locked = resolveCartelaWrite({
      nextType: 'stamps',
      requested: true,
      existing: {
        type: 'stamps',
        cartela: false,
        activatedAt: new Date('2026-01-01'),
      },
    });
    assert.equal(locked.ok, false);
  });

  it('sets activatedAt the first time a Campanha becomes active', () => {
    const now = new Date('2026-10-06T12:00:00Z');
    assert.equal(nextActivatedAt(null, 'draft', now), null);
    assert.equal(nextActivatedAt(null, 'active', now), now);
    const prior = new Date('2026-01-01');
    assert.equal(nextActivatedAt(prior, 'paused', now), prior);
  });
});

describe('ledgerPoolEvents cartela', () => {
  const at = new Date('2026-10-01T12:00:00Z');
  const meta = new Map([
    [
      'cafe',
      {
        id: 'cafe',
        name: 'Café',
        type: 'stamps',
        stampsNeeded: 10,
        cartela: true,
      },
    ],
    [
      'lunch',
      {
        id: 'lunch',
        name: 'Almoço',
        type: 'stamps',
        stampsNeeded: 10,
        cartela: false,
      },
    ],
  ]);

  it('keeps Cartela carimbos out of the shared pile', () => {
    const events = ledgerPoolEvents(
      [
        {
          type: 'stamp',
          quantity: 9,
          unitKind: 'stamps',
          campaignId: 'cafe',
          amountCents: null,
          createdAt: at,
        },
        {
          type: 'stamp',
          quantity: 4,
          unitKind: 'stamps',
          campaignId: null,
          amountCents: null,
          createdAt: at,
        },
        {
          type: 'redeem',
          quantity: 1,
          unitKind: null,
          campaignId: 'lunch',
          amountCents: null,
          createdAt: at,
        },
      ],
      meta,
    );
    assert.equal(
      events.stamps.reduce((sum, e) => sum + (e.kind === 'earn' ? e.quantity : -e.quantity), 0),
      -6,
    );
    assert.equal(events.cartelas.get('cafe')?.[0]?.quantity, 9);
  });
});

describe('isNearRewardCampaign', () => {
  it('counts a customer once when any Campanha is close on its own balance', () => {
    const pools = { stamps: 0, points: 0 };
    assert.equal(
      isNearRewardCampaign(
        { type: 'stamps', unitsNeeded: 10, cartela: true, balance: 8 },
        pools,
      ),
      true,
    );
    assert.equal(
      isNearRewardCampaign(
        { type: 'stamps', unitsNeeded: 10, cartela: true, balance: 1 },
        pools,
      ),
      false,
    );
  });
});
