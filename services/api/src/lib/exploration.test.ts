import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  browsingCity,
  campaignAppliesToCity,
  leadLine,
  orderLocationsForCity,
  type ExplorationCampaign,
} from './exploration.js';

const city = { city: 'São Paulo', state: 'SP' };

function campaign(
  partial: Partial<ExplorationCampaign> & Pick<ExplorationCampaign, 'id' | 'type'>,
): ExplorationCampaign {
  return {
    cashbackPercent: null,
    rewardTitle: null,
    createdAt: new Date('2026-01-01T00:00:00Z'),
    locationIds: [],
    ...partial,
  };
}

describe('campaignAppliesToCity', () => {
  const locations = [
    { id: 'sp', city: 'Sao Paulo', state: 'SP' },
    { id: 'cps', city: 'Campinas', state: 'SP' },
  ];

  it('includes a Campanha with no unidade limit', () => {
    assert.equal(
      campaignAppliesToCity(campaign({ id: 'all', type: 'stamps' }), locations, city),
      true,
    );
  });

  it('drops a Campanha that exists only in another city', () => {
    assert.equal(
      campaignAppliesToCity(
        campaign({ id: 'away', type: 'stamps', locationIds: ['cps'] }),
        locations,
        city,
      ),
      false,
    );
  });
});

describe('orderLocationsForCity', () => {
  it('lists unidades in the browsed city first and keeps the rest', () => {
    const ordered = orderLocationsForCity(
      [
        { id: 'cps', city: 'Campinas', state: 'SP' },
        { id: 'sp', city: 'São Paulo', state: 'SP' },
      ],
      city,
    );
    assert.deepEqual(
      ordered.map((location) => location.id),
      ['sp', 'cps'],
    );
  });
});

describe('leadLine', () => {
  it('uses the highest cashback percent', () => {
    const line = leadLine([
      campaign({
        id: 'stamps',
        type: 'stamps',
        rewardTitle: 'Café',
        createdAt: new Date('2026-01-01'),
      }),
      campaign({
        id: 'low',
        type: 'cashback',
        cashbackPercent: 5,
        createdAt: new Date('2026-01-02'),
      }),
      campaign({
        id: 'high',
        type: 'cashback',
        cashbackPercent: 10,
        createdAt: new Date('2026-01-03'),
      }),
    ]);
    assert.equal(line, '10% de cashback');
  });

  it('skips aniversário and keeps creation order', () => {
    const line = leadLine([
      campaign({
        id: 'birthday',
        type: 'birthday',
        rewardTitle: 'Bolo',
        createdAt: new Date('2026-01-01'),
      }),
      campaign({
        id: 'later',
        type: 'promo',
        rewardTitle: 'Sobremesa',
        createdAt: new Date('2026-02-01'),
      }),
      campaign({
        id: 'first',
        type: 'stamps',
        rewardTitle: 'Café',
        createdAt: new Date('2026-01-15'),
      }),
    ]);
    assert.equal(line, 'Café');
  });
});

describe('browsingCity', () => {
  it('follows Cidade until she picks, then keeps the pick', () => {
    assert.deepEqual(
      browsingCity({
        city: 'Campinas',
        state: 'SP',
        browseCity: null,
        browseState: null,
        browseCityChosen: false,
      }),
      { city: 'Campinas', state: 'SP' },
    );
    assert.deepEqual(
      browsingCity({
        city: 'Campinas',
        state: 'SP',
        browseCity: 'São Paulo',
        browseState: 'SP',
        browseCityChosen: true,
      }),
      { city: 'São Paulo', state: 'SP' },
    );
  });
});
