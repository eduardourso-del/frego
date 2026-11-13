import { afterEach, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { geocodeAddress, geocodeQuery } from './geocode.js';

describe('geocodeQuery', () => {
  it('prefers the street parts', () => {
    assert.equal(
      geocodeQuery({
        street: 'Rua A',
        streetNumber: '10',
        neighborhood: 'Centro',
        city: 'Americana',
        state: 'SP',
        postalCode: '13465000',
        address: 'ignored',
      }),
      'Rua A, 10, Centro, Americana, SP, 13465000, Brasil',
    );
  });

  it('falls back to the address line', () => {
    assert.equal(geocodeQuery({ address: 'Rua A, 10' }), 'Rua A, 10, Brasil');
    assert.equal(geocodeQuery({ address: 'Rua A, Brasil' }), 'Rua A, Brasil');
    assert.equal(geocodeQuery({ city: 'Americana' }), null);
  });
});

describe('geocodeAddress', () => {
  const previous = process.env.GOOGLE_GEOCODING_API_KEY;

  afterEach(() => {
    if (previous === undefined) delete process.env.GOOGLE_GEOCODING_API_KEY;
    else process.env.GOOGLE_GEOCODING_API_KEY = previous;
  });

  it('does not call Google without a key', async () => {
    delete process.env.GOOGLE_GEOCODING_API_KEY;
    let called = false;
    const point = await geocodeAddress('Americana', async () => {
      called = true;
      return new Response('{}');
    });
    assert.equal(point, null);
    assert.equal(called, false);
  });

  it('reads the first result', async () => {
    process.env.GOOGLE_GEOCODING_API_KEY = 'test-key';
    const point = await geocodeAddress('Rua A', async (input) => {
      const url = new URL(String(input));
      assert.equal(url.searchParams.get('key'), 'test-key');
      assert.equal(url.searchParams.get('components'), 'country:BR');
      return new Response(
        JSON.stringify({
          status: 'OK',
          results: [{ geometry: { location: { lat: -22.7, lng: -47.3 } } }],
        }),
      );
    });
    assert.deepEqual(point, { latitude: -22.7, longitude: -47.3 });
  });
});
