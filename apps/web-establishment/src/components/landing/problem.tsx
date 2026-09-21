'use client';

import { Reveal, RevealGroup, RevealItem } from '@/components/landing/reveal';

const situations = [
  {
    title: 'Sempre voltava — e sumiu',
    body: 'A pessoa que vinha toda semana parou de aparecer. No movimento do dia, isso passa batido.',
  },
  {
    title: 'Há muito tempo sem comprar',
    body: 'O intervalo cresceu. Ninguém avisou. Na próxima vez, pode ser na loja ao lado.',
  },
  {
    title: 'Comprou uma vez e não voltou',
    body: 'A primeira visita custou esforço. Sem um motivo claro, a segunda não acontece.',
  },
  {
    title: 'Perto de completar um benefício',
    body: 'Falta um carimbo, faltam pontos. Um empurrão agora fecha o ciclo — o silêncio deixa esfriar.',
  },
  {
    title: 'Já é freguês e poderia voltar mais',
    body: 'Cliente satisfeito que só precisa ser lembrado. Relacionamento que já existe e ninguém cuida.',
  },
  {
    title: 'VIP que merece um convite',
    body: 'Quem mais movimenta o negócio também some. E costuma ser o último a ser notado.',
  },
];

export function LandingProblem() {
  return (
    <section
      id="problema"
      className="mx-auto max-w-6xl px-5 py-14 sm:px-8 sm:py-20"
      aria-labelledby="problema-heading"
    >
      <Reveal>
        <p className="text-[12px] font-semibold uppercase tracking-[0.08em] text-[var(--color-primary-500)]">
          O que passa despercebido
        </p>
        <h2
          id="problema-heading"
          className="mt-4 max-w-2xl text-[28px] font-extrabold leading-[1.22] tracking-[-0.03em] text-[var(--color-ink)] sm:text-[36px]"
        >
          Seu cliente está indo embora sem você perceber.
        </h2>
        <p className="mt-4 max-w-xl text-[16px] leading-relaxed text-[var(--color-neutral-500)]">
          A maioria dos pequenos negócios já tem essas informações. O problema
          é que ninguém transforma esses dados em decisões.
        </p>
      </Reveal>

      <RevealGroup className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {situations.map((s) => (
          <RevealItem key={s.title}>
            <article className="h-full rounded-[18px] border border-[var(--color-hairline)] bg-[var(--color-card)] p-5">
              <h3 className="text-[17px] font-semibold tracking-[-0.02em] text-[var(--color-ink)]">
                {s.title}
              </h3>
              <p className="mt-2 text-[14px] leading-relaxed text-[var(--color-neutral-500)]">
                {s.body}
              </p>
            </article>
          </RevealItem>
        ))}
      </RevealGroup>
    </section>
  );
}
