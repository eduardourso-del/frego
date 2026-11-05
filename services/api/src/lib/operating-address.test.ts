import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { pickOperatingLocation, pickStaffLocation } from './operating-address.js';

describe('staff till location', () => {
  it('uses the unidade that has a UF', () => {
    assert.equal(
      pickOperatingLocation([
        { id: 'bare', state: null },
        { id: 'sp', state: 'SP' },
      ]),
      'sp',
    );
  });

  it('uses the operating unidade when the membro has none', () => {
    assert.equal(
      pickStaffLocation({
        requested: null,
        memberLocationId: null,
        operatingLocationId: 'sp',
      }),
      'sp',
    );
    assert.equal(
      pickStaffLocation({
        requested: null,
        memberLocationId: 'assigned',
        operatingLocationId: 'sp',
      }),
      'assigned',
    );
  });
});
