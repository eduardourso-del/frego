'use client';

import Link from 'next/link';
import type { ReactNode } from 'react';
import type { PlanFeature, PlanTier } from '@/lib/plans';
import { FEATURE_LABEL, PLAN_LABEL, tierForFeature } from '@/lib/plans';

export function FeatureLocked({
  feature,
  owner,
  currentTier,
  children,
}: {
  feature: PlanFeature;
  owner: boolean;
  currentTier?: PlanTier | null;
  children?: ReactNode;
}) {
  const tier = tierForFeature(feature);
  const current = currentTier ? PLAN_LABEL[currentTier] : null;
  const card = (
    <div className="w-full max-w-lg rounded-[16px] border border-[var(--color-hairline)] bg-[var(--color-card)]/95 p-6 shadow-[var(--shadow-card)] backdrop-blur-md">
      <p className="text-[12px] font-semibold uppercase tracking-[0.06em] text-[var(--color-neutral-400)]">
        {current ? `Plano ${current}` : 'Plano'}
      </p>
      <h2 className="mt-2 text-[22px] font-semibold tracking-[-0.03em] text-[var(--color-ink)]">
        {FEATURE_LABEL[feature]} faz parte do {PLAN_LABEL[tier]}
      </h2>
      <p className="mt-3 text-[15px] leading-relaxed text-[var(--color-neutral-500)]">
        {owner
          ? `O que já existe continua guardado. Atualize o Plano para ${PLAN_LABEL[tier]} e volte a usar ${FEATURE_LABEL[feature]}.`
          : 'Quem é dono do estabelecimento precisa atualizar o Plano para liberar isto.'}
      </p>
      {owner ? (
        <Link
          href="/settings#plano"
          className="mt-5 inline-flex min-h-11 items-center justify-center rounded-[12px] bg-[var(--color-primary-500)] px-4 text-[14px] font-semibold text-white"
        >
          Atualizar Plano
        </Link>
      ) : null}
    </div>
  );

  if (!children) return <div className="mx-auto max-w-lg px-4 py-10">{card}</div>;

  return (
    <div className="relative">
      <div className="pointer-events-none select-none blur-md" aria-hidden inert>
        {children}
      </div>
      <div className="absolute inset-0 flex items-start justify-center px-4 py-8">
        {card}
      </div>
    </div>
  );
}

export function BillingLocked({ owner }: { owner: boolean }) {
  return (
    <div className="mx-auto flex max-w-md flex-col items-center px-5 py-16 text-center">
      <div className="w-full rounded-[16px] border border-[var(--color-hairline)] bg-[var(--color-card)] p-6 shadow-[var(--shadow-card)]">
        <h1 className="text-[24px] font-semibold tracking-[-0.03em] text-[var(--color-ink)]">
          Atualize o Plano
        </h1>
        <p className="mt-3 text-[15px] leading-relaxed text-[var(--color-neutral-500)]">
          {owner
            ? 'O balcão e o resto do Frego ficam fechados até o pagamento do Plano confirmar. A cobrança está em Configurações.'
            : 'Quem é dono do estabelecimento precisa atualizar o Plano. Até lá, o balcão fica fechado.'}
        </p>
        {owner ? (
          <Link
            href="/settings#plano"
            className="mt-5 inline-flex min-h-11 items-center justify-center rounded-[12px] bg-[var(--color-primary-500)] px-4 text-[14px] font-semibold text-white"
          >
            Atualizar Plano
          </Link>
        ) : null}
      </div>
    </div>
  );
}
