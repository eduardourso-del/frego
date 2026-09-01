'use client';

import { Reveal, RevealGroup, RevealItem } from '@/components/landing/reveal';

const steps = [
  {
    n: '01',
    title: 'Cadastre seu negócio',
    body: 'Em minutos, sua loja está no Frego. Sem instalação complicada, sem equipe de TI.',
  },
  {
    n: '02',
    title: 'Monte o motivo de voltar',
    body: 'Campanha de carimbos, pontos, cashback ou aniversário. Você define o prêmio; o Frego leva até o aplicativo e o caixa.',
  },
  {
    n: '03',
    title: 'O painel aponta; o app mostra',
    body: 'Quem sumiu, quem está quase no prêmio. O cliente vê o saldo no bolso. Você atende a loja — a gente lembra.',
  },
  {
    n: '04',
    title: 'Cliente vira freguês',
    body: 'Segunda visita, terceira, hábito. Cada funcionalidade existe para uma pergunta: isso aumenta a chance de ele voltar?',
  },
];

export function LandingHowItWorks() {
  return (
    <section
      id="como-funciona"
      className="border-y border-[var(--color-hairline)] bg-[var(--color-primary-800)] text-white"
      aria-labelledby="como-heading"
    >
      <div className="mx-auto max-w-6xl px-5 py-14 sm:px-8 sm:py-20">
        <Reveal>
          <p className="text-[12px] font-semibold uppercase tracking-[0.08em] text-[var(--color-primary-200)]">
            Como funciona
          </p>
          <h2
            id="como-heading"
            className="mt-4 max-w-2xl text-[28px] font-extrabold leading-[1.22] tracking-[-0.03em] sm:text-[36px]"
          >
            Do primeiro cliente ao freguês, em quatro passos
          </h2>
          <p className="mt-4 max-w-lg text-[15px] leading-relaxed text-white/65">
            As mesmas ferramentas de relacionamento que as grandes marcas usam —
            agora na mão do negócio local.
          </p>
        </Reveal>

        <RevealGroup className="mt-10 grid gap-8 sm:grid-cols-2 lg:grid-cols-4 lg:gap-8">
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
