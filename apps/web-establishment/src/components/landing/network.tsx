'use client';

import { Reveal, RevealGroup, RevealItem } from '@/components/landing/reveal';

const sides = [
  {
    kicker: 'Cliente',
    title: 'Benefícios e relacionamento',
    body: 'Acompanha as lojas da rotina e o que ainda pode ganhar — no mesmo app.',
  },
  {
    kicker: 'Loja',
    title: 'Clientes e inteligência',
    body: 'Vê quem voltou, quem sumiu e quem merece um convite hoje.',
  },
  {
    kicker: 'Rede',
    title: 'Negócios locais e clientes',
    body: 'Quanto mais lojas entram, mais natural fica o hábito de voltar — dos dois lados.',
  },
];

export function LandingNetwork() {
  return (
    <section
      id="rede"
      className="mx-auto max-w-6xl px-5 py-14 sm:px-8 sm:py-20"
      aria-labelledby="rede-heading"
    >
      <Reveal>
        <p className="text-[12px] font-semibold uppercase tracking-[0.08em] text-[var(--color-primary-500)]">
          A rede Frego
        </p>
        <h2
          id="rede-heading"
          className="mt-4 max-w-2xl text-[28px] font-extrabold leading-[1.22] tracking-[-0.03em] text-[var(--color-ink)] sm:text-[36px]"
        >
          Quanto mais negócios usam a Frego, mais útil ela fica para todos.
        </h2>
        <p className="mt-4 max-w-xl text-[16px] leading-relaxed text-[var(--color-neutral-500)]">
          Cliente e loja no mesmo lugar. O hábito de voltar fica mais fácil
          para os dois.
        </p>
      </Reveal>

      <RevealGroup className="mt-10 grid gap-4 sm:grid-cols-3">
        {sides.map((s) => (
          <RevealItem key={s.kicker}>
            <article className="h-full rounded-[18px] border border-[var(--color-hairline)] bg-[var(--color-card)] p-5">
              <p className="text-[12px] font-semibold uppercase tracking-[0.08em] text-[var(--color-primary-500)]">
                {s.kicker}
              </p>
              <h3 className="mt-2 text-[17px] font-semibold tracking-[-0.02em] text-[var(--color-ink)]">
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
