'use client';

import { AnimatedCounter } from '@/components/landing/animated-counter';
import { Reveal, RevealGroup, RevealItem } from '@/components/landing/reveal';

const metrics = [
  {
    value: 32,
    suffix: '%',
    label: 'mais clientes voltando',
    note: '[DADO A CONFIRMAR]',
  },
  {
    value: 2.4,
    decimals: 1,
    suffix: '×',
    label: 'mais rápido entre visitas',
    note: '[DADO A CONFIRMAR]',
  },
  {
    value: 18,
    suffix: '%',
    label: 'a mais no ticket médio',
    note: '[DADO A CONFIRMAR]',
  },
];

const quotes = [
  {
    quote:
      'Antes a pessoa vinha e sumia. Agora a gente conversa no WhatsApp e vê as mesmas caras toda semana. Isso mudou o movimento da loja.',
    name: '[NOME A CONFIRMAR]',
    role: 'Dona · [ESTABELECIMENTO]',
  },
  {
    quote:
      'Não é cartãozinho. É o cliente sentir que a loja lembra dele. A segunda visita passou a acontecer — e a terceira também.',
    name: '[NOME A CONFIRMAR]',
    role: 'Gerente · [ESTABELECIMENTO]',
  },
];

export function LandingSocialProof() {
  return (
    <section
      id="resultados"
      className="mx-auto max-w-6xl px-5 py-20 sm:px-8 sm:py-28"
      aria-labelledby="resultados-heading"
    >
      <Reveal>
        <p className="text-[12px] font-semibold uppercase tracking-[0.06em] text-[var(--color-primary-500)]">
          O que muda na prática
        </p>
        <h2
          id="resultados-heading"
          className="mt-3 max-w-2xl text-[28px] font-semibold tracking-[-0.03em] text-[var(--color-ink)] sm:text-[36px]"
        >
          Quando o cliente vira freguês, o caixa sente.
        </h2>
        <p className="mt-4 max-w-xl text-[16px] leading-relaxed text-[var(--color-neutral-500)]">
          Frequência, ticket e valor no tempo. É isso que um relacionamento
          bem cuidado entrega — não um cartão esquecido na carteira.
        </p>
      </Reveal>

      <RevealGroup className="mt-12 grid gap-6 sm:grid-cols-3">
        {metrics.map((m) => (
          <RevealItem key={m.label}>
            <div className="border-l-2 border-[var(--color-primary-500)] pl-5">
              <p className="text-[40px] font-semibold tracking-[-0.04em] text-[var(--color-ink)] sm:text-[48px]">
                <AnimatedCounter
                  value={m.value}
                  decimals={m.decimals}
                  suffix={m.suffix}
                  prefix="+"
                />
              </p>
              <p className="mt-1 text-[15px] font-medium text-[var(--color-ink)]">
                {m.label}
              </p>
              <p className="mt-1 text-[12px] text-[var(--color-neutral-400)]">
                {m.note}
              </p>
            </div>
          </RevealItem>
        ))}
      </RevealGroup>

      <RevealGroup className="mt-16 grid gap-8 lg:grid-cols-2">
        {quotes.map((q) => (
          <RevealItem key={q.quote}>
            <blockquote className="border-t border-[var(--color-hairline)] pt-8">
              <p className="text-[18px] leading-relaxed tracking-[-0.01em] text-[var(--color-ink)] sm:text-[20px]">
                “{q.quote}”
              </p>
              <footer className="mt-5">
                <p className="text-[14px] font-semibold text-[var(--color-ink)]">
                  {q.name}
                </p>
                <p className="text-[13px] text-[var(--color-neutral-500)]">
                  {q.role}
                </p>
              </footer>
            </blockquote>
          </RevealItem>
        ))}
      </RevealGroup>
    </section>
  );
}
