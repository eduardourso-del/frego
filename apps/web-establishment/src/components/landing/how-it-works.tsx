'use client';

import { ArrowDown, ArrowRight } from 'lucide-react';
import { Reveal, RevealGroup, RevealItem } from '@/components/landing/reveal';

const steps = [
  {
    title: 'Cliente compra',
    body: 'A visita no caixa já é o dado. Sem planilha, sem cadastro extra.',
  },
  {
    title: 'Frego entende o comportamento',
    body: 'Quem volta, quem some, quem está perto de um benefício.',
  },
  {
    title: 'Frego encontra oportunidades',
    body: 'O painel aponta quem merece atenção — hoje, não no relatório de sexta.',
  },
  {
    title: 'Você age',
    body: 'Uma mensagem, um convite, um motivo para atravessar a porta de novo.',
  },
  {
    title: 'Cliente volta',
    body: 'Relacionamento vira visita. Visita vira freguês.',
  },
];

export function LandingHowItWorks() {
  return (
    <section
      id="como-funciona"
      className="border-b border-[var(--color-hairline)] bg-[var(--color-card)]"
      aria-labelledby="como-heading"
    >
      <div className="mx-auto max-w-6xl px-5 py-14 sm:px-8 sm:py-20">
        <Reveal>
          <p className="text-[12px] font-semibold uppercase tracking-[0.08em] text-[var(--color-primary-500)]">
            Como funciona
          </p>
          <h2
            id="como-heading"
            className="mt-4 max-w-2xl text-[28px] font-extrabold leading-[1.22] tracking-[-0.03em] text-[var(--color-ink)] sm:text-[36px]"
          >
            Você já tem os dados. A Frego transforma esses dados em ação.
          </h2>
          <p className="mt-4 max-w-xl text-[16px] leading-relaxed text-[var(--color-neutral-500)]">
            Não é outro sistema para aprender. É o caminho da venda até o
            cliente de volta.
          </p>
        </Reveal>

        <RevealGroup className="mt-10 grid gap-0 lg:grid-cols-5 lg:gap-4">
          {steps.map((s, i) => (
            <RevealItem key={s.title} className="relative">
              <article className="h-full rounded-[18px] border border-[var(--color-hairline)] bg-[var(--color-bg)] px-4 py-5 sm:px-4 sm:py-6">
                <p className="font-mono text-[12px] font-semibold tracking-[0.06em] text-[var(--color-primary-500)]">
                  {String(i + 1).padStart(2, '0')}
                </p>
                <h3 className="mt-3 text-[17px] font-semibold leading-snug tracking-[-0.02em] text-[var(--color-ink)]">
                  {s.title}
                </h3>
                <p className="mt-2 text-[13px] leading-relaxed text-[var(--color-neutral-500)]">
                  {s.body}
                </p>
              </article>
              {i < steps.length - 1 ? (
                <>
                  <span
                    className="flex justify-center py-2 text-[var(--color-primary-200)] lg:hidden"
                    aria-hidden
                  >
                    <ArrowDown size={18} strokeWidth={2.25} />
                  </span>
                  <span
                    className="pointer-events-none absolute -right-2.5 top-7 hidden text-[var(--color-primary-200)] lg:block"
                    aria-hidden
                  >
                    <ArrowRight size={16} strokeWidth={2.25} />
                  </span>
                </>
              ) : null}
            </RevealItem>
          ))}
        </RevealGroup>
      </div>
    </section>
  );
}
