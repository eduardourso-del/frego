'use client';

import { Reveal, RevealGroup, RevealItem } from '@/components/landing/reveal';

const pains = [
  {
    title: 'Conquistar um cliente custa caro',
    body: 'Anúncio, cupom, delivery, indicação — você já pagou para a pessoa atravessar a porta. Isso não pode ser o fim da história.',
  },
  {
    title: 'Perdê-lo custa ainda mais',
    body: 'Sem um motivo claro para voltar e sem conversa depois da compra, o cliente ocasional some. Na próxima vez, ele escolhe o concorrente.',
  },
  {
    title: 'Marketplace não cria freguês',
    body: 'O app de delivery empresta a demanda e fica com a taxa — e com o relacionamento. Quem deveria voltar para a sua loja volta para o feed do outro.',
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
          O problema
        </p>
        <h2
          id="problema-heading"
          className="mt-4 max-w-2xl text-[28px] font-extrabold leading-[1.22] tracking-[-0.03em] text-[var(--color-ink)] sm:text-[36px]"
        >
          Cada cliente conquistado merece uma segunda visita.
        </h2>
        <p className="mt-4 max-w-xl text-[16px] leading-relaxed text-[var(--color-neutral-500)]">
          Conquistar um cliente custa caro. Perdê-lo custa ainda mais. O Frego
          existe para garantir que a segunda visita — e a terceira, e a
          décima — aconteçam.
        </p>
      </Reveal>

      <RevealGroup className="mt-10 grid gap-8 sm:grid-cols-3 sm:gap-8">
        {pains.map((p) => (
          <RevealItem key={p.title}>
            <h3 className="text-[18px] font-semibold tracking-[-0.02em] text-[var(--color-ink)]">
              {p.title}
            </h3>
            <p className="mt-3 text-[15px] leading-relaxed text-[var(--color-neutral-500)]">
              {p.body}
            </p>
          </RevealItem>
        ))}
      </RevealGroup>
    </section>
  );
}
