'use client';

import { Reveal, RevealGroup, RevealItem } from '@/components/landing/reveal';

const rows = [
  {
    label: 'O que você constrói',
    frego: 'Fregueses — gente que volta',
    other: 'Pedidos avulsos / cupons',
  },
  {
    label: 'Quem fica com o relacionamento',
    frego: 'Você, na sua loja',
    other: 'O marketplace',
  },
  {
    label: 'Taxa por pedido',
    frego: 'Não. Só a mensalidade',
    other: 'Comum em apps de delivery',
  },
  {
    label: 'Como a conversa acontece',
    frego: 'WhatsApp + IA + automações',
    other: 'Push do app do outro',
  },
  {
    label: 'Cartão de papel / pontos vazios',
    frego: 'Não é o centro — relacionamento é',
    other: 'Muitas vezes é o único “produto”',
  },
  {
    label: 'Pergunta que guia o produto',
    frego: 'Isso faz o cliente voltar?',
    other: 'Isso gera mais pedido agora?',
  },
];

export function LandingComparison() {
  return (
    <section
      id="comparacao"
      className="border-y border-[var(--color-hairline)] bg-[var(--color-primary-50)]/60"
      aria-labelledby="comparacao-heading"
    >
      <div className="mx-auto max-w-6xl px-5 py-20 sm:px-8 sm:py-28">
        <Reveal>
          <p className="text-[12px] font-semibold uppercase tracking-[0.06em] text-[var(--color-primary-500)]">
            O que acreditamos
          </p>
          <h2
            id="comparacao-heading"
            className="mt-3 max-w-2xl text-[28px] font-semibold tracking-[-0.03em] text-[var(--color-ink)] sm:text-[36px]"
          >
            Todo cliente merece virar freguês.
          </h2>
          <p className="mt-4 max-w-xl text-[16px] leading-relaxed text-[var(--color-neutral-500)]">
            Não acreditamos que pontos criam hábito. Não acreditamos que cartões
            fazem alguém voltar. Acreditamos que relacionamentos constroem
            negócios — e que o negócio local merece as mesmas ferramentas das
            grandes marcas.
          </p>
        </Reveal>

        <Reveal className="mt-12 overflow-x-auto">
          <table className="w-full min-w-[560px] border-collapse text-left text-[14px]">
            <thead>
              <tr className="border-b border-[var(--color-neutral-200)]">
                <th className="py-3 pr-4 font-semibold text-[var(--color-neutral-500)]">
                  O que muda
                </th>
                <th className="py-3 px-4 font-semibold text-[var(--color-primary-600)]">
                  Frego
                </th>
                <th className="py-3 pl-4 font-semibold text-[var(--color-neutral-500)]">
                  Marketplace / “fidelidade” genérica
                </th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr
                  key={r.label}
                  className="border-b border-[var(--color-hairline)]"
                >
                  <td className="py-4 pr-4 font-medium text-[var(--color-ink)]">
                    {r.label}
                  </td>
                  <td className="py-4 px-4 font-semibold text-[var(--color-ink)]">
                    {r.frego}
                  </td>
                  <td className="py-4 pl-4 text-[var(--color-neutral-500)]">
                    {r.other}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="mt-4 text-[12px] text-[var(--color-neutral-400)]">
            Sem taxa por pedido: confirme no plano comercial. Se a política
            mudar, atualize esta linha.
          </p>
        </Reveal>

        <RevealGroup className="mt-10 grid gap-4 sm:grid-cols-3">
          {[
            'Relacionamento na sua mão',
            'Cliente escolhe você de novo',
            'Sem alugar a demanda do outro',
          ].map((t) => (
            <RevealItem key={t}>
              <p className="text-[15px] font-semibold tracking-[-0.01em] text-[var(--color-ink)]">
                {t}
              </p>
            </RevealItem>
          ))}
        </RevealGroup>
      </div>
    </section>
  );
}
