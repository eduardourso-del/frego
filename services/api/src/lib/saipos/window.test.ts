import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { saiposQueryWindow } from './window.js';

const HOUR = 60 * 60 * 1000;
const DAY = 24 * HOUR;

describe('saiposQueryWindow', () => {
  it('asks for one day when the cursor is days behind', () => {
    const connectedAt = new Date('2026-11-13T10:41:21.647Z');
    const cursor = new Date('2026-11-16T18:00:11.648Z');
    const now = new Date('2026-11-19T13:00:00.000Z');
    const window = saiposQueryWindow({
      connectedAt,
      cursorUpdatedAt: cursor,
      now,
    });
    assert.equal(window.start.toISOString(), '2026-11-16T12:00:11.648Z');
    assert.equal(window.end.getTime() - window.start.getTime(), DAY);
    assert.equal(window.caughtUp, false);
    assert.equal(window.cursorNext.toISOString(), window.end.toISOString());
  });

  it('catches up and keeps a six-hour overlap when the gap is under a day', () => {
    const connectedAt = new Date('2026-11-13T10:41:21.647Z');
    const cursor = new Date('2026-11-16T18:00:00.000Z');
    const now = new Date('2026-11-16T20:00:00.000Z');
    const window = saiposQueryWindow({
      connectedAt,
      cursorUpdatedAt: cursor,
      now,
    });
    assert.equal(window.end.toISOString(), now.toISOString());
    assert.equal(window.caughtUp, true);
    assert.equal(window.cursorNext.toISOString(), new Date(now.getTime() - 6 * HOUR).toISOString());
  });

  it('does not look before the token was saved', () => {
    const connectedAt = new Date('2026-11-13T10:41:21.647Z');
    const now = new Date(connectedAt.getTime() + 2 * HOUR);
    const window = saiposQueryWindow({
      connectedAt,
      cursorUpdatedAt: null,
      now,
    });
    assert.equal(window.start.toISOString(), connectedAt.toISOString());
    assert.equal(window.caughtUp, true);
    assert.equal(window.cursorNext.toISOString(), connectedAt.toISOString());
  });
});
