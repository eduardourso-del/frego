import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  evaluateAudience,
  parseAudienceRules,
  queryRulesFromParams,
} from './audience.js';

const baseStats = {
  spendCents: 10_000,
  visits: 3,
  lastVisitAt: new Date('2026-09-01T12:00:00Z'),
  isVip: false,
  nearReward: false,
  tagIds: [] as string[],
};

describe('parseAudienceRules tags', () => {
  it('treats omitted and empty tagIds as no filter', () => {
    const empty = parseAudienceRules({ version: 1 });
    assert.equal(empty.tagIds, undefined);
    const blank = parseAudienceRules({ version: 1, tagIds: [] });
    assert.deepEqual(blank.tagIds, []);
  });

  it('splits comma-separated tagIds from query strings', () => {
    const rules = parseAudienceRules({
      version: 1,
      tagIds: 'a,b',
      tagMatch: 'all',
    });
    assert.deepEqual(rules.tagIds, ['a', 'b']);
    assert.equal(rules.tagMatch, 'all');
  });
});

describe('evaluateAudience tags', () => {
  it('ignores tags when the rule has none', () => {
    const rules = parseAudienceRules({ version: 1, spendCentsMin: 1000 });
    assert.equal(
      evaluateAudience({ ...baseStats, tagIds: [] }, rules),
      true,
    );
    assert.equal(
      evaluateAudience({ ...baseStats, tagIds: ['x'] }, rules),
      true,
    );
  });

  it('matches any of the selected tags by default', () => {
    const rules = parseAudienceRules({ version: 1, tagIds: ['lunch', 'vip'] });
    assert.equal(
      evaluateAudience({ ...baseStats, tagIds: ['lunch'] }, rules),
      true,
    );
    assert.equal(
      evaluateAudience({ ...baseStats, tagIds: ['other'] }, rules),
      false,
    );
  });

  it('matches all selected tags when tagMatch is all', () => {
    const rules = parseAudienceRules({
      version: 1,
      tagIds: ['lunch', 'regular'],
      tagMatch: 'all',
    });
    assert.equal(
      evaluateAudience({ ...baseStats, tagIds: ['lunch'] }, rules),
      false,
    );
    assert.equal(
      evaluateAudience(
        { ...baseStats, tagIds: ['lunch', 'regular'] },
        rules,
      ),
      true,
    );
  });

  it('combines VIP and tags', () => {
    const rules = parseAudienceRules({
      version: 1,
      isVip: true,
      tagIds: ['lunch'],
    });
    assert.equal(
      evaluateAudience(
        { ...baseStats, isVip: true, tagIds: ['lunch'] },
        rules,
      ),
      true,
    );
    assert.equal(
      evaluateAudience(
        { ...baseStats, isVip: false, tagIds: ['lunch'] },
        rules,
      ),
      false,
    );
  });
});

describe('queryRulesFromParams tags', () => {
  it('reads tagIds from the query string', () => {
    const rules = queryRulesFromParams({ tagIds: 'a,b', tagMatch: 'all' });
    assert.ok(rules);
    assert.deepEqual(rules?.tagIds, ['a', 'b']);
    assert.equal(rules?.tagMatch, 'all');
  });

  it('returns null when there are no audience params', () => {
    assert.equal(queryRulesFromParams({}), null);
  });
});
