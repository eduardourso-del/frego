'use client';

import { Info } from 'lucide-react';
import {
  useEffect,
  useId,
  useRef,
  useState,
  type ReactNode,
} from 'react';

function cx(...parts: Array<string | false | null | undefined>) {
  return parts.filter(Boolean).join(' ');
}

export function TermInfo({
  children,
  info,
  align = 'center',
  className,
}: {
  children?: ReactNode;
  info: string;
  align?: 'center' | 'end' | 'start';
  className?: string;
}) {
  const tooltipId = useId();
  const rootRef = useRef<HTMLSpanElement>(null);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    function onPointerDown(e: PointerEvent) {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false);
    }
    document.addEventListener('pointerdown', onPointerDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('pointerdown', onPointerDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  return (
    <span
      ref={rootRef}
      className={cx('relative inline-flex max-w-full items-center gap-1', className)}
    >
      {children}
      <button
        type="button"
        aria-label="O que significa"
        aria-expanded={open}
        aria-describedby={open ? tooltipId : undefined}
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          setOpen((v) => !v);
        }}
        onPointerDown={(e) => e.stopPropagation()}
        className="inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[var(--color-neutral-400)] transition-colors hover:bg-[var(--color-neutral-100)] hover:text-[var(--color-ink)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary-500)]"
      >
        <Info size={13} strokeWidth={2.25} aria-hidden />
      </button>
      {open && (
        <span
          id={tooltipId}
          role="tooltip"
          className={cx(
            'absolute top-[calc(100%+6px)] z-40 w-[min(240px,calc(100vw-2rem))] rounded-[10px] border border-[var(--color-hairline)] bg-[var(--color-card)] p-2.5 text-left text-[12px] font-medium leading-snug text-[var(--color-neutral-600)] shadow-[var(--shadow-card)]',
            align === 'end' && 'right-0',
            align === 'start' && 'left-0',
            align === 'center' && 'left-1/2 -translate-x-1/2',
          )}
          onClick={(e) => e.stopPropagation()}
        >
          {info}
        </span>
      )}
    </span>
  );
}
