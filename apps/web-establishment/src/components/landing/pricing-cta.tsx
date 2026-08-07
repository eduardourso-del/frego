'use client';

import Link from 'next/link';
import { Reveal } from '@/components/landing/reveal';

export function LandingPricingCta() {
  return (
    <section
      id="comecar"
      className="mx-auto max-w-6xl px-5 py-20 sm:px-8 sm:py-28"
      aria-labelledby="cta-heading"
    >
      <Reveal>
        <div
          className="relative overflow-hidden rounded-[24px] px-6 py-14 text-center sm:px-12 sm:py-16"
          style={{
            background:
              'linear-gradient(145deg, var(--color-primary-600) 0%, var(--color-primary-800) 100%)',
          }}
        >
          <div
            className="pointer-events-none absolute -right-20 -top-20 h-64 w-64 rounded-full bg-white/10 blur-2xl"
            aria-hidden
          />
          <p className="text-[12px] font-semibold uppercase tracking-[0.06em] text-white/70">
            Nossa north star
          </p>
          <h2
            id="cta-heading"
            className="mx-auto mt-3 max-w-xl text-[28px] font-semibold tracking-[-0.03em] text-white sm:text-[36px]"
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
              className="inline-flex min-h-12 w-full items-center justify-center rounded-[14px] bg-white px-6 text-[15px] font-semibold text-[var(--color-primary-800)] transition-[transform,opacity] hover:opacity-95 active:scale-[0.98] sm:w-auto"
            >
              Quero criar fregueses
            </Link>
            <Link
              href="/login"
              className="inline-flex min-h-12 w-full items-center justify-center rounded-[14px] border border-white/30 px-6 text-[15px] font-semibold text-white transition-colors hover:bg-white/10 sm:w-auto"
            >
              Já tenho conta — entrar
            </Link>
          </div>
          <p className="mt-6 text-[12px] text-white/55">
            Planos: [DADO A CONFIRMAR] · Sem comissão escondida por venda
          </p>
        </div>
      </Reveal>
    </section>
  );
}
