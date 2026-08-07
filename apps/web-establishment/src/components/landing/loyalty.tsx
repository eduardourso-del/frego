'use client';

import { Reveal } from '@/components/landing/reveal';
import {
  LoyaltySketch,
  MockupPlaceholder,
} from '@/components/landing/mockup-placeholder';

const points = [
  {
    title: 'WhatsApp que mantém a conversa viva',
    body: 'Depois da compra, a relação não morre no caixa. Mensagens no momento certo — lembrete, convite, “sentimos sua falta” — no app que o cliente já abre todo dia.',
  },
  {
    title: 'IA e automações que trabalham por você',
    body: 'Você atende a loja. O Frego cuida de quem sumiu, de quem está perto de voltar e de quem merece um empurrão. Relacionamento em escala, sem você virar call center.',
  },
  {
    title: 'Relacionamento, não plástico nem pontinho',
    body: 'Não acreditamos que cartão ou pontuação sozinhos criam hábito. O que faz alguém escolher a sua loja de novo é se sentir lembrado — e ter um motivo claro para voltar.',
  },
];

export function LandingLoyalty() {
  return (
    <section
      id="fregueses"
      className="border-y border-[var(--color-hairline)] bg-[var(--color-card)]"
      aria-labelledby="fregueses-heading"
    >
      <div className="mx-auto grid max-w-6xl gap-12 px-5 py-20 sm:px-8 sm:py-28 lg:grid-cols-2 lg:items-center lg:gap-16">
        <Reveal>
          <p className="text-[12px] font-semibold uppercase tracking-[0.06em] text-[var(--color-primary-500)]">
            Nossa promessa
          </p>
          <h2
            id="fregueses-heading"
            className="mt-3 text-[28px] font-semibold tracking-[-0.03em] text-[var(--color-ink)] sm:text-[36px]"
          >
            Não vendemos fidelidade. Criamos fregueses.
          </h2>
          <p className="mt-4 text-[16px] leading-relaxed text-[var(--color-neutral-500)]">
            Ajudamos negócios locais a transformar clientes em fregueses —
            relacionamentos que fazem as pessoas voltar, comprar mais vezes e
            escolher você antes da concorrência.
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

        <Reveal delay={0.1}>
          <MockupPlaceholder
            label="Relacionamento · WhatsApp"
            caption="[MOCKUP] Conversa que traz o cliente de volta — substitua por captura real"
          >
            <LoyaltySketch />
          </MockupPlaceholder>
        </Reveal>
      </div>
    </section>
  );
}
