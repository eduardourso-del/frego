'use client';

import { Reveal } from '@/components/landing/reveal';
import { ProductFrame } from '@/components/landing/product-frame';

const points = [
  {
    title: 'Voltam com mais frequência',
    body: 'Freguês não é quem veio uma vez com cupom. É quem entra no hábito. Quanto mais forte o relacionamento, menor o intervalo entre as visitas.',
  },
  {
    title: 'Gastam mais a cada visita',
    body: 'Quem se sente parte da casa pede com mais confiança — e responde melhor a um convite certo do que a um desconto genérico o mês inteiro.',
  },
  {
    title: 'Valem mais ao longo do tempo',
    body: 'No painel, você vê quem voltou, quem sumiu e o que está trazendo a segunda visita. Cada cliente deixa de ser um desconhecido e passa a ser receita que se repete.',
  },
];

export function LandingSales() {
  return (
    <section
      id="resultado"
      className="border-y border-[var(--color-hairline)] bg-[var(--color-card)]"
      aria-labelledby="resultado-heading"
    >
      <div className="mx-auto grid max-w-6xl gap-12 px-5 py-14 sm:px-8 sm:py-20 lg:grid-cols-2 lg:items-center lg:gap-16">
        <Reveal className="order-2 lg:order-1">
          <ProductFrame
            src="/landing/relatorios.png"
            alt="Relatórios Frego com carimbos, pontos, gasto no programa e atividade diária"
            label="frego.app.br/relatorios"
            caption="Relatórios: carimbos, pontos, gasto no programa e atividade do período"
            width={1024}
            height={889}
          />
        </Reveal>

        <Reveal className="order-1 lg:order-2" delay={0.08}>
          <p className="text-[12px] font-semibold uppercase tracking-[0.08em] text-[var(--color-primary-500)]">
            No caixa
          </p>
          <h2
            id="resultado-heading"
            className="mt-4 text-[28px] font-extrabold leading-[1.22] tracking-[-0.03em] text-[var(--color-ink)] sm:text-[36px]"
          >
            Relacionamento forte vira frequência, ticket e margem.
          </h2>
          <p className="mt-4 text-[16px] leading-relaxed text-[var(--color-neutral-500)]">
            O cliente viu o prêmio no app. Voltaram as visitas. No painel, isso
            vira frequência, ticket e margem — e você escolhe a próxima
            campanha com dado, não no escuro.
          </p>
          <ul className="mt-10 space-y-7">
            {points.map((p) => (
              <li key={p.title}>
                <h3 className="text-[17px] font-semibold text-[var(--color-ink)]">
                  {p.title}
                </h3>
                <p className="mt-1.5 text-[15px] leading-relaxed text-[var(--color-neutral-500)]">
                  {p.body}
                </p>
              </li>
            ))}
          </ul>
        </Reveal>
      </div>
    </section>
  );
}
