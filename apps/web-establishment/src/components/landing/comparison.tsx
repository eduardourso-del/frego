'use client';

import { Check, Minus } from 'lucide-react';
import { Reveal, RevealGroup, RevealItem } from '@/components/landing/reveal';

const rows = [
  {
    label: 'O que você constrói',
    frego: 'Fregueses: gente que volta para a sua casa.',
    other: 'Pedido avulso, cupom ou um carimbo que some na carteira.',
  },
  {
    label: 'Quem fica com o cliente',
    frego: 'Você. O relacionamento, o prêmio e a conversa são da loja.',
    other: 'O marketplace — ou ninguém, se o cartão de papel se perde.',
  },
  {
    label: 'Onde mora o cartão',
    frego: 'No aplicativo do cliente: saldo, validade e resgate na hora.',
    other: 'No papel, no fundo da bolsa, ou no app de outro.',
  },
  {
    label: 'Como você paga',
    frego: 'Mensalidade da plataforma. Sem taxa por visita ou por pedido.',
    other: 'Comissão no delivery, ou um software de pontos que não conversa.',
  },
  {
    label: 'Para quem vale a campanha',
    frego: 'A audiência certa: alto valor, em risco, quase no prêmio, VIP.',
    other: 'A mesma oferta para todo mundo — ou um cartão sem dado nenhum.',
  },
  {
    label: 'A pergunta que guia',
    frego: 'Isso faz o cliente voltar?',
    other: 'Isso gera pedido agora? Ou só enche o cartão?',
  },
];

export function LandingComparison() {
  return (
    <section
      id="comparacao"
      className="border-y border-[var(--color-hairline)] bg-[var(--color-primary-50)]/60"
      aria-labelledby="comparacao-heading"
    >
      <div className="mx-auto max-w-6xl px-5 py-14 sm:px-8 sm:py-20">
        <Reveal>
          <p className="text-[12px] font-semibold uppercase tracking-[0.08em] text-[var(--color-primary-500)]">
            Por que o Frego
          </p>
          <h2
            id="comparacao-heading"
            className="mt-4 max-w-2xl text-[28px] font-extrabold leading-[1.22] tracking-[-0.03em] text-[var(--color-ink)] sm:text-[36px]"
          >
            Vantagem contra o marketplace e contra o cartão de papel.
          </h2>
          <p className="mt-4 max-w-2xl text-[16px] leading-relaxed text-[var(--color-neutral-500)]">
            O Frego não é app de delivery e não é fidelidade genérica. Você
            fica com o cliente, ele vê o prêmio no celular, e a campanha vale
            para quem importa — sem comissão por pedido e sem um cartão que
            some na carteira.
          </p>
        </Reveal>

        <Reveal className="mt-8">
          <div className="overflow-hidden rounded-[20px] border border-[var(--color-hairline)] bg-[var(--color-card)]">
            <div className="hidden grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)_minmax(0,1fr)] border-b border-[var(--color-hairline)] sm:grid">
              <p className="px-5 py-4 text-[12px] font-semibold uppercase tracking-[0.06em] text-[var(--color-neutral-400)]">
                O que muda
              </p>
              <p className="bg-[var(--color-primary-50)] px-5 py-4 text-[12px] font-semibold uppercase tracking-[0.06em] text-[var(--color-primary-600)]">
                Frego
              </p>
              <p className="px-5 py-4 text-[12px] font-semibold uppercase tracking-[0.06em] text-[var(--color-neutral-400)]">
                Delivery, cartão e pontos genéricos
              </p>
            </div>

            {rows.map((r) => (
              <div
                key={r.label}
                className="grid gap-3 border-t border-[var(--color-hairline)] px-4 py-4 first:border-t-0 sm:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)_minmax(0,1fr)] sm:gap-0 sm:px-0 sm:py-0"
              >
                <p className="text-[13px] font-semibold text-[var(--color-ink)] sm:px-5 sm:py-5 sm:text-[14px] sm:font-medium">
                  {r.label}
                </p>
                <div className="flex items-start gap-2.5 rounded-[14px] bg-[var(--color-primary-50)] px-3.5 py-3 sm:rounded-none sm:px-5 sm:py-5">
                  <span className="mt-0.5 inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[var(--color-primary-500)] text-white">
                    <Check size={12} strokeWidth={3} aria-hidden />
                  </span>
                  <div>
                    <p className="text-[11px] font-semibold uppercase tracking-[0.06em] text-[var(--color-primary-600)] sm:hidden">
                      Frego
                    </p>
                    <p className="text-[14px] font-semibold leading-snug text-[var(--color-ink)]">
                      {r.frego}
                    </p>
                  </div>
                </div>
                <div className="flex items-start gap-2.5 rounded-[14px] bg-[var(--color-neutral-100)] px-3.5 py-3 sm:rounded-none sm:bg-transparent sm:px-5 sm:py-5">
                  <span className="mt-0.5 inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[var(--color-neutral-200)] text-[var(--color-neutral-500)]">
                    <Minus size={12} strokeWidth={3} aria-hidden />
                  </span>
                  <div>
                    <p className="text-[11px] font-semibold uppercase tracking-[0.06em] text-[var(--color-neutral-400)] sm:hidden">
                      Sem o Frego
                    </p>
                    <p className="text-[14px] leading-snug text-[var(--color-neutral-500)]">
                      {r.other}
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </Reveal>

        <RevealGroup className="mt-8 grid gap-4 sm:grid-cols-3">
          {[
            {
              title: 'Contra o marketplace',
              body: 'A conversa e o cliente são seus. Sem comissão por pedido e sem emprestar a demanda para o feed de outro.',
            },
            {
              title: 'Contra o cartão de papel',
              body: 'Saldo, validade e resgate ficam no celular. O cartão não some — e o caixa não precisa perguntar quantos carimbos faltam.',
            },
            {
              title: 'Contra a fidelidade genérica',
              body: 'Campanha da sua casa, para a audiência certa. Não um ponto sem motivo, nem o mesmo cupom para a base inteira.',
            },
          ].map((t) => (
            <RevealItem key={t.title}>
              <article className="h-full rounded-[16px] border border-[var(--color-hairline)] bg-[var(--color-card)] px-5 py-4">
                <h3 className="text-[15px] font-semibold tracking-[-0.02em] text-[var(--color-ink)]">
                  {t.title}
                </h3>
                <p className="mt-1.5 text-[13px] leading-relaxed text-[var(--color-neutral-500)]">
                  {t.body}
                </p>
              </article>
            </RevealItem>
          ))}
        </RevealGroup>
      </div>
    </section>
  );
}
