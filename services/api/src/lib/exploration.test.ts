import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  browsingCity,
  buildExplorationFeed,
  campaignAppliesToCity,
  leadLine,
  orderLocationsForCity,
  type ExplorationCampaign,
  type FeedCampaign,
  type FeedPlace,
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

describe('buildExplorationFeed', () => {
  function place(
    partial: Partial<FeedPlace> & Pick<FeedPlace, 'businessId' | 'name' | 'type'>,
  ): FeedPlace {
    return { isFavorite: false, ...partial };
  }

  function camp(
    partial: Partial<FeedCampaign> &
      Pick<FeedCampaign, 'campaignId' | 'businessId' | 'name' | 'type'>,
  ): FeedCampaign {
    return {
      businessName: partial.businessId,
      canRedeem: false,
      isFavorite: false,
      ...partial,
    };
  }

  it('lifts a Tipo she can Resgatar ahead of a Favorito Tipo', () => {
    const feed = buildExplorationFeed(
      [
        place({ businessId: 'padaria', name: 'Pão', type: 'padaria', isFavorite: true }),
        place({ businessId: 'lanche', name: 'Lanche', type: 'lanchonete' }),
      ],
      [
        camp({
          campaignId: 'promo',
          businessId: 'lanche',
          businessName: 'Lanche',
          name: 'Combo',
          type: 'promo',
          canRedeem: true,
        }),
      ],
    );
    assert.deepEqual(
      feed.map((section) => section.type),
      ['lanchonete', 'padaria'],
    );
  });

  it('lists a Tipo that is both Resgatar and Favorito once', () => {
    const feed = buildExplorationFeed(
      [
        place({
          businessId: 'padaria',
          name: 'Pão',
          type: 'padaria',
          isFavorite: true,
        }),
      ],
      [
        camp({
          campaignId: 'cartela',
          businessId: 'padaria',
          businessName: 'Pão',
          name: 'Café',
          type: 'stamps',
          canRedeem: true,
          isFavorite: true,
        }),
      ],
    );
    assert.equal(feed.length, 1);
    assert.equal(feed[0]?.type, 'padaria');
  });

  it('orders Campanhas by Resgatar, Favorito, Promoção, then name', () => {
    const feed = buildExplorationFeed(
      [
        place({ businessId: 'padaria', name: 'Padaria', type: 'restaurant' }),
        place({
          businessId: 'cafe',
          name: 'Café',
          type: 'restaurant',
          isFavorite: true,
        }),
        place({ businessId: 'lanche', name: 'Lanche', type: 'restaurant' }),
      ],
      [
        camp({
          campaignId: 'cash',
          businessId: 'cafe',
          businessName: 'Café',
          name: 'Cashback',
          type: 'cashback',
          canRedeem: true,
          isFavorite: true,
        }),
        camp({
          campaignId: 'promo',
          businessId: 'lanche',
          businessName: 'Lanche',
          name: 'Almoço',
          type: 'promo',
        }),
        camp({
          campaignId: 'cartela',
          businessId: 'padaria',
          businessName: 'Padaria',
          name: 'Café',
          type: 'stamps',
          canRedeem: true,
        }),
        camp({
          campaignId: 'birthday',
          businessId: 'lanche',
          businessName: 'Lanche',
          name: 'Bolo',
          type: 'birthday',
        }),
      ],
    );
    assert.deepEqual(
      feed[0]?.campaigns.map((campaign) => campaign.campaignId),
      ['cartela', 'cash', 'promo', 'birthday'],
    );
  });

  it('orders Estabelecimentos by Favorito, then name', () => {
    const feed = buildExplorationFeed(
      [
        place({ businessId: 'b', name: 'Beta', type: 'bar' }),
        place({ businessId: 'a', name: 'Alfa', type: 'bar', isFavorite: true }),
        place({ businessId: 'c', name: 'Casa', type: 'bar' }),
      ],
      [],
    );
    assert.deepEqual(
      feed[0]?.places.map((item) => item.businessId),
      ['a', 'b', 'c'],
    );
  });

  it('keeps the fixed Tipo order when nobody can Resgatar or has a Favorito', () => {
    const feed = buildExplorationFeed(
      [
        place({ businessId: 'l', name: 'Lanche', type: 'lanchonete' }),
        place({ businessId: 'p', name: 'Pão', type: 'padaria' }),
      ],
      [],
    );
    assert.deepEqual(
      feed.map((section) => section.type),
      ['padaria', 'lanchonete'],
    );
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
