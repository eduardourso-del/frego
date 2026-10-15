import { z } from 'zod';
import { DEFAULT_FUSO } from './br-fuso.js';
import {
  addCivilDays,
  civilDaysInclusive,
  ymdInTimeZone,
  zonedMidnight,
} from './zoned-day.js';

const ISO_DAY = /^\d{4}-\d{2}-\d{2}$/;
const MAX_DAYS = 366;

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

/**
 * Preset `today` = civil today in `timeZone` until now.
 * Numeric presets = last N days including today, until now.
 * `from`+`to` (YYYY-MM-DD) = custom inclusive range, capped at 366 days.
 */
export function resolvePeriod(
  query: PeriodQuery,
  presets: Record<string, number | 'today'>,
  defaultRange: string,
  now = new Date(),
  timeZone = DEFAULT_FUSO,
): PeriodWindow {
  const todayYmd = ymdInTimeZone(now, timeZone);
  const todayStart = zonedMidnight(todayYmd, timeZone);

  if (
    query.from &&
    query.to &&
    ISO_DAY.test(query.from) &&
    ISO_DAY.test(query.to)
  ) {
    let fromYmd = query.from;
    let lastYmd = query.to;
    if (lastYmd < fromYmd) [fromYmd, lastYmd] = [lastYmd, fromYmd];
    const earliest = addCivilDays(todayYmd, -(MAX_DAYS - 1));
    if (fromYmd < earliest) fromYmd = earliest;
    if (lastYmd > todayYmd) lastYmd = todayYmd;
    const days = civilDaysInclusive(fromYmd, lastYmd);
    const from = zonedMidnight(fromYmd, timeZone);
    const toExclusive =
      lastYmd === todayYmd
        ? now
        : zonedMidnight(addCivilDays(lastYmd, 1), timeZone);
    return {
      key: 'custom',
      from,
      toExclusive,
      prevFrom: zonedMidnight(addCivilDays(fromYmd, -days), timeZone),
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
      prevFrom: zonedMidnight(addCivilDays(todayYmd, -1), timeZone),
      prevTo: todayStart,
      days: 1,
    };
  }
  const days = spec;
  const fromYmd = addCivilDays(todayYmd, -(days - 1));
  const from = zonedMidnight(fromYmd, timeZone);
  return {
    key: range,
    from,
    toExclusive: now,
    prevFrom: zonedMidnight(addCivilDays(fromYmd, -days), timeZone),
    prevTo: from,
    days,
  };
}
