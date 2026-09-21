'use client';

import {
  Gift,
  MessageCircle,
  RotateCcw,
  TrendingUp,
  BarChart3,
  Users,
  type LucideIcon,
} from 'lucide-react';
import { Reveal, RevealGroup, RevealItem } from '@/components/landing/reveal';
import { ProductFrame } from '@/components/landing/product-frame';

const outcomes: Array<{
  title: string;
  body: string;
  Icon: LucideIcon;
}> = [
  {
    title: 'Traga clientes de volta',
    body: 'Identifique automaticamente quem está demorando mais do que o normal para voltar.',
    Icon: RotateCcw,
  },
  {
    title: 'Conheça seus melhores clientes',
    body: 'Veja quem mais compra, quem mais frequenta e quem realmente movimenta o seu negócio.',
    Icon: TrendingUp,
  },
  {
    title: 'Crie motivos para voltar',
    body: 'Use pontos, carimbos, cashback ou benefícios para incentivar a próxima visita — do jeito da sua loja.',
    Icon: Gift,
  },
  {
    title: 'Fale com a pessoa certa',
    body: 'Pare de mandar a mesma mensagem para todo mundo. A campanha vale para quem sumiu, quem está quase lá ou quem já é VIP.',
    Icon: Users,
  },
  {
    title: 'Converse na hora certa',
    body: 'Use o WhatsApp para falar com cada cliente no momento em que a conversa faz sentido — não no disparo genérico.',
    Icon: MessageCircle,
  },
  {
    title: 'Saiba o que funcionou',
    body: 'Veja quantos clientes voltaram e quanto a campanha gerou em vendas. Relacionamento com número no caixa.',
    Icon: BarChart3,
  },
];

export function LandingOutcomes() {
  return (
    <section
      id="resultados-uso"
      className="border-y border-[var(--color-hairline)] bg-[var(--color-card)]"
      aria-labelledby="uso-heading"
    >
      <div className="mx-auto max-w-6xl px-5 py-14 sm:px-8 sm:py-20">
        <Reveal>
          <p className="text-[12px] font-semibold uppercase tracking-[0.08em] text-[var(--color-primary-500)]">
            O que muda na prática
          </p>
          <h2
            id="uso-heading"
            className="mt-4 max-w-2xl text-[28px] font-extrabold leading-[1.22] tracking-[-0.03em] text-[var(--color-ink)] sm:text-[36px]"
          >
            A Frego mostra quem merece sua atenção.
          </h2>
          <p className="mt-4 max-w-xl text-[16px] leading-relaxed text-[var(--color-neutral-500)]">
            Menos análise. Mais clientes de volta.
          </p>
        </Reveal>

        <RevealGroup className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {outcomes.map((o) => (
            <RevealItem key={o.title}>
              <article className="h-full rounded-[18px] border border-[var(--color-hairline)] bg-[var(--color-bg)] p-5">
                <span className="inline-flex h-10 w-10 items-center justify-center rounded-[12px] bg-[var(--color-primary-50)] text-[var(--color-primary-600)]">
                  <o.Icon size={20} strokeWidth={2.25} aria-hidden />
                </span>
                <h3 className="mt-4 text-[17px] font-semibold tracking-[-0.02em] text-[var(--color-ink)]">
                  {o.title}
                </h3>
                <p className="mt-2 text-[14px] leading-relaxed text-[var(--color-neutral-500)]">
                  {o.body}
                </p>
              </article>
            </RevealItem>
          ))}
        </RevealGroup>

        <Reveal className="mt-10" delay={0.08}>
          <ProductFrame
            src="/landing/clientes-valiosos.png"
            alt="Audiências Frego: alto valor, em risco, quase no prêmio e VIP"
            label="frego.app.br/clientes"
            caption="Alto valor, em risco, quase no prêmio, VIP — a lista já vem pronta"
            width={1024}
            height={720}
          />
        </Reveal>
      </div>
    </section>
  );
}
