'use client';

import Link from 'next/link';
import { motion } from 'framer-motion';
import { ProductFrame } from '@/components/landing/product-frame';
import { FregoWordmark } from '@/components/brand';

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
            'radial-gradient(circle at 1px 1px, rgba(22,24,29,0.06) 1px, transparent 0)',
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

          <motion.p
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.55, delay: 0.06, ease }}
            className="mt-6 text-[12px] font-semibold uppercase tracking-[0.08em] text-[var(--color-primary-500)]"
          >
            Ticket médio e faturamento
          </motion.p>

          <motion.h1
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.65, delay: 0.1, ease }}
            className="mt-3 max-w-xl text-[28px] font-extrabold leading-[1.15] tracking-[-0.03em] text-[var(--color-ink)] sm:text-[36px] lg:text-[40px]"
          >
            Transforme clientes em fregueses que voltam e gastam mais.
          </motion.h1>

          <motion.p
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.18, ease }}
            className="mt-4 max-w-lg text-[16px] leading-relaxed text-[var(--color-neutral-500)] sm:text-[17px]"
          >
            O Frego ajuda o seu estabelecimento a subir o ticket médio e
            melhorar o faturamento com as ferramentas que você usa no dia a
            dia: campanhas, WhatsApp e audiências que fazem a pessoa voltar —
            e pedir um pouco mais na próxima visita. Sem marketplace, sem
            cartão de papel e sem desconto o tempo todo.
          </motion.p>

          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.24, ease }}
            className="mt-8 flex flex-col gap-3 sm:flex-row sm:items-center"
          >
            <Link
              href="/register"
              className="inline-flex min-h-11 items-center justify-center rounded-[8px] bg-[var(--color-primary-500)] px-5 text-[14px] font-extrabold text-[var(--color-on-primary)] transition-[transform,background] hover:bg-[var(--color-primary-600)] active:scale-[0.98]"
            >
              Quero criar fregueses
            </Link>
            <a
              href="#como-funciona"
              className="inline-flex min-h-11 items-center justify-center rounded-[8px] border border-[var(--color-control)] bg-transparent px-5 text-[14px] font-extrabold text-[var(--color-primary-500)] transition-colors hover:bg-[var(--color-primary-50)]"
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
              Feito para o estabelecimento local que quer faturar mais com quem
              já atravessou a porta.
            </p>
            <ul className="mt-2.5 flex flex-wrap gap-1.5">
              {['Padaria', 'Salão', 'Farmácia', 'Pet', 'Restaurante'].map(
                (label) => (
                  <li
                    key={label}
                    className="rounded-full border border-[var(--color-primary-200)] bg-[var(--color-primary-50)] px-2.5 py-1 text-[12px] font-semibold text-[var(--color-primary-600)]"
                  >
                    {label}
                  </li>
                ),
              )}
            </ul>
          </motion.div>
        </div>

        <motion.div
          initial={{ opacity: 0, y: 36, scale: 0.98 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ duration: 0.85, delay: 0.18, ease }}
        >
          <ProductFrame
            src="/landing/painel-hoje.png"
            alt="Painel Frego com ação recomendada, campanhas e indicadores do dia"
            label="frego.app.br/dashboard"
            caption="Painel do estabelecimento — quem voltou, quem sumiu e o que fazer agora"
            width={942}
            height={1024}
            priority
          />
        </motion.div>
      </div>
    </section>
  );
}
