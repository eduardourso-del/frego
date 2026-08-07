'use client';

import Link from 'next/link';
import { motion } from 'framer-motion';
import {
  DashboardSketch,
  MockupPlaceholder,
} from '@/components/landing/mockup-placeholder';

const ease = [0.22, 1, 0.36, 1] as const;

/**
 * Hero: one composition — brand, outcome headline, single CTA group,
 * and a dominant product visual. No stats strip / card grid above the fold.
 */
export function LandingHero() {
  return (
    <section
      id="topo"
      className="relative overflow-hidden border-b border-[var(--color-hairline)]"
    >
      {/* Full-bleed atmosphere — not a flat fill */}
      <div
        className="pointer-events-none absolute inset-0"
        aria-hidden
        style={{
          background: `
            radial-gradient(ellipse 80% 60% at 70% 20%, rgba(59,91,219,0.16), transparent 55%),
            radial-gradient(ellipse 50% 40% at 10% 80%, rgba(31,157,107,0.08), transparent 50%),
            linear-gradient(180deg, #EEF1FD 0%, var(--color-bg) 72%)
          `,
        }}
      />
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.35]"
        aria-hidden
        style={{
          backgroundImage:
            'radial-gradient(circle at 1px 1px, rgba(22,24,29,0.06) 1px, transparent 0)',
          backgroundSize: '24px 24px',
        }}
      />

      <div className="relative mx-auto grid max-w-6xl gap-12 px-5 pb-16 pt-10 sm:px-8 sm:pb-20 sm:pt-14 lg:grid-cols-[1.05fr_0.95fr] lg:items-end lg:gap-10 lg:pb-24 lg:pt-16">
        <div>
          <motion.p
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, ease }}
            className="text-[48px] font-semibold leading-none tracking-[-0.04em] text-[var(--color-ink)] sm:text-[64px] lg:text-[72px]"
          >
            Frego
          </motion.p>

          <motion.h1
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.65, delay: 0.08, ease }}
            className="mt-5 max-w-xl text-[28px] font-semibold leading-[1.15] tracking-[-0.03em] text-[var(--color-ink)] sm:text-[36px] lg:text-[40px]"
          >
            Transforme clientes em fregueses.
          </motion.h1>

          <motion.p
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.16, ease }}
            className="mt-4 max-w-lg text-[16px] leading-relaxed text-[var(--color-neutral-500)] sm:text-[17px]"
          >
            O Frego ajuda negócios locais a criar relacionamentos que fazem seus
            clientes voltar — sem depender de marketplaces, cartões de papel ou
            desconto o tempo todo.
          </motion.p>

          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.24, ease }}
            className="mt-8 flex flex-col gap-3 sm:flex-row sm:items-center"
          >
            <Link
              href="/register"
              className="inline-flex min-h-12 items-center justify-center rounded-[14px] bg-[var(--color-primary-500)] px-6 text-[15px] font-semibold text-white shadow-[var(--shadow-cta)] transition-[transform,background] hover:bg-[var(--color-primary-600)] active:scale-[0.98]"
            >
              Quero criar fregueses
            </Link>
            <a
              href="#como-funciona"
              className="inline-flex min-h-12 items-center justify-center rounded-[14px] border border-[var(--color-neutral-200)] bg-[var(--color-card)] px-6 text-[15px] font-semibold text-[var(--color-ink)] transition-colors hover:bg-[var(--color-neutral-100)]"
            >
              Ver como funciona
            </a>
          </motion.div>

          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.6, delay: 0.4 }}
            className="mt-6 text-[13px] text-[var(--color-neutral-400)]"
          >
            Para restaurantes, cafés, pizzarias e lojas locais ·{' '}
            <span className="font-semibold text-[var(--color-neutral-700)]">
              [DADO A CONFIRMAR]
            </span>{' '}
            negócios já usam
          </motion.p>
        </div>

        <motion.div
          initial={{ opacity: 0, y: 36, scale: 0.98 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ duration: 0.85, delay: 0.18, ease }}
          className="lg:-mb-4"
        >
          <MockupPlaceholder
            label="Painel · Frego"
            caption="[MOCKUP] Dashboard do estabelecimento — substitua por captura real"
          >
            <DashboardSketch />
          </MockupPlaceholder>
        </motion.div>
      </div>
    </section>
  );
}
