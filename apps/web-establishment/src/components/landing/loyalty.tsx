'use client';

import { Reveal, RevealGroup, RevealItem } from '@/components/landing/reveal';

const points = [
  {
    title: 'WhatsApp que mantém a conversa viva',
    body: 'Depois da compra, a relação não morre no caixa. Mensagens no momento certo — lembrete, convite, “sentimos sua falta” — no aplicativo que o cliente já abre todos os dias.',
  },
  {
    title: 'IA e automações que trabalham por você',
    body: 'Você atende a loja. O Frego cuida de quem sumiu, de quem está perto de voltar e de quem merece um empurrão. Relacionamento em escala, sem você virar call center.',
  },
  {
    title: 'Relacionamento, não plástico nem pontinho',
    body: 'Não acreditamos que cartão ou pontuação, sozinhos, criem hábito. O que faz alguém escolher a sua loja de novo é se sentir lembrado — e ter um motivo claro para voltar.',
  },
];

export function LandingLoyalty() {
  return (
    <section
      id="fregueses"
      className="border-y border-[var(--color-hairline)] bg-[var(--color-card)]"
      aria-labelledby="fregueses-heading"
    >
      <div className="mx-auto max-w-6xl px-5 py-14 sm:px-8 sm:py-20">
        <Reveal>
          <p className="text-[12px] font-semibold uppercase tracking-[0.08em] text-[var(--color-primary-500)]">
            A promessa
          </p>
          <h2
            id="fregueses-heading"
            className="mt-4 max-w-3xl text-[28px] font-extrabold leading-[1.22] tracking-[-0.03em] text-[var(--color-ink)] sm:text-[36px]"
          >
            Não vendemos fidelidade. Criamos fregueses.
          </h2>
          <p className="mt-4 max-w-2xl text-[16px] leading-relaxed text-[var(--color-neutral-500)]">
            Ajudamos negócios locais a transformar clientes em fregueses:
            relacionamentos que fazem as pessoas voltar, comprar mais vezes e
            escolher você antes da concorrência. O motivo vem depois — a
            campanha, a audiência, o app. Primeiro, o vínculo.
          </p>
        </Reveal>

        <RevealGroup className="mt-10 grid gap-8 sm:grid-cols-3">
          {points.map((p) => (
            <RevealItem key={p.title}>
              <h3 className="text-[17px] font-semibold tracking-[-0.02em] text-[var(--color-ink)]">
                {p.title}
              </h3>
              <p className="mt-1.5 text-[15px] leading-relaxed text-[var(--color-neutral-500)]">
                {p.body}
              </p>
            </RevealItem>
          ))}
        </RevealGroup>
      </div>
    </section>
  );
}
