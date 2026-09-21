import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  earnKindFromCampaignType,
  earnKindsFromCampaignTypes,
} from './earn-kinds.js';

describe('earnKindFromCampaignType', () => {
  it('maps loyalty types onto till earn modes', () => {
    assert.equal(earnKindFromCampaignType('stamps'), 'stamps');
    assert.equal(earnKindFromCampaignType('visits'), 'stamps');
    assert.equal(earnKindFromCampaignType('spend'), 'points');
    assert.equal(earnKindFromCampaignType('cashback'), 'cashback');
    assert.equal(earnKindFromCampaignType('birthday'), null);
    assert.equal(earnKindFromCampaignType('promo'), null);
  });
});

describe('earnKindsFromCampaignTypes', () => {
  it('returns only the kinds the shop actually runs, in till order', () => {
    assert.deepEqual(earnKindsFromCampaignTypes(['stamps']), ['stamps']);
    assert.deepEqual(earnKindsFromCampaignTypes(['cashback', 'stamps']), [
      'stamps',
      'cashback',
    ]);
    assert.deepEqual(earnKindsFromCampaignTypes(['spend', 'spend']), ['points']);
    assert.deepEqual(earnKindsFromCampaignTypes(['birthday']), []);
  });
});
