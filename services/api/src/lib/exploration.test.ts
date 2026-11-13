import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { cityCenter, nearestMunicipality } from './centroids.js';
import { displayDistanceKm } from './geo.js';
import {
  browsingCity,
  buildExplorationFeed,
  campaignAppliesToCity,
  distanceKmFromCity,
  explorationDistanceLabel,
  leadLine,
  locationDistanceLabelKm,
  locationInExploration,
  orderLocationsForCity,
  type ExplorationCampaign,
  type ExplorationLocation,
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

function northOf(
  origin: { latitude: number; longitude: number },
  km: number,
): { latitude: number; longitude: number } {
  return {
    latitude: origin.latitude + km / 111.32,
    longitude: origin.longitude,
  };
}

describe('locationInExploration', () => {
  const americana = { city: 'Americana', state: 'SP' };
  const novaOdessa = { city: 'Nova Odessa', state: 'SP' };
  const center = cityCenter('Americana', 'SP');

  it('includes Americana for someone browsing Nova Odessa', () => {
    const km = distanceKmFromCity(
      { id: 'am', city: 'Americana', state: 'SP' },
      novaOdessa,
    );
    assert.ok(km != null && km > 6 && km < 7);
    assert.equal(displayDistanceKm(km!), 6);
    assert.equal(
      locationInExploration({ id: 'am', city: 'Americana', state: 'SP' }, novaOdessa),
      true,
    );
    assert.deepEqual(
      explorationDistanceLabel(
        [{ id: 'am', city: 'Americana', state: 'SP' }],
        novaOdessa,
      ),
      { city: 'Americana', distanceKm: 6 },
    );
  });

  it('leaves Campinas outside the Nova Odessa ring', () => {
    assert.equal(
      locationInExploration({ id: 'cps', city: 'Campinas', state: 'SP' }, novaOdessa),
      false,
    );
  });

  it('keeps a unidade in the browsed city even far from the center', () => {
    assert.ok(center);
    const far = northOf(center, 30);
    const location: ExplorationLocation = {
      id: 'far',
      city: 'Americana',
      state: 'SP',
      ...far,
    };
    assert.equal(locationInExploration(location, americana), true);
    assert.equal(explorationDistanceLabel([location], americana), null);
    assert.equal(locationDistanceLabelKm(location, americana), null);
    const phone = northOf(center, 2);
    assert.deepEqual(explorationDistanceLabel([location], americana, phone), {
      city: null,
      distanceKm: 28,
    });
    assert.equal(locationDistanceLabelKm(location, americana, phone), 28);
  });

  it('uses the nearer unidade, including one outside the city', () => {
    assert.ok(center);
    const label = explorationDistanceLabel(
      [
        { id: 'home', city: 'Americana', state: 'SP', ...northOf(center, 12) },
        { id: 'near', city: 'Nova Odessa', state: 'SP', ...northOf(center, 4) },
      ],
      americana,
    );
    assert.deepEqual(label, { city: 'Nova Odessa', distanceKm: 4 });
  });

  it('hides Distância when the nearest unidade is in the browsed city', () => {
    assert.ok(center);
    assert.equal(
      explorationDistanceLabel(
        [
          { id: 'home', city: 'Americana', state: 'SP', ...northOf(center, 2) },
          { id: 'near', city: 'Nova Odessa', state: 'SP', ...northOf(center, 6) },
        ],
        americana,
      ),
      null,
    );
  });

  it('stops at 15 km and shows 1 km under a kilometer', () => {
    assert.ok(center);
    assert.equal(
      locationInExploration(
        { id: 'edge', city: 'Sumaré', state: 'SP', ...northOf(center, 14.9) },
        americana,
      ),
      true,
    );
    assert.equal(
      locationInExploration(
        { id: 'out', city: 'Limeira', state: 'SP', ...northOf(center, 15.2) },
        americana,
      ),
      false,
    );
    assert.deepEqual(
      explorationDistanceLabel(
        [{ id: 'door', city: 'Nova Odessa', state: 'SP', ...northOf(center, 0.4) }],
        americana,
      ),
      { city: 'Nova Odessa', distanceKm: 1 },
    );
  });

  it('names the municipality under the phone', () => {
    const center = cityCenter('Nova Odessa', 'SP');
    assert.ok(center);
    assert.deepEqual(nearestMunicipality(center), {
      city: 'Nova Odessa',
      state: 'SP',
    });
    assert.deepEqual(nearestMunicipality(northOf(center, 2)), {
      city: 'Nova Odessa',
      state: 'SP',
    });
  });

  it('lists a Campanha on a unidade inside the ring', () => {
    assert.equal(
      campaignAppliesToCity(
        campaign({ id: 'near', type: 'stamps', locationIds: ['am'] }),
        [{ id: 'am', city: 'Americana', state: 'SP' }],
        novaOdessa,
      ),
      true,
    );
    assert.equal(
      campaignAppliesToCity(
        campaign({ id: 'far', type: 'stamps', locationIds: ['cps'] }),
        [{ id: 'cps', city: 'Campinas', state: 'SP' }],
        novaOdessa,
      ),
      false,
    );
  });
});

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

  it('lists the browsed city first, then the nearer unidade', () => {
    const origin = cityCenter('Americana', 'SP');
    assert.ok(origin);
    const ordered = orderLocationsForCity(
      [
        { id: 'far', city: 'Sumaré', state: 'SP', ...northOf(origin, 12) },
        { id: 'home', city: 'Americana', state: 'SP' },
        { id: 'near', city: 'Nova Odessa', state: 'SP', ...northOf(origin, 4) },
      ],
      { city: 'Americana', state: 'SP' },
    );
    assert.deepEqual(
      ordered.map((location) => location.id),
      ['home', 'near', 'far'],
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
