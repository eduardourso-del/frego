'use client';

import Link from 'next/link';
import { Reveal } from '@/components/landing/reveal';
import { formatPlanPrice, LANDING_PLANS, PLAN_LABEL } from '@/lib/plans';

export function LandingPricingCta() {
  return (
    <section
      id="comecar"
      className="px-5 py-14 sm:px-8 sm:py-20"
      aria-labelledby="planos-heading"
    >
      <Reveal className="mx-auto w-full max-w-6xl">
        <p className="text-center text-[12px] font-semibold uppercase tracking-[0.08em] text-[var(--color-neutral-500)]">
          Planos
        </p>
        <h2
          id="planos-heading"
          className="mx-auto mt-3 max-w-xl text-center font-serif text-[28px] leading-[1.15] tracking-[-0.02em] text-[var(--color-ink)] sm:text-[36px]"
        >
          Sete dias de Enterprise. Depois, o Plano que couber no balcão.
        </h2>
        <p className="mx-auto mt-4 max-w-lg text-center text-[15px] leading-relaxed text-[var(--color-neutral-500)]">
          O teste começa quando o Frego aprova o estabelecimento. Não pedimos
          cartão para começar. A integração não tem custo, e não cobramos taxa
          por pedido nem taxa extra.
        </p>
        <div className="mt-8 grid gap-4 md:grid-cols-3">
          {LANDING_PLANS.map((plan) => (
            <article
              key={plan.tier}
              className="flex flex-col rounded-[20px] border border-[var(--color-hairline)] bg-[var(--color-card)] p-5 shadow-[var(--shadow-card)]"
            >
              <h3 className="text-[15px] font-semibold text-[var(--color-ink)]">
                {PLAN_LABEL[plan.tier]}
              </h3>
              <p className="mt-2 text-[28px] font-semibold tracking-[-0.03em] text-[var(--color-ink)]">
                {formatPlanPrice(plan.priceCents)}
                <span className="text-[14px] font-normal text-[var(--color-neutral-500)]">
                  {' '}
                  /mês
                </span>
              </p>
              <p className="mt-2 text-[14px] leading-relaxed text-[var(--color-neutral-500)]">
                {plan.summary}
              </p>
              <ul className="mt-4 flex flex-1 flex-col gap-2 text-[14px] text-[var(--color-ink)]">
                {plan.points.map((point) => (
                  <li key={point}>{point}</li>
                ))}
              </ul>
              <Link
                href="/register"
                className="mt-6 inline-flex min-h-11 items-center justify-center rounded-[8px] bg-[var(--color-mostarda)] px-5 text-[14px] font-semibold text-[var(--color-grafite)] transition-[transform,opacity] hover:opacity-95 active:scale-[0.98]"
              >
                Começar agora
              </Link>
            </article>
          ))}
        </div>
        <p className="mt-6 text-center">
          <Link
            href="/login"
            className="text-[14px] font-semibold text-[var(--color-ink)] underline-offset-4 hover:underline"
          >
            Já tenho conta
          </Link>
        </p>
      </Reveal>
    </section>
  );
}
