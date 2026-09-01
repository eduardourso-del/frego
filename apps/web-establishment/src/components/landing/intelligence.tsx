'use client';

import {
  AlertTriangle,
  Crown,
  Gift,
  TrendingUp,
  type LucideIcon,
} from 'lucide-react';
import { Reveal, RevealGroup, RevealItem } from '@/components/landing/reveal';

const points = [
  {
    title: 'O próximo passo, já escrito',
    body: 'A ação recomendada junta quem mais gasta, quem sumiu e quem está perto do prêmio. Você lê uma frase e sabe o que fazer agora.',
  },
  {
    title: 'Quatro audiências prontas',
    body: 'Alto valor, em risco, quase no prêmio e VIP. Cada uma já vem com a regra — sem planilha, sem filtro na mão.',
  },
  {
    title: 'Da audiência à campanha',
    body: 'Você cria a campanha só para essa gente: o pão de queijo para quem está quase lá, o convite para quem sumiu. Não é um cupom igual para a base inteira.',
  },
];

const presets: Array<{
  name: string;
  count: string;
  description: string;
  Icon: LucideIcon;
  card: string;
  iconWrap: string;
  title: string;
  countClass: string;
  body: string;
  link: string;
}> = [
  {
    name: 'Alto valor',
    count: '18',
    description: 'Gastaram R$ 300 ou mais nos últimos 90 dias',
    Icon: TrendingUp,
    card: 'border-[var(--color-success)]/20 bg-[var(--color-success-bg)]',
    iconWrap: 'bg-[var(--color-success-fill)] text-white',
    title: 'text-[var(--color-success)]',
    countClass: 'text-[var(--color-success)]',
    body: 'text-[var(--color-neutral-500)]',
    link: 'text-[var(--color-success)]',
  },
  {
    name: 'Em risco',
    count: '3',
    description: 'Gastaram R$ 200 ou mais e estão sem visita há 30 dias ou mais',
    Icon: AlertTriangle,
    card: 'border-[var(--color-danger)]/25 bg-[var(--color-danger-bg)]',
    iconWrap: 'bg-[var(--color-danger-fill)] text-white',
    title: 'text-[var(--color-danger)]',
    countClass: 'text-[var(--color-danger)]',
    body: 'text-[var(--color-neutral-500)]',
    link: 'text-[var(--color-danger)]',
  },
  {
    name: 'Quase prêmio',
    count: '18',
    description: 'Chegaram a 80% ou mais da campanha principal',
    Icon: Gift,
    card: 'border-[var(--color-primary-200)] bg-[var(--color-primary-50)]',
    iconWrap: 'bg-[var(--color-primary-500)] text-white',
    title: 'text-[var(--color-primary-600)]',
    countClass: 'text-[var(--color-primary-800)]',
    body: 'text-[var(--color-neutral-500)]',
    link: 'text-[var(--color-primary-600)]',
  },
  {
    name: 'VIP',
    count: '4',
    description: 'Marcados manualmente como VIP',
    Icon: Crown,
    card: 'border-transparent bg-[var(--color-primary-800)]',
    iconWrap: 'bg-white/15 text-white',
    title: 'text-white',
    countClass: 'text-white',
    body: 'text-white/70',
    link: 'text-[var(--color-primary-200)]',
  },
];

function AudienceMock() {
  return (
    <figure>
      <div className="overflow-hidden rounded-[20px] border border-[var(--color-hairline)] bg-[var(--color-card)] shadow-[var(--shadow-raised)]">
        <div className="flex items-center gap-1.5 border-b border-[var(--color-hairline)] bg-[var(--color-neutral-100)] px-4 py-2.5">
          <span className="h-2.5 w-2.5 rounded-full bg-[var(--color-neutral-200)]" />
          <span className="h-2.5 w-2.5 rounded-full bg-[var(--color-neutral-200)]" />
          <span className="h-2.5 w-2.5 rounded-full bg-[var(--color-neutral-200)]" />
          <span className="ml-3 truncate text-[11px] font-medium text-[var(--color-neutral-400)]">
            frego.app.br/painel
          </span>
        </div>
        <div className="p-5 sm:p-6">
          <p className="text-[12px] font-semibold uppercase tracking-[0.04em] text-[var(--color-neutral-400)]">
            Ação recomendada
          </p>
          <p className="mt-2 text-[18px] font-semibold tracking-[-0.02em] text-[var(--color-ink)] sm:text-[20px]">
            Alto valor: 3 sem visita há 30 dias
          </p>
          <p className="mt-2 max-w-3xl text-[14px] leading-relaxed text-[var(--color-neutral-500)] sm:text-[15px]">
            3 clientes que mais gastam estão sumidos. Crie uma campanha só para
            eles e chame de volta.
          </p>
          <p className="mt-3 text-[14px] font-semibold text-[var(--color-primary-500)]">
            Ver audiência →
          </p>

          <div className="mt-5 border-t border-[var(--color-hairline)] pt-4">
            <div className="mb-3 flex items-baseline justify-between gap-3">
              <p className="text-[13px] font-semibold text-[var(--color-ink)]">
                Oportunidades de campanha
              </p>
              <p className="shrink-0 text-[13px] font-semibold text-[var(--color-primary-500)]">
                Ver todas
              </p>
            </div>
            <div className="grid grid-cols-2 gap-2.5 md:grid-cols-4">
              {presets.map((p) => (
                <div
                  key={p.name}
                  className={`min-w-0 rounded-[14px] border p-3 ${p.card}`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span
                      className={`inline-flex h-8 w-8 items-center justify-center rounded-[10px] ${p.iconWrap}`}
                    >
                      <p.Icon size={16} strokeWidth={2.25} aria-hidden />
                    </span>
                    <span
                      className={`text-[22px] font-semibold tabular-nums leading-none ${p.countClass}`}
                    >
                      {p.count}
                    </span>
                  </div>
                  <p
                    className={`mt-2.5 text-[12px] font-semibold ${p.title}`}
                  >
                    {p.name}
                  </p>
                  <p className={`mt-1 text-[11px] leading-snug ${p.body}`}>
                    {p.description}
                  </p>
                  <p
                    className={`mt-2.5 text-[11px] font-semibold ${p.link}`}
                  >
                    Ver · Criar campanha
                  </p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
      <figcaption className="mt-3 text-center text-[13px] text-[var(--color-neutral-500)]">
        O painel aponta a audiência. Você cria a campanha.
      </figcaption>
    </figure>
  );
}

export function LandingIntelligence() {
  return (
    <section
      id="audiencias"
      className="border-y border-[var(--color-hairline)] bg-[var(--color-card)]"
      aria-labelledby="audiencias-heading"
    >
      <div className="mx-auto max-w-6xl px-5 py-14 sm:px-8 sm:py-20">
        <Reveal>
          <p className="text-[12px] font-semibold uppercase tracking-[0.08em] text-[var(--color-primary-500)]">
            Para quem
          </p>
          <h2
            id="audiencias-heading"
            className="mt-4 max-w-3xl text-[28px] font-extrabold leading-[1.22] tracking-[-0.03em] text-[var(--color-ink)] sm:text-[36px]"
          >
            Quem precisa da próxima campanha — sem você virar analista.
          </h2>
          <p className="mt-4 max-w-2xl text-[16px] leading-relaxed text-[var(--color-neutral-500)]">
            Uma campanha boa começa na audiência certa. O Frego lê o movimento
            da casa e aponta: quem mais gasta e sumiu, quem está em risco, quem
            está quase no prêmio, quem você marcou como VIP. A ação recomendada
            chega pronta. Você decide o presente; o painel diz para quem.
          </p>
        </Reveal>

        <Reveal className="mt-8" delay={0.08}>
          <AudienceMock />
        </Reveal>

        <RevealGroup className="mt-8 grid gap-8 sm:grid-cols-3">
          {points.map((p) => (
            <RevealItem key={p.title}>
              <h3 className="text-[16px] font-semibold tracking-[-0.02em] text-[var(--color-ink)]">
                {p.title}
              </h3>
              <p className="mt-1.5 text-[14px] leading-relaxed text-[var(--color-neutral-500)]">
                {p.body}
              </p>
            </RevealItem>
          ))}
        </RevealGroup>
      </div>
    </section>
  );
}
