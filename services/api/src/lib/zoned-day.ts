/** Civil dates in an IANA timezone. Instants stay UTC for the database. */

function zonedParts(date: Date, timeZone: string) {
  const dtf = new Intl.DateTimeFormat('en-US', {
    timeZone,
    hourCycle: 'h23',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
  const map: Record<string, string> = {};
  for (const part of dtf.formatToParts(date)) {
    if (part.type !== 'literal') map[part.type] = part.value;
  }
  let hour = Number(map.hour);
  if (hour === 24) hour = 0;
  return {
    year: Number(map.year),
    month: Number(map.month),
    day: Number(map.day),
    hour,
    minute: Number(map.minute),
    second: Number(map.second),
  };
}

function pad(n: number) {
  return String(n).padStart(2, '0');
}

export function ymdInTimeZone(date: Date, timeZone: string): string {
  const p = zonedParts(date, timeZone);
  return `${p.year}-${pad(p.month)}-${pad(p.day)}`;
}

export function addCivilDays(ymd: string, days: number): string {
  const [y, m, d] = ymd.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d + days)).toISOString().slice(0, 10);
}

function offsetMs(date: Date, timeZone: string): number {
  const p = zonedParts(date, timeZone);
  const asUtc = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second);
  return asUtc - date.getTime();
}

/** UTC instant of 00:00 on the civil `ymd` in `timeZone`. */
export function zonedMidnight(ymd: string, timeZone: string): Date {
  const [y, m, d] = ymd.split('-').map(Number);
  const guess = new Date(Date.UTC(y, m - 1, d, 0, 0, 0));
  let start = new Date(guess.getTime() - offsetMs(guess, timeZone));
  if (ymdInTimeZone(start, timeZone) !== ymd) {
    start = new Date(guess.getTime() - offsetMs(start, timeZone));
  }
  return start;
}

export function startOfZonedDay(date: Date, timeZone: string): Date {
  return zonedMidnight(ymdInTimeZone(date, timeZone), timeZone);
}

export function addZonedDays(date: Date, days: number, timeZone: string): Date {
  return zonedMidnight(addCivilDays(ymdInTimeZone(date, timeZone), days), timeZone);
}

export function startOfZonedMonth(date: Date, timeZone: string): Date {
  const ymd = ymdInTimeZone(date, timeZone);
  return zonedMidnight(`${ymd.slice(0, 7)}-01`, timeZone);
}

export function addZonedMonths(date: Date, months: number, timeZone: string): Date {
  const ymd = ymdInTimeZone(date, timeZone);
  let year = Number(ymd.slice(0, 4));
  let month = Number(ymd.slice(5, 7)) - 1 + months;
  year += Math.floor(month / 12);
  month = ((month % 12) + 12) % 12;
  return zonedMidnight(`${year}-${pad(month + 1)}-01`, timeZone);
}

export function civilWeekday(ymd: string): number {
  return new Date(`${ymd}T12:00:00.000Z`).getUTCDay();
}

export function civilDaysInclusive(fromYmd: string, lastYmd: string): number {
  const [fy, fm, fd] = fromYmd.split('-').map(Number);
  const [ly, lm, ld] = lastYmd.split('-').map(Number);
  const from = Date.UTC(fy, fm - 1, fd);
  const last = Date.UTC(ly, lm - 1, ld);
  return Math.round((last - from) / 86_400_000) + 1;
}
