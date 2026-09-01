'use client';

import Image from 'next/image';
import { Gift, Smartphone, Store } from 'lucide-react';
import { Reveal, RevealGroup, RevealItem } from '@/components/landing/reveal';

const shots = [
  {
    src: '/landing/app-lojas.png',
    alt: 'App Frego — lista de lojas, favoritas e prêmios prontos',
    title: 'Lojas',
    caption:
      'Todas as casas num só lugar. Favoritas, prêmio pronto ou quase lá: o cliente acha a sua loja sem perguntar no caixa.',
  },
  {
    src: '/landing/app-loja.png',
    alt: 'App Frego — ficha da loja com carimbos, pontos e cashback',
    title: 'A sua casa',
    caption:
      'Carimbos, pontos e cashback da loja, cada um com a própria validade. O cliente vê o saldo e o que ainda pode ganhar.',
  },
  {
    src: '/landing/app-premios.png',
    alt: 'App Frego — prêmios prontos para resgatar no caixa',
    title: 'Prêmios',
    caption:
      'Quando chega a meta, o resgate é no aplicativo. Ele mostra o voucher no caixa — sem cartão de papel.',
  },
] as const;

const points = [
  {
    title: 'O progresso cabe no bolso',
    body: 'O freguês abre o app e sabe quantos carimbos faltam, quantos pontos tem e se o cashback está esperando. Você não precisa explicar o cartão a cada visita.',
    Icon: Smartphone,
  },
  {
    title: 'O prêmio é da sua casa',
    body: 'Ele vê a foto, o nome e a loja certa: o pão de queijo, as fritas, a sobremesa — não um desconto genérico de marketplace.',
    Icon: Store,
  },
  {
    title: 'Resgate no caixa, na hora',
    body: 'Quando está pronto para resgatar, vira um botão. O cliente mostra a tela; o balcão confirma. A campanha que você montou fecha o ciclo.',
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
    <figure className="flex h-full flex-col rounded-[20px] border border-[var(--color-hairline)] bg-[var(--color-card)] p-4 shadow-[var(--shadow-card)] sm:p-5">
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
      className="mx-auto max-w-6xl px-5 py-14 sm:px-8 sm:py-20"
      aria-labelledby="app-heading"
    >
      <Reveal>
          <p className="text-[12px] font-semibold uppercase tracking-[0.08em] text-[var(--color-primary-500)]">
            No bolso
          </p>
          <h2
            id="app-heading"
            className="mt-4 max-w-3xl text-[28px] font-extrabold leading-[1.22] tracking-[-0.03em] text-[var(--color-ink)] sm:text-[36px]"
          >
            O cartão fica no bolso. O motivo fica na tela.
          </h2>
          <p className="mt-4 max-w-2xl text-[16px] leading-relaxed text-[var(--color-neutral-500)]">
            Você escolheu o motivo e a audiência. O freguês abre o Frego e vê
            as lojas, o saldo e o prêmio pronto. Sem cartão de papel. Sem
            perguntar no caixa quantos carimbos faltam. A casa continua sendo
            sua — o aplicativo só sustenta o relacionamento.
          </p>
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
              <article className="flex h-full flex-col rounded-[20px] border border-[var(--color-hairline)] bg-[var(--color-card)] p-5">
                <span className="inline-flex h-10 w-10 items-center justify-center rounded-[12px] bg-[var(--color-primary-50)] text-[var(--color-primary-600)]">
                  <p.Icon size={20} strokeWidth={2.25} aria-hidden />
                </span>
                <h3 className="mt-4 text-[16px] font-semibold tracking-[-0.02em] text-[var(--color-ink)]">
                  {p.title}
                </h3>
                <p className="mt-1.5 text-[14px] leading-relaxed text-[var(--color-neutral-500)]">
                  {p.body}
                </p>
              </article>
            </RevealItem>
          ))}
        </RevealGroup>
    </section>
  );
}
