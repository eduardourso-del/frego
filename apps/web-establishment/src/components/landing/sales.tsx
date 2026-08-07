'use client';

import { Reveal } from '@/components/landing/reveal';
import {
  DashboardSketch,
  MockupPlaceholder,
} from '@/components/landing/mockup-placeholder';

const points = [
  {
    title: 'Voltam com mais frequência',
    body: 'Freguês não é quem veio uma vez com cupom. É quem entra no hábito. Quanto mais forte o relacionamento, menor o intervalo entre visitas.',
  },
  {
    title: 'Gastam mais a cada visita',
    body: 'Quem se sente parte da casa pede com mais confiança — e responde melhor a um convite certo do que a desconto genérico o mês inteiro.',
  },
  {
    title: 'Valem mais ao longo do tempo',
    body: 'No painel você vê quem voltou, quem sumiu e o que está puxando a segunda visita. Cada cliente deixa de ser um tiro no escuro e vira receita recorrente.',
  },
];

export function LandingSales() {
  return (
    <section
      id="resultado"
      className="mx-auto max-w-6xl px-5 py-20 sm:px-8 sm:py-28"
      aria-labelledby="resultado-heading"
    >
      <div className="grid gap-12 lg:grid-cols-2 lg:items-center lg:gap-16">
        <Reveal className="order-2 lg:order-1">
          <MockupPlaceholder
            label="Painel · Frego"
            caption="[MOCKUP] O que importa no caixa — substitua por captura real"
          >
            <DashboardSketch />
          </MockupPlaceholder>
        </Reveal>

        <Reveal className="order-1 lg:order-2" delay={0.08}>
          <p className="text-[12px] font-semibold uppercase tracking-[0.06em] text-[var(--color-primary-500)]">
            No seu caixa
          </p>
          <h2
            id="resultado-heading"
            className="mt-3 text-[28px] font-semibold tracking-[-0.03em] text-[var(--color-ink)] sm:text-[36px]"
          >
            Relacionamento forte vira frequência, ticket e margem.
          </h2>
          <p className="mt-4 text-[16px] leading-relaxed text-[var(--color-neutral-500)]">
            Quanto mais forte o vínculo com o cliente, maior a chance de ele
            voltar — e escolher a sua loja antes da concorrência. É isso que
            aparece no fim do mês.
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
