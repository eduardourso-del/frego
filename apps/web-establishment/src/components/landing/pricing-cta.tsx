'use client';

import Link from 'next/link';
import { Reveal } from '@/components/landing/reveal';

export function LandingPricingCta() {
  return (
    <section
      id="comecar"
      className="px-5 py-14 sm:px-8 sm:py-20"
      aria-labelledby="cta-heading"
    >
      <Reveal className="mx-auto w-full max-w-6xl">
        <div
          className="relative w-full overflow-hidden rounded-[24px] px-6 py-14 text-center sm:px-12 sm:py-16"
          style={{ background: 'var(--color-primary-800)' }}
        >
          <div
            className="pointer-events-none absolute -right-20 -top-20 h-64 w-64 rounded-full bg-white/10 blur-2xl"
            aria-hidden
          />
          <p className="text-[12px] font-semibold uppercase tracking-[0.08em] text-white/70">
            O que nos guia
          </p>
          <h2
            id="cta-heading"
            className="mx-auto mt-4 max-w-xl text-[28px] font-extrabold leading-[1.22] tracking-[-0.03em] text-white sm:text-[36px]"
          >
            Todo cliente merece virar freguês.
          </h2>
          <p className="mx-auto mt-4 max-w-md text-[15px] leading-relaxed text-white/75">
            Cadastre seu negócio e comece a construir relacionamentos que fazem
            a pessoa voltar. Sem taxa por pedido — só o plano da plataforma.
          </p>
          <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <Link
              href="/register"
              className="inline-flex min-h-11 w-full items-center justify-center rounded-[8px] bg-[var(--color-card)] px-5 text-[14px] font-extrabold text-[var(--color-primary-800)] transition-[transform,opacity] hover:opacity-95 active:scale-[0.98] sm:w-auto"
            >
              Quero criar fregueses
            </Link>
            <Link
              href="/login"
              className="inline-flex min-h-11 w-full items-center justify-center rounded-[8px] border border-[color-mix(in_srgb,white_35%,transparent)] px-5 text-[14px] font-extrabold text-white transition-colors hover:bg-white/10 sm:w-auto"
            >
              Já tenho conta
            </Link>
          </div>
        </div>
      </Reveal>
    </section>
  );
}
