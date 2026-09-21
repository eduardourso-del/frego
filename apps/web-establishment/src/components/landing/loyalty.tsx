'use client';

import Link from 'next/link';
import { Reveal, RevealGroup, RevealItem } from '@/components/landing/reveal';

const people = [
  {
    name: 'Mariana',
    initial: 'M',
    tag: 'Melhor cliente',
    body: 'Uma das suas melhores clientes. Já passou da hora de voltar.',
  },
  {
    name: 'Carlos',
    initial: 'C',
    tag: 'Benefício',
    body: 'Seu benefício vence em 2 dias.',
  },
  {
    name: 'Fernanda',
    initial: 'F',
    tag: 'Primeira compra',
    body: 'Fez a primeira compra há 35 dias e ainda não voltou.',
  },
  {
    name: 'João',
    initial: 'J',
    tag: 'Quase lá',
    body: 'Está a uma visita de completar seu benefício.',
  },
];

export function LandingLoyalty() {
  return (
    <section
      id="atencao"
      className="border-y border-[var(--color-hairline)] bg-[var(--color-card)]"
      aria-labelledby="atencao-heading"
    >
      <div className="mx-auto grid max-w-6xl gap-10 px-5 py-14 sm:px-8 sm:py-20 lg:grid-cols-[1fr_0.92fr] lg:items-center lg:gap-16">
        <Reveal>
          <p className="text-[12px] font-semibold uppercase tracking-[0.08em] text-[var(--color-primary-500)]">
            O diferencial
          </p>
          <h2
            id="atencao-heading"
            className="mt-4 max-w-xl text-[28px] font-extrabold leading-[1.22] tracking-[-0.03em] text-[var(--color-ink)] sm:text-[36px]"
          >
            Você não precisa de um CRM.
          </h2>
          <p className="mt-4 max-w-lg text-[16px] leading-relaxed text-[var(--color-neutral-500)]">
            CRM, planilhas, relatórios complexos e ferramentas de marketing
            podem ser úteis para grandes empresas. Mas seu negócio precisa de
            algo mais simples: saber quem merece sua atenção hoje.
          </p>
          <p className="mt-6 max-w-lg text-[18px] font-semibold leading-snug tracking-[-0.02em] text-[var(--color-ink)]">
            A Frego faz o trabalho pesado.
            <span className="mt-1 block text-[var(--color-primary-600)]">
              Você recebe respostas.
            </span>
          </p>
          <Link
            href="/register"
            className="mt-8 inline-flex min-h-11 items-center justify-center rounded-[8px] bg-[var(--color-primary-500)] px-5 text-[14px] font-extrabold text-[var(--color-on-primary)] transition-[transform,background] hover:bg-[var(--color-primary-600)] active:scale-[0.98]"
          >
            Quero conhecer meus clientes
          </Link>
        </Reveal>

        <Reveal delay={0.08}>
          <div className="overflow-hidden rounded-[20px] border border-[var(--color-hairline)] bg-[var(--color-bg)] shadow-[var(--shadow-card)]">
            <div className="flex items-end justify-between gap-3 border-b border-[var(--color-hairline)] px-5 py-4">
              <div>
                <p className="text-[12px] font-semibold uppercase tracking-[0.08em] text-[var(--color-primary-500)]">
                  Hoje
                </p>
                <p className="mt-1 text-[18px] font-extrabold tracking-[-0.02em] text-[var(--color-ink)]">
                  7 clientes merecem sua atenção.
                </p>
              </div>
              <p className="shrink-0 text-[11px] font-semibold uppercase tracking-[0.06em] text-[var(--color-neutral-400)]">
                Exemplo ilustrativo
              </p>
            </div>
            <RevealGroup className="divide-y divide-[var(--color-hairline)]">
              {people.map((p) => (
                <RevealItem key={p.name}>
                  <article className="flex gap-3.5 px-5 py-4">
                    <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[var(--color-primary-50)] text-[13px] font-extrabold text-[var(--color-primary-600)]">
                      {p.initial}
                    </span>
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
                        <h3 className="text-[15px] font-semibold text-[var(--color-ink)]">
                          {p.name}
                        </h3>
                        <span className="text-[11px] font-semibold uppercase tracking-[0.06em] text-[var(--color-neutral-400)]">
                          {p.tag}
                        </span>
                      </div>
                      <p className="mt-1 text-[13px] leading-relaxed text-[var(--color-neutral-500)]">
                        {p.body}
                      </p>
                    </div>
                  </article>
                </RevealItem>
              ))}
            </RevealGroup>
          </div>
        </Reveal>
      </div>
    </section>
  );
}
