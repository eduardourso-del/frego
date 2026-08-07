'use client';

import type { ReactNode } from 'react';
import { useBusiness } from '@/lib/business-context';
import { StatusBadge } from '@/components/status-badge';
import { Card, Skeleton } from '@/components/ui';

/** Bloqueia o painel enquanto o estabelecimento aguarda aprovação Frego. */
export function PendingGate({ children }: { children: ReactNode }) {
  const { business, loading } = useBusiness();

  if (loading) {
    return (
      <div className="mx-auto max-w-lg px-5 py-16">
        <div className="flex flex-col items-center gap-4">
          <Skeleton className="h-14 w-14 rounded-[16px]" />
          <Skeleton className="h-5 w-40" />
          <Skeleton className="h-4 w-64" />
        </div>
      </div>
    );
  }

  if (business?.status === 'pending') {
    return (
      <div className="mx-auto flex max-w-md flex-col items-center px-5 py-16 text-center md:py-20">
        <Card className="w-full" padding="lg">
          <div
            className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-[16px] text-[22px] font-bold text-white shadow-[var(--shadow-cta)]"
            style={{
              background: business.primaryColor || 'var(--color-primary-500)',
            }}
            aria-hidden
          >
            {business.name.charAt(0).toUpperCase()}
          </div>
          <StatusBadge status="pending" />
          <h1 className="mt-4 text-[24px] font-semibold tracking-[-0.03em] text-[var(--color-ink)]">
            Aguardando aprovação
          </h1>
          <p className="mt-3 text-[15px] leading-relaxed text-[var(--color-neutral-500)]">
            <strong className="font-semibold text-[var(--color-ink)]">
              {business.name}
            </strong>{' '}
            foi cadastrado e está na fila da equipe Frego. Depois da aprovação,
            configure campanhas e o balcão libera.
          </p>
        </Card>
      </div>
    );
  }

  if (business?.status === 'suspended') {
    return (
      <div className="mx-auto flex max-w-md flex-col items-center px-5 py-16 text-center md:py-20">
        <Card className="w-full" padding="lg">
          <StatusBadge status="suspended" />
          <h1 className="mt-4 text-[24px] font-semibold tracking-[-0.03em] text-[var(--color-ink)]">
            Estabelecimento suspenso
          </h1>
          <p className="mt-3 text-[15px] leading-relaxed text-[var(--color-neutral-500)]">
            O cadastro de {business.name} não está ativo. Fale com o suporte
            Frego se precisar de ajuda.
          </p>
        </Card>
      </div>
    );
  }

  return <>{children}</>;
}
