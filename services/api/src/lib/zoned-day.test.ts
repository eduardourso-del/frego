import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { timeZoneForUf } from './br-fuso.js';
import { resolvePeriod } from './period.js';
import { ymdInTimeZone, zonedMidnight } from './zoned-day.js';

describe('Fuso from UF', () => {
  it('maps the states whose offsets differ', () => {
    assert.equal(timeZoneForUf('SP'), 'America/Sao_Paulo');
    assert.equal(timeZoneForUf('ac'), 'America/Rio_Branco');
    assert.equal(timeZoneForUf('AM'), 'America/Manaus');
    assert.equal(timeZoneForUf('MT'), 'America/Cuiaba');
    assert.equal(timeZoneForUf('XX'), null);
  });
});

describe('establishment civil day', () => {
  // 00:30 UTC is 21:30 the previous evening in São Paulo, and 19:30 in Acre.
  const justAfterUtcMidnight = new Date('2026-10-15T00:30:00.000Z');

  it('keeps 21:30 in São Paulo on the same civil day', () => {
    assert.equal(ymdInTimeZone(justAfterUtcMidnight, 'America/Sao_Paulo'), '2026-10-14');
    assert.equal(
      zonedMidnight('2026-10-14', 'America/Sao_Paulo').toISOString(),
      '2026-10-14T03:00:00.000Z',
    );
  });

  it('keeps the same instant on the Acre day, which is still the 14th', () => {
    assert.equal(ymdInTimeZone(justAfterUtcMidnight, 'America/Rio_Branco'), '2026-10-14');
    assert.equal(
      zonedMidnight('2026-10-14', 'America/Rio_Branco').toISOString(),
      '2026-10-14T05:00:00.000Z',
    );
  });

  it('rolls São Paulo to the 15th at 00:30 there, while Acre is still on the 14th', () => {
    const spMidnight = new Date('2026-10-15T03:30:00.000Z');
    assert.equal(ymdInTimeZone(spMidnight, 'America/Sao_Paulo'), '2026-10-15');
    assert.equal(ymdInTimeZone(spMidnight, 'America/Rio_Branco'), '2026-10-14');
  });

  it('starts Hoje at São Paulo midnight when UTC has already changed date', () => {
    const period = resolvePeriod(
      { range: 'today' },
      { today: 'today' },
      'today',
      justAfterUtcMidnight,
      'America/Sao_Paulo',
    );
    assert.equal(period.from.toISOString(), '2026-10-14T03:00:00.000Z');
    assert.equal(period.toExclusive.toISOString(), justAfterUtcMidnight.toISOString());
    assert.equal(period.prevFrom.toISOString(), '2026-10-13T03:00:00.000Z');
  });
});
