'use client';

import { ProductFrame } from '@/components/landing/product-frame';
import { Reveal } from '@/components/landing/reveal';

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
          <ProductFrame
            className="mx-auto w-full max-w-[720px]"
            src="/landing/inteligencia.png"
            alt="Frego Inteligência: clientes que sumiram, quem está a um passo do prêmio, quem mais gastou e o horário vazio da casa"
            label="frego.app.br/dashboard"
            caption="Ações para reter quem já veio e trazer de volta quem sumiu"
            width={1024}
            height={716}
            sizes="720px"
            unoptimized
          />
        </Reveal>
      </div>
    </section>
  );
}
