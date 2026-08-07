'use client';

import Link from 'next/link';
import type {
  ButtonHTMLAttributes,
  InputHTMLAttributes,
  ReactNode,
  SelectHTMLAttributes,
  TextareaHTMLAttributes,
} from 'react';

const cx = (...parts: Array<string | false | null | undefined>) =>
  parts.filter(Boolean).join(' ');

/** Primary / secondary / ghost / danger buttons — one language across the app. */
export function Button({
  variant = 'primary',
  className,
  children,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger' | 'ink';
}) {
  const base =
    'inline-flex min-h-11 items-center justify-center gap-2 rounded-[12px] px-4 text-[14px] font-semibold transition-[transform,background,box-shadow,opacity] duration-150 enabled:active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-55';
  const variants = {
    primary:
      'bg-[var(--color-primary-500)] text-white shadow-[var(--shadow-cta)] hover:bg-[var(--color-primary-600)] disabled:bg-[var(--color-primary-200)] disabled:shadow-none',
    secondary:
      'border border-[var(--color-neutral-200)] bg-[var(--color-card)] text-[var(--color-ink)] hover:bg-[var(--color-bg)]',
    ghost:
      'bg-transparent text-[var(--color-neutral-600)] hover:bg-[var(--color-bg)] hover:text-[var(--color-ink)]',
    danger:
      'bg-[var(--color-danger-bg)] text-[var(--color-danger)] hover:brightness-[0.98]',
    ink: 'bg-[var(--color-ink)] text-white hover:opacity-90',
  } as const;

  return (
    <button
      type="button"
      className={cx(base, variants[variant], className)}
      {...props}
    >
      {children}
    </button>
  );
}

export function Card({
  children,
  className,
  padding = 'md',
}: {
  children: ReactNode;
  className?: string;
  padding?: 'sm' | 'md' | 'lg' | 'none';
}) {
  const pads = {
    none: '',
    sm: 'p-4',
    md: 'p-5',
    lg: 'p-6',
  } as const;
  return (
    <div
      className={cx(
        'rounded-[16px] border border-[var(--color-hairline)] bg-[var(--color-card)] shadow-[var(--shadow-card)]',
        pads[padding],
        className,
      )}
    >
      {children}
    </div>
  );
}

export function PageHeader({
  title,
  description,
  action,
  className,
}: {
  title: string;
  description?: string;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <header
      className={cx(
        'mb-6 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between',
        className,
      )}
    >
      <div className="min-w-0">
        <h1 className="text-[26px] font-semibold tracking-[-0.03em] text-[var(--color-ink)] md:text-[28px]">
          {title}
        </h1>
        {description ? (
          <p className="mt-1.5 max-w-xl text-[14px] leading-relaxed text-[var(--color-neutral-500)] md:text-[15px]">
            {description}
          </p>
        ) : null}
      </div>
      {action ? <div className="flex shrink-0 flex-wrap gap-2">{action}</div> : null}
    </header>
  );
}

export function SegmentedControl<T extends string>({
  value,
  options,
  onChange,
  ariaLabel,
  className,
}: {
  value: T;
  options: Array<{ value: T; label: string; icon?: ReactNode }>;
  onChange: (value: T) => void;
  ariaLabel: string;
  className?: string;
}) {
  return (
    <div
      className={cx(
        'flex gap-1 overflow-x-auto rounded-[14px] bg-[var(--color-neutral-100)] p-1',
        className,
      )}
      role="group"
      aria-label={ariaLabel}
    >
      {options.map((opt) => {
        const active = value === opt.value;
        return (
          <button
            key={opt.value}
            type="button"
            onClick={() => onChange(opt.value)}
            className={cx(
              'inline-flex min-h-9 shrink-0 items-center justify-center gap-1.5 rounded-[11px] px-3.5 text-[13px] font-semibold transition-all',
              active
                ? 'bg-[var(--color-card)] text-[var(--color-ink)] shadow-[0_1px_3px_rgba(16,24,40,0.08)]'
                : 'text-[var(--color-neutral-500)] hover:text-[var(--color-ink)]',
            )}
          >
            {opt.icon}
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}

export function FieldLabel({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <span
      className={cx(
        'mb-1.5 block text-[12px] font-semibold uppercase tracking-[0.04em] text-[var(--color-neutral-500)]',
        className,
      )}
    >
      {children}
    </span>
  );
}

const controlClass =
  'min-h-11 w-full rounded-[12px] border border-[var(--color-neutral-200)] bg-[var(--color-bg)] px-3.5 text-[16px] text-[var(--color-ink)] outline-none transition-[border,box-shadow] placeholder:text-[var(--color-neutral-400)] focus:border-[var(--color-primary-500)] focus:shadow-[var(--shadow-focus)]';

export function TextField({
  label,
  className,
  ...props
}: InputHTMLAttributes<HTMLInputElement> & { label?: string }) {
  return (
    <label className="block">
      {label ? <FieldLabel>{label}</FieldLabel> : null}
      <input className={cx(controlClass, className)} {...props} />
    </label>
  );
}

export function SelectField({
  label,
  className,
  children,
  ...props
}: SelectHTMLAttributes<HTMLSelectElement> & {
  label?: string;
  children: ReactNode;
}) {
  return (
    <label className="block">
      {label ? <FieldLabel>{label}</FieldLabel> : null}
      <select className={cx(controlClass, className)} {...props}>
        {children}
      </select>
    </label>
  );
}

export function TextAreaField({
  label,
  className,
  ...props
}: TextareaHTMLAttributes<HTMLTextAreaElement> & { label?: string }) {
  return (
    <label className="block">
      {label ? <FieldLabel>{label}</FieldLabel> : null}
      <textarea
        className={cx(controlClass, 'min-h-24 py-3', className)}
        {...props}
      />
    </label>
  );
}

export function Alert({
  tone = 'danger',
  children,
  action,
}: {
  tone?: 'danger' | 'success' | 'info';
  children: ReactNode;
  action?: ReactNode;
}) {
  const tones = {
    danger:
      'border-[var(--color-danger)]/30 bg-[var(--color-danger-bg)] text-[var(--color-danger)]',
    success:
      'border-[var(--color-success)]/25 bg-[var(--color-success-bg)] text-[var(--color-success)]',
    info: 'border-[var(--color-primary-200)] bg-[var(--color-primary-50)] text-[var(--color-primary-800)]',
  } as const;
  return (
    <div
      className={cx(
        'flex flex-wrap items-start justify-between gap-3 rounded-[14px] border px-4 py-3 text-[14px]',
        tones[tone],
      )}
      role={tone === 'danger' ? 'alert' : 'status'}
    >
      <div className="min-w-0 flex-1">{children}</div>
      {action}
    </div>
  );
}

export function EmptyState({
  title,
  description,
  action,
}: {
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <Card className="border-dashed text-center" padding="lg">
      <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-[14px] bg-[var(--color-primary-50)] text-[var(--color-primary-500)]">
        <span className="text-[18px] font-bold">V</span>
      </div>
      <p className="text-[17px] font-semibold text-[var(--color-ink)]">{title}</p>
      {description ? (
        <p className="mx-auto mt-1.5 max-w-sm text-[14px] leading-relaxed text-[var(--color-neutral-500)]">
          {description}
        </p>
      ) : null}
      {action ? <div className="mt-5 flex justify-center">{action}</div> : null}
    </Card>
  );
}

export function TypeBadge({
  kind,
}: {
  kind: 'stamps' | 'points' | string;
}) {
  const isPoints = kind === 'spend' || kind === 'points';
  return (
    <span
      className={cx(
        'inline-flex items-center rounded-full px-2.5 py-1 text-[11px] font-semibold tracking-[0.02em] ring-1 ring-inset',
        isPoints
          ? 'bg-[var(--color-points-bg)] text-[var(--color-points)] ring-[var(--color-points-ring)]'
          : 'bg-[var(--color-stamps-bg)] text-[var(--color-stamps)] ring-[var(--color-stamps-ring)]',
      )}
    >
      {isPoints ? 'Pontos' : 'Carimbos'}
    </span>
  );
}

export function Skeleton({ className }: { className?: string }) {
  return (
    <div
      className={cx(
        'animate-pulse rounded-[14px] bg-[var(--color-neutral-100)]',
        className,
      )}
    />
  );
}

export function SoftLink({
  href,
  children,
  className,
}: {
  href: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <Link
      href={href}
      className={cx(
        'font-semibold text-[var(--color-primary-500)] hover:text-[var(--color-primary-600)]',
        className,
      )}
    >
      {children}
    </Link>
  );
}
