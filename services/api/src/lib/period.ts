import { z } from 'zod';

const ISO_DAY = /^\d{4}-\d{2}-\d{2}$/;
const MAX_DAYS = 366;
const MS_DAY = 86_400_000;

export const periodQuerySchema = z.object({
  range: z.string().optional(),
  from: z.string().optional(),
  to: z.string().optional(),
});

export type PeriodQuery = z.infer<typeof periodQuerySchema>;

export function startOfDay(d: Date) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

export function addDays(d: Date, n: number) {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  return x;
}

export function parseLocalDay(iso: string): Date {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, m - 1, d, 0, 0, 0, 0);
}

export type PeriodWindow = {
  key: string;
  from: Date;
  toExclusive: Date;
  prevFrom: Date;
  prevTo: Date;
  days: number;
};

function calendarDaysInclusive(from: Date, last: Date) {
  return Math.round((last.getTime() - from.getTime()) / MS_DAY) + 1;
}

/**
 * Preset `today` = calendar today until now.
 * Numeric presets = last N days including today, until now.
 * `from`+`to` (YYYY-MM-DD) = custom inclusive range, capped at 366 days.
 */
export function resolvePeriod(
  query: PeriodQuery,
  presets: Record<string, number | 'today'>,
  defaultRange: string,
  now = new Date(),
): PeriodWindow {
  const todayStart = startOfDay(now);

  if (
    query.from &&
    query.to &&
    ISO_DAY.test(query.from) &&
    ISO_DAY.test(query.to)
  ) {
    let from = parseLocalDay(query.from);
    let last = parseLocalDay(query.to);
    if (Number.isNaN(from.getTime()) || Number.isNaN(last.getTime())) {
      return resolvePeriod(
        { range: defaultRange },
        presets,
        defaultRange,
        now,
      );
    }
    if (last < from) [from, last] = [last, from];
    const earliest = addDays(todayStart, -(MAX_DAYS - 1));
    if (from < earliest) from = earliest;
    if (last > todayStart) last = todayStart;
    const days = calendarDaysInclusive(from, last);
    const toExclusive =
      last.getTime() === todayStart.getTime() ? now : addDays(last, 1);
    return {
      key: 'custom',
      from,
      toExclusive,
      prevFrom: addDays(from, -days),
      prevTo: from,
      days,
    };
  }

  const range =
    query.range && query.range in presets ? query.range : defaultRange;
  const spec = presets[range]!;
  if (spec === 'today') {
    return {
      key: range,
      from: todayStart,
      toExclusive: now,
      prevFrom: addDays(todayStart, -1),
      prevTo: todayStart,
      days: 1,
    };
  }
  const days = spec;
  const from = addDays(todayStart, -(days - 1));
  return {
    key: range,
    from,
    toExclusive: now,
    prevFrom: addDays(from, -days),
    prevTo: from,
    days,
  };
}
