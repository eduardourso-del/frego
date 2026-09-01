'use client';

import {
  BUSINESS_TYPE_GROUPS,
  BUSINESS_TYPES,
  businessTypeLabel,
} from '@frego/tokens';

const chipClass = (active: boolean) =>
  `min-h-9 rounded-full px-3.5 text-[13px] font-semibold transition-colors ${
    active
      ? 'bg-[var(--color-primary-500)] text-white'
      : 'bg-[var(--color-bg)] text-[var(--color-neutral-600)] ring-1 ring-[var(--color-hairline)]'
  }`;

export function BusinessTypePicker({
  value,
  onChange,
}: {
  value: string;
  onChange: (value: string) => void;
}) {
  const known = BUSINESS_TYPES.some((t) => t.value === value);

  return (
    <fieldset>
      <legend className="text-[13px] font-semibold uppercase tracking-[0.04em]">
        Tipo
      </legend>
      <div className="mt-3 flex flex-col gap-4">
        {BUSINESS_TYPE_GROUPS.map((group) => {
          const types = BUSINESS_TYPES.filter((t) => t.group === group.id);
          return (
            <div key={group.id}>
              <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.06em] text-[var(--color-neutral-400)]">
                {group.label}
              </p>
              <div className="flex flex-wrap gap-2">
                {types.map((t) => (
                  <button
                    key={t.value}
                    type="button"
                    onClick={() => onChange(t.value)}
                    className={chipClass(value === t.value)}
                  >
                    {t.label}
                  </button>
                ))}
              </div>
            </div>
          );
        })}
        {value && !known ? (
          <span className={chipClass(true)}>{businessTypeLabel(value)}</span>
        ) : null}
      </div>
    </fieldset>
  );
}
