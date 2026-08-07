'use client';

import { Reveal, RevealGroup, RevealItem } from '@/components/landing/reveal';

const steps = [
  {
    n: '01',
    title: 'Cadastre seu negócio',
    body: 'Em minutos sua loja está no Frego. Sem instalação complicada, sem time de TI.',
  },
  {
    n: '02',
    title: 'Conecte o relacionamento',
    body: 'WhatsApp, automações e o jeito que você quer falar com quem já comprou. A conversa passa a ter dono: você.',
  },
  {
    n: '03',
    title: 'Atenda — a gente lembra',
    body: 'No dia a dia você foca no balcão. O Frego identifica quem sumiu, quem está perto de voltar e dispara no momento certo.',
  },
  {
    n: '04',
    title: 'Cliente vira freguês',
    body: 'Segunda visita, terceira, hábito. Cada funcionalidade existe para uma pergunta: isso aumenta a chance dele voltar?',
  },
];

export function LandingHowItWorks() {
  return (
    <section
      id="como-funciona"
      className="border-y border-[var(--color-hairline)] bg-[var(--color-ink)] text-white"
      aria-labelledby="como-heading"
    >
      <div className="mx-auto max-w-6xl px-5 py-20 sm:px-8 sm:py-28">
        <Reveal>
          <p className="text-[12px] font-semibold uppercase tracking-[0.06em] text-[var(--color-primary-200)]">
            Como funciona
          </p>
          <h2
            id="como-heading"
            className="mt-3 max-w-2xl text-[28px] font-semibold tracking-[-0.03em] sm:text-[36px]"
          >
            Do primeiro cliente ao freguês — em quatro passos
          </h2>
          <p className="mt-4 max-w-lg text-[15px] leading-relaxed text-white/65">
            As mesmas ferramentas de relacionamento que grandes marcas usam —
            agora na mão do negócio local.
          </p>
        </Reveal>

        <RevealGroup className="mt-14 grid gap-10 sm:grid-cols-2 lg:grid-cols-4 lg:gap-8">
          {steps.map((s) => (
            <RevealItem key={s.n}>
              <p className="font-mono text-[13px] font-semibold tracking-[0.04em] text-[var(--color-primary-200)]">
                {s.n}
              </p>
              <h3 className="mt-3 text-[18px] font-semibold tracking-[-0.02em]">
                {s.title}
              </h3>
              <p className="mt-2 text-[14px] leading-relaxed text-white/65">
                {s.body}
              </p>
            </RevealItem>
          ))}
        </RevealGroup>
      </div>
    </section>
  );
}
