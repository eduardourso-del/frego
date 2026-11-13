import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { displayDistanceKm, haversineKm, parseOrigin } from './geo.js';
import { cityCenter } from './centroids.js';

describe('displayDistanceKm', () => {
  it('rounds to the nearest kilometer and never shows 0', () => {
    assert.equal(displayDistanceKm(0.4), 1);
    assert.equal(displayDistanceKm(0.5), 1);
    assert.equal(displayDistanceKm(1.4), 1);
    assert.equal(displayDistanceKm(6.5), 7);
    assert.equal(displayDistanceKm(15), 15);
  });
});

describe('parseOrigin', () => {
  it('accepts a coordinate pair and rejects a partial one', () => {
    assert.deepEqual(parseOrigin('-22.74', '-47.33'), {
      latitude: -22.74,
      longitude: -47.33,
    });
    assert.equal(parseOrigin('-22.74', undefined), null);
    assert.equal(parseOrigin('norte', '-47'), null);
    assert.equal(parseOrigin('91', '0'), null);
  });
});

describe('haversineKm', () => {
  it('puts Nova Odessa about 6.5 km from Americana', () => {
    const americana = cityCenter('Americana', 'SP');
    const novaOdessa = cityCenter('Nova Odessa', 'SP');
    assert.ok(americana);
    assert.ok(novaOdessa);
    const km = haversineKm(americana, novaOdessa);
    assert.ok(km > 6 && km < 7);
  });
});
