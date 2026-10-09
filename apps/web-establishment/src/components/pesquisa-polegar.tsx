'use client';

import { ThumbsDown, ThumbsUp } from 'lucide-react';

export function PolegarChoice({
  value,
  onChange,
}: {
  value?: 'up' | 'down';
  onChange: (next: 'up' | 'down') => void;
}) {
  return (
    <div className="mt-3 flex gap-2">
      <PolegarButton
        label="Para cima"
        tone="up"
        selected={value === 'up'}
        onClick={() => onChange('up')}
      />
      <PolegarButton
        label="Para baixo"
        tone="down"
        selected={value === 'down'}
        onClick={() => onChange('down')}
      />
    </div>
  );
}

function PolegarButton({
  label,
  tone,
  selected,
  onClick,
}: {
  label: string;
  tone: 'up' | 'down';
  selected: boolean;
  onClick: () => void;
}) {
  const up = tone === 'up';
  const Icon = up ? ThumbsUp : ThumbsDown;
  const idle = up
    ? 'border-[var(--color-success)] bg-[var(--color-success-bg)] text-[var(--color-success)]'
    : 'border-[var(--color-danger)] bg-[var(--color-danger-bg)] text-[var(--color-danger)]';
  const on = up
    ? 'border-[var(--color-success-fill)] bg-[var(--color-success-fill)] text-white shadow-[0_6px_14px_rgba(56,97,67,0.28)]'
    : 'border-[var(--color-danger-fill)] bg-[var(--color-danger-fill)] text-white shadow-[0_6px_14px_rgba(150,61,34,0.28)]';

  return (
    <button
      type="button"
      aria-label={label}
      aria-pressed={selected}
      onClick={onClick}
      className={`flex min-h-14 flex-1 items-center justify-center rounded-[16px] border-2 transition active:scale-[0.97] ${
        selected ? on : idle
      }`}
    >
      <Icon
        size={28}
        strokeWidth={2.25}
        fill={selected ? 'currentColor' : 'none'}
        aria-hidden
      />
    </button>
  );
}
