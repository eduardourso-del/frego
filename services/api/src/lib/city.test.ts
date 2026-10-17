import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { findCity, foldCity, groupCities, sameCity } from './city.js';
import { listMunicipalities } from './municipalities.js';

describe('foldCity', () => {
  it('treats São Paulo and Sao Paulo as the same city', () => {
    assert.equal(foldCity('São Paulo'), foldCity('Sao Paulo'));
    assert.equal(foldCity('  SÃO   PAULO '), foldCity('sao paulo'));
  });
});

describe('sameCity', () => {
  it('requires the same UF', () => {
    assert.equal(sameCity('Bom Jesus', 'PI', 'Bom Jesus', 'RS'), false);
    assert.equal(sameCity('São Paulo', 'sp', 'Sao Paulo', 'SP'), true);
  });
});

describe('listMunicipalities', () => {
  it('resolves a home city that has no estabelecimento', () => {
    const cities = listMunicipalities();
    assert.ok(cities.length > 5000);
    assert.deepEqual(findCity(cities, 'Sao Paulo', 'sp'), {
      city: 'São Paulo',
      state: 'SP',
    });
    assert.equal(findCity(cities, 'Narnia', 'SP'), null);
  });
});

describe('groupCities', () => {
  it('keeps one row per city and UF and prefers the accented spelling', () => {
    const cities = groupCities([
      { city: 'Sao Paulo', state: 'SP' },
      { city: 'São Paulo', state: 'sp' },
      { city: 'Campinas', state: 'SP' },
      { city: null, state: 'SP' },
      { city: 'Campinas', state: null },
    ]);
    assert.deepEqual(cities, [
      { city: 'Campinas', state: 'SP' },
      { city: 'São Paulo', state: 'SP' },
    ]);
  });
});
