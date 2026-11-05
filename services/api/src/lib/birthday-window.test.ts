import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { birthdayWindowSpec, birthdayWindowStatus } from './wallet.js';

function day(iso: string) {
  return new Date(`${iso}T00:00:00.000Z`);
}

describe('birthdayWindowStatus', () => {
  const birthday = day('1992-03-10');

  it('keeps the previous 7-day span when the Janela is days', () => {
    const spec = birthdayWindowSpec('days', 7);
    assert.equal(birthdayWindowStatus(birthday, spec, day('2026-03-10')).inWindow, true);
    assert.equal(birthdayWindowStatus(birthday, spec, day('2026-03-16')).inWindow, true);
    const after = birthdayWindowStatus(birthday, spec, day('2026-03-17'));
    assert.equal(after.inWindow, false);
    assert.equal(after.lockedReason, 'outside_window');
    assert.equal(after.unlocksAt?.toISOString().slice(0, 10), '2027-03-10');
  });

  it('counts days until the birthday when the Janela has not opened', () => {
    const status = birthdayWindowStatus(
      birthday,
      birthdayWindowSpec('days', 7),
      day('2026-03-01'),
    );
    assert.equal(status.inWindow, false);
    assert.equal(status.daysUntil, 9);
    assert.equal(status.unlocksAt?.toISOString().slice(0, 10), '2026-03-10');
  });

  it('opens for 15 days beginning on the birthday', () => {
    const spec = birthdayWindowSpec('days', 15);
    assert.equal(birthdayWindowStatus(birthday, spec, day('2026-03-24')).inWindow, true);
    const after = birthdayWindowStatus(birthday, spec, day('2026-03-25'));
    assert.equal(after.inWindow, false);
    assert.equal(after.unlocksAt?.toISOString().slice(0, 10), '2027-03-10');
  });

  it('crosses the new year for a late-December birthday', () => {
    const spec = birthdayWindowSpec('days', 15);
    const born = day('1990-12-28');
    const inside = birthdayWindowStatus(born, spec, day('2026-01-11'));
    assert.equal(inside.inWindow, true);
    assert.equal(inside.unlocksAt?.toISOString().slice(0, 10), '2025-12-28');
    assert.equal(inside.windowEnd?.toISOString().slice(0, 10), '2026-01-11');
    const after = birthdayWindowStatus(born, spec, day('2026-01-12'));
    assert.equal(after.inWindow, false);
    assert.equal(after.unlocksAt?.toISOString().slice(0, 10), '2026-12-28');
  });

  it('uses the calendar month of the birthday', () => {
    const spec = birthdayWindowSpec('month', 7);
    assert.equal(birthdayWindowStatus(birthday, spec, day('2026-02-28')).inWindow, false);
    assert.equal(birthdayWindowStatus(birthday, spec, day('2026-03-01')).inWindow, true);
    assert.equal(birthdayWindowStatus(birthday, spec, day('2026-03-31')).inWindow, true);
    const after = birthdayWindowStatus(birthday, spec, day('2026-04-01'));
    assert.equal(after.inWindow, false);
    assert.equal(after.unlocksAt?.toISOString().slice(0, 10), '2027-03-01');
  });

  it('counts days until the first of the birthday month', () => {
    const status = birthdayWindowStatus(
      birthday,
      birthdayWindowSpec('month', 7),
      day('2026-02-20'),
    );
    assert.equal(status.daysUntil, 9);
    assert.equal(status.unlocksAt?.toISOString().slice(0, 10), '2026-03-01');
  });

  it('keeps a February birthday inside February in a non-leap year', () => {
    const status = birthdayWindowStatus(
      day('2000-02-29'),
      birthdayWindowSpec('month', 7),
      day('2027-02-28'),
    );
    assert.equal(status.inWindow, true);
    assert.equal(status.windowEnd?.toISOString().slice(0, 10), '2027-02-28');
    assert.equal(
      birthdayWindowStatus(
        day('2000-02-29'),
        birthdayWindowSpec('month', 7),
        day('2027-03-01'),
      ).inWindow,
      false,
    );
  });

  it('stays locked without a birthday', () => {
    const status = birthdayWindowStatus(null, birthdayWindowSpec('month', 7), day('2026-03-10'));
    assert.equal(status.inWindow, false);
    assert.equal(status.lockedReason, 'no_birthday');
  });
});
