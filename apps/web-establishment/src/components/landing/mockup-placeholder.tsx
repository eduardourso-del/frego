'use client';

import type { ReactNode } from 'react';

/**
 * Visual stand-in until real product screenshots ship.
 * Replace `children` (or the whole block) with an optimized <Image>.
 */
export function MockupPlaceholder({
  label,
  caption,
  children,
  className,
}: {
  label: string;
  caption?: string;
  children?: ReactNode;
  className?: string;
}) {
  return (
    <figure className={className}>
      <div className="relative overflow-hidden rounded-[20px] border border-[var(--color-hairline)] bg-[var(--color-card)] shadow-[var(--shadow-raised)]">
        <div className="flex items-center gap-1.5 border-b border-[var(--color-hairline)] bg-[var(--color-neutral-100)] px-4 py-2.5">
          <span className="h-2.5 w-2.5 rounded-full bg-[var(--color-neutral-200)]" />
          <span className="h-2.5 w-2.5 rounded-full bg-[var(--color-neutral-200)]" />
          <span className="h-2.5 w-2.5 rounded-full bg-[var(--color-neutral-200)]" />
          <span className="ml-3 truncate text-[11px] font-medium text-[var(--color-neutral-400)]">
            {label}
          </span>
        </div>
        <div className="relative min-h-[220px] bg-[var(--color-bg)] p-4 sm:min-h-[280px] sm:p-5">
          {children ?? (
            <div className="flex h-full min-h-[200px] flex-col items-center justify-center gap-2 text-center">
              <p className="text-[13px] font-semibold uppercase tracking-[0.04em] text-[var(--color-neutral-400)]">
                [MOCKUP]
              </p>
              <p className="max-w-xs text-[14px] text-[var(--color-neutral-500)]">
                Substitua por screenshot real do produto
              </p>
            </div>
          )}
          <div
            className="pointer-events-none absolute inset-x-0 bottom-0 bg-gradient-to-t from-[var(--color-primary-50)]/40 to-transparent py-2 text-center"
            aria-hidden
          >
            <span className="inline-block rounded-full bg-[var(--color-ink)]/80 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.06em] text-white">
              Placeholder visual
            </span>
          </div>
        </div>
      </div>
      {caption ? (
        <figcaption className="mt-3 text-center text-[13px] text-[var(--color-neutral-500)]">
          {caption}
        </figcaption>
      ) : null}
    </figure>
  );
}

/** Composed UI sketch of the establishment dashboard. */
export function DashboardSketch() {
  return (
    <div className="space-y-3" aria-hidden>
      <div className="flex items-end justify-between gap-3">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.04em] text-[var(--color-neutral-400)]">
            Hoje
          </p>
          <p className="text-[22px] font-semibold tracking-[-0.02em] text-[var(--color-ink)]">
            Bom dia, Ana
          </p>
        </div>
        <span className="rounded-full bg-[var(--color-success-bg)] px-2.5 py-1 text-[11px] font-semibold text-[var(--color-success)]">
          Ao vivo
        </span>
      </div>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {[
          { label: 'Fregueses', value: '48' },
          { label: 'Voltas', value: '126' },
          { label: 'Conversas', value: '19' },
          { label: 'Recorrência', value: '38%' },
        ].map((kpi) => (
          <div
            key={kpi.label}
            className="rounded-[14px] border border-[var(--color-hairline)] bg-[var(--color-card)] p-3"
          >
            <p className="text-[11px] text-[var(--color-neutral-500)]">
              {kpi.label}
            </p>
            <p className="mt-1 text-[20px] font-semibold tracking-[-0.02em]">
              {kpi.value}
            </p>
          </div>
        ))}
      </div>
      <div className="rounded-[14px] border border-[var(--color-hairline)] bg-[var(--color-card)] p-3">
        <p className="mb-3 text-[12px] font-semibold text-[var(--color-neutral-500)]">
          Visitas nesta semana
        </p>
        <div className="flex h-24 items-end gap-1.5">
          {[40, 65, 48, 82, 70, 95, 58].map((h, i) => (
            <div key={i} className="flex flex-1 flex-col items-center gap-1">
              <div
                className="w-full rounded-t-[6px] bg-[var(--color-primary-500)]"
                style={{ height: `${h}%` }}
              />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/** Composed UI sketch of a loyalty / stamp card + WhatsApp nudge. */
export function LoyaltySketch() {
  return (
    <div className="grid gap-3 sm:grid-cols-[1.2fr_1fr]" aria-hidden>
      <div
        className="rounded-[18px] p-4 text-white"
        style={{
          background:
            'linear-gradient(145deg, var(--color-primary-500), var(--color-primary-800))',
        }}
      >
        <p className="text-[12px] font-medium text-white/75">Seu freguês</p>
        <p className="mt-1 text-[18px] font-semibold">Marina · volta toda semana</p>
        <p className="mt-4 text-[28px] font-semibold tracking-[-0.03em]">
          12 visitas
        </p>
        <p className="mt-1 text-[13px] text-white/75">Última vez: ontem</p>
        <div className="mt-3 flex gap-1.5">
          {Array.from({ length: 8 }).map((_, i) => (
            <span
              key={i}
              className={`h-2.5 flex-1 rounded-full ${
                i < 6 ? 'bg-white' : 'bg-white/25'
              }`}
            />
          ))}
        </div>
      </div>
      <div className="rounded-[18px] border border-[var(--color-hairline)] bg-[var(--color-card)] p-4">
        <p className="text-[11px] font-semibold uppercase tracking-[0.04em] text-[var(--color-neutral-400)]">
          WhatsApp · automático
        </p>
        <div className="mt-3 rounded-[14px] bg-[#E7F8EF] p-3 text-[13px] leading-relaxed text-[var(--color-ink)]">
          Oi Marina! Faz uma semana que você não passa aqui. Separamos uma
          mesa pra você hoje à noite?
        </div>
        <p className="mt-2 text-[11px] text-[var(--color-neutral-400)]">
          Enviado · há 2h
        </p>
      </div>
    </div>
  );
}
