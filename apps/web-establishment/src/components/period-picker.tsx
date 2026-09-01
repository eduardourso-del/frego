'use client';

import { CalendarDays } from 'lucide-react';

export type PeriodValue =
  | { mode: 'preset'; key: string }
  | { mode: 'custom'; from: string; to: string };

function pad(n: number) {
  return String(n).padStart(2, '0');
}

export function formatLocalDay(d: Date) {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function todayIso() {
  return formatLocalDay(new Date());
}

export function daysAgoIso(days: number) {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return formatLocalDay(d);
}

export function minPeriodIso() {
  return daysAgoIso(365);
}

function formatShortRange(from: string, to: string) {
  const f = new Date(`${from}T12:00:00`);
  const t = new Date(`${to}T12:00:00`);
  if (Number.isNaN(f.getTime()) || Number.isNaN(t.getTime())) {
    return 'Personalizado';
  }
  const month = (d: Date) =>
    d.toLocaleDateString('pt-BR', { month: 'short' }).replace('.', '');
  if (from === to) {
    return t.toLocaleDateString('pt-BR', { day: 'numeric', month: 'short' });
  }
  if (f.getMonth() === t.getMonth() && f.getFullYear() === t.getFullYear()) {
    return `${f.getDate()}–${t.getDate()} ${month(t)}`;
  }
  return `${f.getDate()} ${month(f)} – ${t.getDate()} ${month(t)}`;
}

export function periodSearchParams(value: PeriodValue) {
  if (value.mode === 'custom') {
    return `from=${value.from}&to=${value.to}`;
  }
  return `range=${value.key}`;
}

const dateInputClass =
  'min-h-9 rounded-[10px] border border-[var(--color-neutral-200)] bg-[var(--color-card)] px-2.5 text-[13px] font-semibold text-[var(--color-ink)] outline-none focus:border-[var(--color-primary-500)]';

export function PeriodPicker({
  presets,
  value,
  onChange,
  ariaLabel = 'Período',
  compact = false,
}: {
  presets: Array<{ key: string; label: string }>;
  value: PeriodValue;
  onChange: (value: PeriodValue) => void;
  ariaLabel?: string;
  compact?: boolean;
}) {
  const custom = value.mode === 'custom';
  const today = todayIso();
  const min = minPeriodIso();

  function openCustom() {
    if (custom) return;
    onChange({ mode: 'custom', from: daysAgoIso(13), to: today });
  }

  function setCustom(next: { from?: string; to?: string }) {
    if (!custom) return;
    let from = next.from ?? value.from;
    let to = next.to ?? value.to;
    if (from > to) {
      if (next.from) to = from;
      else from = to;
    }
    if (from < min) from = min;
    if (to > today) to = today;
    onChange({ mode: 'custom', from, to });
  }

  const pill = compact
    ? 'rounded-[8px] px-2.5 py-1.5 text-[12px] sm:px-3 sm:text-[13px]'
    : 'min-h-9 rounded-[10px] px-3.5 text-[13px]';
  const wrap = compact
    ? 'flex rounded-[10px] border border-[var(--color-neutral-200)] bg-[var(--color-card)] p-0.5'
    : 'flex gap-1 overflow-x-auto rounded-[14px] bg-[var(--color-neutral-100)] p-1';
  const activePill = compact
    ? 'bg-[var(--color-bg)] text-[var(--color-ink)]'
    : 'bg-[var(--color-card)] text-[var(--color-ink)] shadow-[0_1px_3px_rgba(16,24,40,0.08)]';

  return (
    <div className="flex flex-col items-stretch gap-2 sm:items-end">
      <div className={wrap} role="group" aria-label={ariaLabel}>
        {presets.map((r) => {
          const active = !custom && value.mode === 'preset' && value.key === r.key;
          return (
            <button
              key={r.key}
              type="button"
              onClick={() => onChange({ mode: 'preset', key: r.key })}
              className={`shrink-0 font-semibold transition-all ${pill} ${
                active
                  ? activePill
                  : 'text-[var(--color-neutral-500)] hover:text-[var(--color-ink)]'
              }`}
            >
              {r.label}
            </button>
          );
        })}
        <button
          type="button"
          onClick={openCustom}
          className={`inline-flex shrink-0 items-center gap-1.5 font-semibold transition-all ${pill} ${
            custom
              ? activePill
              : 'text-[var(--color-neutral-500)] hover:text-[var(--color-ink)]'
          }`}
        >
          <CalendarDays size={14} strokeWidth={2.25} aria-hidden />
          {custom ? formatShortRange(value.from, value.to) : 'Personalizado'}
        </button>
      </div>
      {custom ? (
        <div className="flex flex-wrap items-center justify-end gap-2">
          <label className="flex items-center gap-1.5 text-[12px] text-[var(--color-neutral-500)]">
            De
            <input
              type="date"
              value={value.from}
              min={min}
              max={value.to}
              onChange={(e) => setCustom({ from: e.target.value })}
              className={dateInputClass}
            />
          </label>
          <label className="flex items-center gap-1.5 text-[12px] text-[var(--color-neutral-500)]">
            Até
            <input
              type="date"
              value={value.to}
              min={value.from}
              max={today}
              onChange={(e) => setCustom({ to: e.target.value })}
              className={dateInputClass}
            />
          </label>
        </div>
      ) : null}
    </div>
  );
}
