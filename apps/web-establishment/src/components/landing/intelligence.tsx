'use client';

import { Gift, Heart, Sparkles, TrendingUp, UserMinus } from 'lucide-react';
import { Reveal, RevealGroup, RevealItem } from '@/components/landing/reveal';

const finds = [
  {
    n: '8',
    title: 'Clientes para reativar',
    body: 'Costumavam vir e pararam. Um convite agora faz diferença.',
    Icon: UserMinus,
    wrap: 'bg-[var(--color-danger-fill)] text-white',
  },
  {
    n: '3',
    title: 'Perto de um benefício',
    body: 'Falta pouco para fechar o ciclo. Um empurrão fecha a visita.',
    Icon: Gift,
    wrap: 'bg-[var(--color-primary-500)] text-white',
  },
  {
    n: '2',
    title: 'VIP para fortalecer',
    body: 'Quem mais movimenta a loja também merece ser lembrado.',
    Icon: Heart,
    wrap: 'bg-[var(--color-intel-fill)] text-white',
  },
  {
    n: 'R$ 4.280',
    title: 'Alto valor',
    body: 'Quem mais gastou no período — e quem não pode sumir.',
    Icon: TrendingUp,
    wrap: 'bg-[var(--color-success-fill)] text-white',
  },
];

export function LandingIntelligence() {
  return (
    <section
      id="hoje"
      className="border-y border-[var(--color-hairline)] bg-[var(--color-bg)]"
      aria-labelledby="hoje-heading"
    >
      <div className="mx-auto max-w-6xl px-5 py-14 sm:px-8 sm:py-20">
        <Reveal>
          <p className="text-[12px] font-semibold uppercase tracking-[0.08em] text-[var(--color-intel)]">
            Frego Inteligência
          </p>
          <h2
            id="hoje-heading"
            className="mt-4 max-w-2xl text-[28px] font-extrabold leading-[1.22] tracking-[-0.03em] text-[var(--color-ink)] sm:text-[36px]"
          >
            O que eu deveria fazer hoje?
          </h2>
          <p className="mt-4 max-w-xl text-[16px] leading-relaxed text-[var(--color-neutral-500)]">
            Você não precisa analisar seus clientes. A Frego mostra onde vale
            colocar sua atenção — e o próximo passo já vem escrito.
          </p>
        </Reveal>

        <Reveal className="mt-8" delay={0.06}>
          <div className="overflow-hidden rounded-[20px] border border-[var(--color-intel)]/30 bg-[var(--color-intel-bg)] shadow-[var(--shadow-card)]">
            <header className="flex items-center gap-3 bg-[var(--color-intel-fill)] px-5 py-4 text-white">
              <span
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[12px] bg-white/15"
                aria-hidden
              >
                <Sparkles size={20} strokeWidth={2.25} />
              </span>
              <div className="min-w-0">
                <p className="text-[16px] font-semibold tracking-[-0.02em] sm:text-[18px]">
                  Frego Inteligência
                </p>
                <p className="mt-0.5 text-[12px] leading-snug text-white/80 sm:text-[13px]">
                  Ações para reter quem já veio e trazer de volta quem sumiu.
                </p>
              </div>
              <p className="ml-auto hidden shrink-0 text-[11px] font-semibold uppercase tracking-[0.06em] text-white/60 sm:block">
                Exemplo ilustrativo
              </p>
            </header>

            <RevealGroup className="grid gap-3 p-4 sm:grid-cols-2">
              {finds.map((f) => (
                <RevealItem key={f.title}>
                  <article className="flex h-full flex-col rounded-[16px] border border-[var(--color-hairline)] bg-[var(--color-card)] p-4">
                    <div className="flex items-start justify-between gap-3">
                      <span
                        className={`inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-[10px] ${f.wrap}`}
                      >
                        <f.Icon size={18} strokeWidth={2.25} aria-hidden />
                      </span>
                      <span className="text-[22px] font-semibold tabular-nums leading-none tracking-[-0.03em] text-[var(--color-ink)] sm:text-[26px]">
                        {f.n}
                      </span>
                    </div>
                    <h3 className="mt-3 text-[15px] font-semibold leading-snug tracking-[-0.02em] text-[var(--color-ink)]">
                      {f.title}
                    </h3>
                    <p className="mt-1.5 text-[13px] leading-relaxed text-[var(--color-neutral-500)]">
                      {f.body}
                    </p>
                    <p className="mt-3.5 text-[13px] font-semibold text-[var(--color-intel)]">
                      Criar campanha
                    </p>
                  </article>
                </RevealItem>
              ))}
            </RevealGroup>
          </div>
        </Reveal>
      </div>
    </section>
  );
}
