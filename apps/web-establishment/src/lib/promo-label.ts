export const WEEKDAY_LABELS = [
  'Dom',
  'Seg',
  'Ter',
  'Qua',
  'Qui',
  'Sex',
  'Sáb',
] as const;

export const PROMO_PERIOD_LABEL: Record<string, string> = {
  day: 'por dia',
  week: 'por semana',
  month: 'por mês',
  year: 'por ano',
  campaign: 'nesta campanha',
};

const MONTHS_SHORT = [
  'jan',
  'fev',
  'mar',
  'abr',
  'mai',
  'jun',
  'jul',
  'ago',
  'set',
  'out',
  'nov',
  'dez',
] as const;

export function ymdLabel(value: string | Date | null | undefined): string | null {
  if (!value) return null;
  const s = typeof value === 'string' ? value.slice(0, 10) : value.toISOString().slice(0, 10);
  const [y, m, d] = s.split('-');
  if (!y || !m || !d) return null;
  return `${d}/${m}/${y}`;
}

export function ymdShortLabel(value: string | Date | null | undefined): string | null {
  if (!value) return null;
  const s = typeof value === 'string' ? value.slice(0, 10) : value.toISOString().slice(0, 10);
  const [y, m, d] = s.split('-');
  const month = Number(m);
  const day = Number(d);
  if (!y || month < 1 || month > 12 || !day) return null;
  const stamp = `${day} ${MONTHS_SHORT[month - 1]}`;
  const year = Number(y);
  return year === new Date().getFullYear() ? stamp : `${stamp} ${year}`;
}

/** Customer-facing end date. Start is a lock reason, not a range on the card. */
export function promoEndsLine(endsOn?: string | Date | null): string | null {
  const to = ymdShortLabel(endsOn);
  return to ? `Válida até ${to}` : null;
}

/** Empty or all seven days = any day of the week. */
export function promoWeekdays(weekdays?: number[] | null): number[] {
  const days = [...new Set((weekdays ?? []).filter((d) => d >= 0 && d <= 6))].sort(
    (a, b) => a - b,
  );
  return days;
}

export function promoRestrictsWeekdays(weekdays?: number[] | null): boolean {
  const days = promoWeekdays(weekdays);
  return days.length > 0 && days.length < 7;
}

export function promoWeekdaysLabel(weekdays?: number[] | null): string {
  const days = promoWeekdays(weekdays);
  if (!promoRestrictsWeekdays(days)) return 'Todos os dias';
  return days.map((d) => WEEKDAY_LABELS[d]).join(', ');
}

export function promoFrequencyHint(input: {
  redeemMax?: number | null;
  redeemPeriod?: string | null;
}): string {
  if (input.redeemMax == null) return 'Sem limite de resgates';
  const n = input.redeemMax;
  const period = PROMO_PERIOD_LABEL[input.redeemPeriod ?? 'campaign'] ?? 'nesta campanha';
  return `${n} resgate${n === 1 ? '' : 's'} ${period}`;
}

export function promoHint(input: {
  redeemMax?: number | null;
  redeemPeriod?: string | null;
  startsOn?: string | Date | null;
  endsOn?: string | Date | null;
  weekdays?: number[] | null;
}): string {
  const bits = [promoFrequencyHint(input)];
  const ends = promoEndsLine(input.endsOn);
  if (ends) bits.push(ends);
  if (promoRestrictsWeekdays(input.weekdays)) {
    bits.push(promoWeekdaysLabel(input.weekdays));
  }
  return bits.join(' · ');
}
