'use client';

import Link from 'next/link';
import { motion } from 'framer-motion';
import { ProductFrame } from '@/components/landing/product-frame';
import { FregoWordmark } from '@/components/brand';

const ease = [0.22, 1, 0.36, 1] as const;

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

      <div className="relative mx-auto grid max-w-6xl gap-12 px-5 pb-12 pt-10 sm:px-8 sm:pb-16 sm:pt-12 lg:grid-cols-[1.05fr_0.95fr] lg:items-start lg:gap-10 lg:pb-16 lg:pt-14">
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
            transition={{ duration: 0.6, delay: 0.14, ease }}
            className="mt-4 max-w-lg text-[20px] font-semibold leading-snug tracking-[-0.02em] text-[var(--color-ink)] sm:text-[22px]"
          >
            Quem chamar hoje para o cliente voltar.
          </motion.p>

          <motion.p
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.2, ease }}
            className="mt-4 max-w-lg text-[16px] leading-relaxed text-[var(--color-neutral-500)] sm:text-[17px]"
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

        <motion.div
          initial={{ opacity: 0, y: 36, scale: 0.98 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ duration: 0.85, delay: 0.18, ease }}
        >
          <ProductFrame
            src="/landing/painel.png"
            alt="Painel Frego com clientes ativos, atividade no período e retenção por mês de cadastro"
            label="frego.app.br/dashboard"
            caption="Atividade, retorno e retenção — o que aconteceu com os clientes no período"
            width={1024}
            height={859}
            priority
          />
        </motion.div>
      </div>
    </section>
  );
}
