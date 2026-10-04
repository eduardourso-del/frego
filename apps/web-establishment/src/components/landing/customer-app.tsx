'use client';

import Image from 'next/image';
import { Gift, Heart, Smartphone } from 'lucide-react';
import { Reveal, RevealGroup, RevealItem } from '@/components/landing/reveal';
import { StoreBadges } from '@/components/store-badges';

const shots = [
  {
    src: '/landing/app-lojas.png',
    alt: 'App Frego — lojas que o cliente frequenta e benefícios em andamento',
    title: 'As lojas da rotina',
    caption:
      'O cliente vê as lojas que já frequenta — não um mural de descontos.',
  },
  {
    src: '/landing/app-loja.png',
    alt: 'App Frego — ficha da loja com carimbos, pontos e cashback',
    title: 'Benefícios da loja',
    caption:
      'Carimbos, pontos e saldo, cada um no seu ritmo. O cliente vê o que ainda pode ganhar.',
  },
  {
    src: '/landing/app-premios.png',
    alt: 'App Frego — prêmios prontos para resgatar no caixa',
    title: 'Resgate no caixa',
    caption:
      'Quando chega a meta, o cliente mostra a tela. A loja confirma. Sem cartão de papel.',
  },
] as const;

const points = [
  {
    title: 'O progresso cabe no bolso',
    body: 'O freguês abre o app e sabe o que falta. Você não precisa explicar o cartão a cada visita.',
    Icon: Smartphone,
  },
  {
    title: 'Relacionamento com a sua loja',
    body: 'Ele vê o prêmio da sua loja — o pão de queijo, o café — não um desconto genérico.',
    Icon: Heart,
  },
  {
    title: 'Fecha no caixa, na hora',
    body: 'Quando está pronto, vira um botão. A campanha que você montou completa o ciclo.',
    Icon: Gift,
  },
];

function PhoneShot({
  src,
  alt,
  title,
  caption,
}: (typeof shots)[number]) {
  return (
    <figure className="flex h-full flex-col rounded-[18px] border border-[var(--color-hairline)] bg-[var(--color-bg)] p-4 shadow-[var(--shadow-card)] sm:p-5">
      <div className="mx-auto w-full max-w-[240px] overflow-hidden rounded-[24px] border-[6px] border-[var(--color-ink)] bg-[var(--color-ink)]">
        <Image
          src={src}
          alt={alt}
          width={471}
          height={1024}
          className="h-auto w-full"
          sizes="(min-width: 1024px) 240px, 60vw"
        />
      </div>
      <figcaption className="mt-5">
        <p className="text-[16px] font-semibold tracking-[-0.02em] text-[var(--color-ink)]">
          {title}
        </p>
        <p className="mt-1.5 text-[14px] leading-relaxed text-[var(--color-neutral-500)]">
          {caption}
        </p>
      </figcaption>
    </figure>
  );
}

export function LandingCustomerApp() {
  return (
    <section
      id="app"
      className="border-y border-[var(--color-hairline)] bg-[var(--color-card)]"
      aria-labelledby="app-heading"
    >
      <div className="mx-auto max-w-6xl px-5 py-14 sm:px-8 sm:py-20">
        <Reveal>
          <p className="text-[12px] font-semibold uppercase tracking-[0.08em] text-[var(--color-primary-500)]">
            No bolso do cliente
          </p>
          <h2
            id="app-heading"
            className="mt-4 max-w-3xl text-[28px] font-extrabold leading-[1.22] tracking-[-0.03em] text-[var(--color-ink)] sm:text-[36px]"
          >
            O vínculo com a sua loja, no bolso do cliente.
          </h2>
          <p className="mt-4 max-w-2xl text-[16px] leading-relaxed text-[var(--color-neutral-500)]">
            O app sustenta o relacionamento. Uma rede de benefícios locais —
            não um mural de descontos.
          </p>
          <StoreBadges className="mt-6" />
        </Reveal>

        <RevealGroup className="mt-10 grid items-stretch gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {shots.map((shot) => (
            <RevealItem key={shot.src} className="h-full">
              <PhoneShot {...shot} />
            </RevealItem>
          ))}
        </RevealGroup>

        <RevealGroup className="mt-6 grid items-stretch gap-5 sm:grid-cols-3">
          {points.map((p) => (
            <RevealItem key={p.title} className="h-full">
              <article className="flex h-full flex-col rounded-[18px] border border-[var(--color-hairline)] bg-[var(--color-bg)] p-5">
                <span className="inline-flex h-10 w-10 items-center justify-center rounded-[12px] bg-[var(--color-primary-50)] text-[var(--color-primary-600)]">
                  <p.Icon size={20} strokeWidth={2.25} aria-hidden />
                </span>
                <h3 className="mt-4 text-[17px] font-semibold tracking-[-0.02em] text-[var(--color-ink)]">
                  {p.title}
                </h3>
                <p className="mt-1.5 text-[14px] leading-relaxed text-[var(--color-neutral-500)]">
                  {p.body}
                </p>
              </article>
            </RevealItem>
          ))}
        </RevealGroup>
      </div>
    </section>
  );
}
