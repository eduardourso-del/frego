'use client';

import { Reveal } from '@/components/landing/reveal';
import { ProductFrame } from '@/components/landing/product-frame';

const metrics = [
  { label: 'Clientes alcançados', value: '83' },
  { label: 'Voltaram', value: '19' },
  { label: 'Vendas geradas', value: 'R$ 3.420' },
  { label: 'Benefícios resgatados', value: 'R$ 285' },
];

export function LandingSales() {
  return (
    <section
      id="resultado"
      className="mx-auto max-w-6xl px-5 py-14 sm:px-8 sm:py-20"
      aria-labelledby="resultado-heading"
    >
      <Reveal>
        <p className="text-[12px] font-semibold uppercase tracking-[0.08em] text-[var(--color-primary-500)]">
          Resultado
        </p>
        <h2
          id="resultado-heading"
          className="mt-4 max-w-2xl text-[28px] font-extrabold leading-[1.22] tracking-[-0.03em] text-[var(--color-ink)] sm:text-[36px]"
        >
          Não conte mensagens. Conte clientes que voltaram.
        </h2>
        <p className="mt-4 max-w-xl text-[16px] leading-relaxed text-[var(--color-neutral-500)]">
          A Frego conecta relacionamento com resultado: quem foi chamado, quem
          voltou e quanto isso gerou no caixa.
        </p>
      </Reveal>

      <div className="mt-10 grid gap-8 lg:grid-cols-[0.9fr_1.1fr] lg:items-center lg:gap-12">
        <Reveal>
          <div className="overflow-hidden rounded-[20px] border border-[var(--color-hairline)] bg-[var(--color-card)] shadow-[var(--shadow-card)]">
            <div className="flex items-start justify-between gap-3 border-b border-[var(--color-hairline)] px-5 py-4">
              <div>
                <p className="text-[12px] font-semibold uppercase tracking-[0.08em] text-[var(--color-neutral-400)]">
                  Campanha
                </p>
                <p className="mt-1 text-[18px] font-extrabold tracking-[-0.02em] text-[var(--color-ink)]">
                  Clientes que sumiram
                </p>
              </div>
              <p className="shrink-0 text-[11px] font-semibold uppercase tracking-[0.06em] text-[var(--color-neutral-400)]">
                Exemplo ilustrativo
              </p>
            </div>
            <dl className="grid grid-cols-2">
              {metrics.map((m) => (
                <div
                  key={m.label}
                  className="border-t border-[var(--color-hairline)] px-5 py-5 even:border-l"
                >
                  <dt className="text-[12px] font-medium text-[var(--color-neutral-500)]">
                    {m.label}
                  </dt>
                  <dd className="mt-1.5 text-[22px] font-extrabold tabular-nums tracking-[-0.03em] text-[var(--color-ink)] sm:text-[26px]">
                    {m.value}
                  </dd>
                </div>
              ))}
            </dl>
          </div>
        </Reveal>

        <Reveal delay={0.08}>
          <ProductFrame
            src="/landing/campanhas.png"
            alt="Desempenho das campanhas no Frego: resgates, quem voltou e receita gerada"
            label="frego.app.br/relatorios"
            caption="No painel, cada campanha mostra quem voltou e o que gerou no caixa"
            width={1024}
            height={640}
          />
        </Reveal>
      </div>
    </section>
  );
}
