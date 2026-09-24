'use client';

import { useEffect, useState, type ReactNode } from 'react';
import { Undo2, X } from 'lucide-react';

const STICKY_TONE_CLASS = {
  primary: 'bg-[var(--color-primary-500)] shadow-[var(--shadow-cta)]',
  stamps:
    'bg-[var(--color-stamps)] shadow-[0_8px_18px_-10px_rgba(109,40,217,0.55)]',
  points:
    'bg-[var(--color-points)] shadow-[0_8px_18px_-10px_rgba(180,83,9,0.55)]',
  cashback:
    'bg-[var(--color-cashback)] shadow-[0_8px_18px_-10px_rgba(15,118,110,0.55)]',
} as const;

export type StickyTone = keyof typeof STICKY_TONE_CLASS;

export function StickyActionBar({
  label,
  disabled,
  onClick,
  undoLabel,
  onUndo,
  undoBusy,
  tone = 'primary',
  secondaryLabel,
  onSecondary,
}: {
  label: string;
  disabled?: boolean;
  onClick: () => void;
  undoLabel?: string | null;
  onUndo?: () => void;
  undoBusy?: boolean;
  tone?: StickyTone;
  secondaryLabel?: string;
  onSecondary?: () => void;
}) {
  const keyboardInset = useKeyboardInset();
  return (
    <div
      className="pointer-events-none fixed inset-x-0 bottom-[calc(5.5rem+env(safe-area-inset-bottom))] z-40 px-4 md:bottom-6 md:left-[var(--app-sidebar-w)]"
      style={keyboardInset > 0 ? { bottom: keyboardInset } : undefined}
    >
      <div className="pointer-events-auto mx-auto w-full max-w-lg rounded-[16px] border border-[var(--color-hairline)] bg-[var(--color-card)] p-3 shadow-[var(--shadow-raised)]">
        {undoLabel ? (
          <div className="mb-2 flex items-center gap-2">
            <p className="min-w-0 flex-1 truncate text-[12px] font-semibold text-[var(--color-neutral-500)]">
              {undoLabel}
            </p>
            <button
              type="button"
              disabled={undoBusy}
              onClick={onUndo}
              className="inline-flex min-h-11 shrink-0 items-center gap-1.5 rounded-[10px] px-2.5 text-[13px] font-semibold text-[var(--color-neutral-600)]"
            >
              <Undo2 size={15} strokeWidth={2.25} aria-hidden />
              {undoBusy ? '…' : 'Desfazer'}
            </button>
          </div>
        ) : null}
        <div className="flex items-stretch gap-2">
          {secondaryLabel && onSecondary ? (
            <button
              type="button"
              onClick={onSecondary}
              className="inline-flex min-h-[52px] w-[38%] shrink-0 items-center justify-center rounded-[12px] border border-[var(--color-neutral-300)] bg-[var(--color-bg)] px-2 text-center text-[14px] font-semibold leading-tight text-[var(--color-ink)]"
            >
              {secondaryLabel}
            </button>
          ) : null}
          <button
            type="button"
            disabled={disabled}
            onClick={onClick}
            className={`min-h-[52px] min-w-0 flex-1 rounded-[12px] px-3 text-[16px] font-extrabold text-white disabled:bg-[var(--color-neutral-100)] disabled:text-[var(--color-neutral-400)] disabled:shadow-none ${STICKY_TONE_CLASS[tone]}`}
          >
            {label}
          </button>
        </div>
      </div>
    </div>
  );
}

/** Distance from the layout bottom to the top of the on-screen keyboard. */
function useKeyboardInset() {
  const [inset, setInset] = useState(0);

  useEffect(() => {
    const viewport = window.visualViewport;
    if (!viewport) return;

    const update = () => {
      const overlap = Math.max(
        0,
        window.innerHeight - viewport.height - viewport.offsetTop,
      );
      setInset(overlap > 80 ? overlap : 0);
    };

    update();
    viewport.addEventListener('resize', update);
    viewport.addEventListener('scroll', update);
    return () => {
      viewport.removeEventListener('resize', update);
      viewport.removeEventListener('scroll', update);
    };
  }, []);

  return inset;
}

export function CounterSheet({
  title,
  subtitle,
  children,
  onClose,
}: {
  title: string;
  subtitle?: string;
  children: ReactNode;
  onClose: () => void;
}) {
  return (
    <div
      className="fixed inset-0 z-[60] flex items-end justify-center bg-black/40 px-4 pb-[calc(13.5rem+env(safe-area-inset-bottom))] md:left-[var(--app-sidebar-w)] md:items-center md:pb-0"
      role="dialog"
      aria-modal="true"
      aria-labelledby="counter-sheet-title"
      onClick={onClose}
    >
      <div
        className="flex max-h-[85dvh] w-full max-w-lg flex-col overflow-hidden rounded-[22px] bg-[var(--color-card)] shadow-[var(--shadow-raised)]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex shrink-0 items-start justify-between gap-3 px-5 pt-5">
          <div className="min-w-0">
            <p
              id="counter-sheet-title"
              className="text-[18px] font-semibold text-[var(--color-ink)]"
            >
              {title}
            </p>
            {subtitle ? (
              <p className="mt-1 text-[13px] text-[var(--color-neutral-500)]">
                {subtitle}
              </p>
            ) : null}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-[var(--color-bg)] text-[var(--color-neutral-600)]"
            aria-label="Fechar"
          >
            <X size={18} />
          </button>
        </div>
        <div className="min-h-0 overflow-y-auto px-5 pt-4 pb-[max(1.25rem,env(safe-area-inset-bottom))]">
          {children}
        </div>
      </div>
    </div>
  );
}
