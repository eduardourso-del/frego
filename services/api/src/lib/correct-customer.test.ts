import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  normalizeDisplayName,
  phoneRetargetBlock,
} from './correct-customer.js';

const open = {
  deletedAt: null,
  firebaseUid: null,
  onboardingCompleted: false,
  deviceTokenCount: 0,
  otherMembershipCount: 0,
};

describe('phoneRetargetBlock', () => {
  it('allows an unclaimed registration at this estabelecimento only', () => {
    assert.equal(phoneRetargetBlock(open), null);
  });

  it('blocks a Cliente who already uses the app', () => {
    assert.equal(phoneRetargetBlock({ ...open, firebaseUid: 'uid' }), 'app');
    assert.equal(
      phoneRetargetBlock({ ...open, onboardingCompleted: true }),
      'app',
    );
    assert.equal(phoneRetargetBlock({ ...open, deviceTokenCount: 1 }), 'app');
  });

  it('blocks a Cliente of another estabelecimento', () => {
    assert.equal(
      phoneRetargetBlock({ ...open, otherMembershipCount: 1 }),
      'other_shop',
    );
  });

  it('blocks a deleted account before the other gates', () => {
    assert.equal(
      phoneRetargetBlock({
        ...open,
        deletedAt: new Date(),
        firebaseUid: 'uid',
        otherMembershipCount: 2,
      }),
      'deleted',
    );
  });
});

describe('normalizeDisplayName', () => {
  it('trims and collapses whitespace', () => {
    assert.equal(normalizeDisplayName('  Ana   Souza '), 'Ana Souza');
  });

  it('clears a blank name', () => {
    assert.equal(normalizeDisplayName('   '), null);
    assert.equal(normalizeDisplayName(null), null);
  });

  it('clips to 80 characters', () => {
    assert.equal(normalizeDisplayName('a'.repeat(90))?.length, 80);
  });
});
