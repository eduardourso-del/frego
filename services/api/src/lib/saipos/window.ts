const OVERLAP_MS = 6 * 60 * 60 * 1000;
/** Saipos rejects a filter longer than 15 days. */
const MAX_WINDOW_MS = 15 * 24 * 60 * 60 * 1000 - 60 * 1000;
/**
 * One request covers a day of updated_at, the sync shape their docs describe.
 * A multi-day backlog in a single search is what exhausts their connection pool.
 */
const SLICE_MS = 24 * 60 * 60 * 1000;

export function saiposQueryWindow(input: {
  connectedAt: Date;
  cursorUpdatedAt: Date | null;
  now: Date;
}): { start: Date; end: Date; cursorNext: Date; caughtUp: boolean } {
  const floor = input.connectedAt;
  let start = input.cursorUpdatedAt ?? floor;
  if (start < floor) start = floor;
  start = new Date(start.getTime() - OVERLAP_MS);
  if (start < floor) start = new Date(floor);
  let end = input.now;
  const cap = Math.min(MAX_WINDOW_MS, SLICE_MS);
  if (end.getTime() - start.getTime() > cap) {
    end = new Date(start.getTime() + cap);
  }
  if (end < start) end = new Date(start);
  const caughtUp = end.getTime() >= input.now.getTime() - 1000;
  const cursorNext = caughtUp
    ? new Date(Math.max(floor.getTime(), input.now.getTime() - OVERLAP_MS))
    : end;
  return { start, end, cursorNext, caughtUp };
}
