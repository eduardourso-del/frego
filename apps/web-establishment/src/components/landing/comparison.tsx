'use client';

import { Reveal, RevealGroup, RevealItem } from '@/components/landing/reveal';

const without = [
  {
    title: 'Sem equipe de marketing.',
    body: 'Você não precisa virar especialista para saber quem chamar hoje.',
  },
  {
    title: 'Sem equipe de TI.',
    body: 'Cadastre o negócio e comece. Sem implantação complicada.',
  },
  {
    title: 'Sem relatórios impossíveis de entender.',
    body: 'Poucos dados. Inteligência. Ação. Não mais um painel.',
  },
  {
    title: 'Sem CRM para aprender.',
    body: 'Seu negócio precisa de respostas, não de mais um sistema.',
  },
];

export function LandingComparison() {
  return (
    <section
      id="simplicidade"
      className="border-y border-[var(--color-hairline)] bg-[var(--color-primary-800)] text-white"
      aria-labelledby="simplicidade-heading"
    >
      <div className="mx-auto max-w-6xl px-5 py-14 sm:px-8 sm:py-20">
        <Reveal>
          <p className="text-[12px] font-semibold uppercase tracking-[0.08em] text-[var(--color-primary-200)]">
            Simplicidade
          </p>
          <h2
            id="simplicidade-heading"
            className="mt-4 max-w-2xl text-[28px] font-extrabold leading-[1.22] tracking-[-0.03em] sm:text-[36px]"
          >
            Feito para quem não tem tempo para aprender mais uma ferramenta.
          </h2>
          <p className="mt-5 max-w-xl text-[22px] font-extrabold leading-snug tracking-[-0.03em] text-[var(--color-primary-200)] sm:text-[26px]">
            Menos análise. Mais clientes de volta.
          </p>
          <p className="mt-4 max-w-lg text-[15px] leading-relaxed text-white/70">
            Grandes plataformas pedem muitos dados, muitos painéis e muitas
            decisões. A Frego pega o que a sua venda já gera e aponta o próximo
            passo.
          </p>
        </Reveal>

        <RevealGroup className="mt-10 grid gap-4 sm:grid-cols-2">
          {without.map((w) => (
            <RevealItem key={w.title}>
              <article className="h-full rounded-[18px] border border-white/10 bg-white/5 px-5 py-5">
                <h3 className="text-[17px] font-semibold tracking-[-0.02em]">
                  {w.title}
                </h3>
                <p className="mt-2 text-[14px] leading-relaxed text-white/65">
                  {w.body}
                </p>
              </article>
            </RevealItem>
          ))}
        </RevealGroup>

        <Reveal className="mt-10" delay={0.08}>
          <p className="max-w-xl text-[16px] leading-relaxed text-white/80">
            Cadastre seu negócio, comece a registrar seus clientes e deixe a
            Frego encontrar as oportunidades.
          </p>
        </Reveal>
      </div>
    </section>
  );
}
