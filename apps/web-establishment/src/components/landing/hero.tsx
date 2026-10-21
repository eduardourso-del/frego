'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { motion, useReducedMotion } from 'framer-motion';
import { FregoWordmark } from '@/components/brand';

const ease = [0.22, 1, 0.36, 1] as const;

const fan = [
  {
    src: '/landing/petshop.jpg',
    alt: 'Cliente com o cachorro escolhendo ração na prateleira de um pet shop',
    width: 1024,
    height: 853,
    rotate: -8,
    shift: -18,
    y: -28,
    z: 1,
    frame: 'w-[16rem] sm:w-[22rem] lg:w-[24rem]',
  },
  {
    src: '/landing/loja-balcao.jpg',
    alt: 'Dona da loja no balcão, consultando o painel da Frego no notebook',
    width: 1024,
    height: 576,
    rotate: 4,
    shift: 8,
    y: 20,
    z: 2,
    frame: 'w-[18rem] sm:w-[26rem] lg:w-[30rem]',
  },
] as const;

function HeroFan() {
  const reduceMotion = useReducedMotion();
  const [spread, setSpread] = useState(false);
  const [opened, setOpened] = useState(false);
  const scale = spread ? 1.18 : 1;

  useEffect(() => {
    const timer = window.setTimeout(() => setOpened(true), 900);
    return () => window.clearTimeout(timer);
  }, []);

  return (
    <div
      className="relative h-[420px] w-full sm:h-[480px]"
      onMouseEnter={() => setSpread(true)}
      onMouseLeave={() => setSpread(false)}
    >
      {fan.map((card, i) => (
        <motion.figure
          key={card.src}
          className={`absolute top-1/2 left-1/2 origin-bottom overflow-hidden rounded-[20px] border border-[var(--color-hairline)] bg-[var(--color-card)] shadow-[var(--shadow-raised)] ${card.frame}`}
          style={{ zIndex: card.z }}
          initial={
            reduceMotion
              ? false
              : { opacity: 0, rotate: 0, x: '-50%', y: 'calc(-50% + 36px)' }
          }
          animate={{
            opacity: 1,
            rotate: card.rotate * scale,
            x: `calc(-50% + ${card.shift * scale}%)`,
            y: `calc(-50% + ${card.y}px)`,
          }}
          transition={
            reduceMotion
              ? { duration: 0 }
              : {
                  type: 'spring',
                  stiffness: 160,
                  damping: 18,
                  delay: opened ? 0 : 0.18 + i * 0.07,
                }
          }
        >
          <Image
            src={card.src}
            alt={card.alt}
            width={card.width}
            height={card.height}
            priority={card.z === 2}
            unoptimized
            className="h-auto w-full"
            sizes="(min-width: 1024px) 480px, 70vw"
          />
        </motion.figure>
      ))}
    </div>
  );
}

const businesses = [
  'Restaurante',
  'Bar',
  'Padaria',
  'Café',
  'Salão',
  'Pet',
  'Academia',
  'Loja',
];

export function LandingHero() {
  return (
    <section
      id="topo"
      className="relative overflow-hidden border-b border-[var(--color-hairline)]"
    >
      <div
        className="pointer-events-none absolute inset-0"
        aria-hidden
        style={{
          background: `
            radial-gradient(ellipse 80% 60% at 70% 20%, color-mix(in srgb, var(--color-primary-500) 14%, transparent), transparent 55%),
            linear-gradient(180deg, var(--color-primary-50) 0%, var(--color-bg) 72%)
          `,
        }}
      />
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.35]"
        aria-hidden
        style={{
          backgroundImage:
            'radial-gradient(circle at 1px 1px, rgba(7,7,7,0.06) 1px, transparent 0)',
          backgroundSize: '24px 24px',
        }}
      />

      <div className="relative mx-auto grid max-w-6xl items-center gap-8 px-5 pb-8 pt-10 sm:px-8 sm:pb-12 sm:pt-12 lg:min-h-[680px] lg:grid-cols-[minmax(0,30rem)_1fr] lg:gap-10 lg:py-14">
        <div>
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, ease }}
          >
            <FregoWordmark height={64} />
          </motion.div>

          <motion.h1
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.65, delay: 0.08, ease }}
            className="mt-8 max-w-xl font-serif text-[32px] leading-[1.12] tracking-[-0.025em] text-[var(--color-ink)] sm:text-[40px] lg:text-[44px]"
          >
            Transforme clientes em fregueses
          </motion.h1>

          <motion.p
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.16, ease }}
            className="mt-5 max-w-lg text-[16px] leading-relaxed text-[var(--color-neutral-500)] sm:text-[17px]"
          >
            A Frego entende o comportamento dos seus clientes e mostra quem
            merece sua atenção — para você vender mais, trazer clientes de
            volta e construir relacionamento sem precisar ser especialista em
            marketing.
          </motion.p>

          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.26, ease }}
            className="mt-8 flex flex-col gap-3 sm:flex-row sm:items-center"
          >
            <Link
              href="/register"
              className="inline-flex min-h-11 items-center justify-center rounded-[8px] bg-[var(--color-primary-500)] px-5 text-[14px] font-extrabold text-[var(--color-on-primary)] transition-[transform,background] hover:bg-[var(--color-primary-600)] active:scale-[0.98]"
            >
              Começar agora
            </Link>
            <a
              href="#como-funciona"
              className="inline-flex min-h-11 items-center justify-center rounded-[8px] border border-[var(--color-control)] bg-transparent px-5 text-[14px] font-semibold text-[var(--color-ink)] transition-colors hover:bg-[var(--color-primary-50)]"
            >
              Ver como funciona
            </a>
          </motion.div>

          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.6, delay: 0.4 }}
            className="mt-6"
          >
            <p className="text-[13px] leading-relaxed text-[var(--color-neutral-500)]">
              Feito para o pequeno negócio local — sem equipe de marketing, CRM
              ou TI.
            </p>
            <ul className="mt-2.5 flex flex-wrap gap-1.5">
              {businesses.map((label) => (
                <li
                  key={label}
                  className="rounded-full border border-[var(--color-primary-200)] bg-[var(--color-primary-50)] px-2.5 py-1 text-[12px] font-semibold text-[var(--color-primary-600)]"
                >
                  {label}
                </li>
              ))}
            </ul>
          </motion.div>
        </div>

        <HeroFan />
      </div>
    </section>
  );
}
