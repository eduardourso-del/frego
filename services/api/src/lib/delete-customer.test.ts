import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { isTombstonePhone, tombstonePhone } from './delete-customer.js';

describe('tombstonePhone', () => {
  it('frees the real E.164 so the same number can sign up again', () => {
    const phone = tombstonePhone('clxyz');
    assert.equal(phone, 'deleted:clxyz');
    assert.equal(isTombstonePhone(phone), true);
    assert.equal(isTombstonePhone('+5511999000100'), false);
  });
});
