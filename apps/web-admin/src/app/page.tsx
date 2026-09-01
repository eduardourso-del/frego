'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { AdminShell } from '@/components/admin-shell';
import { useAuth } from '@/lib/auth-context';
import { API_URL } from '@/lib/api';

type Stats = {
  activeBusinesses: number;
  pendingApprovals: number;
  customers: number;
  stampsToday: number;
  mrrCents: number;
};

function formatBrl(cents: number) {
  return (cents / 100).toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  });
}

export default function AdminHomePage() {
  const { getToken } = useAuth();
  const [stats, setStats] = useState<Stats | null>(null);

  useEffect(() => {
    void (async () => {
      try {
        const token = await getToken();
        const res = await fetch(`${API_URL}/admin/stats`, {
          headers: token ? { Authorization: `Bearer ${token}` } : {},
        });
        const json = await res.json();
        if (res.ok) setStats(json.stats);
      } catch {
        /* ignore */
      }
    })();
  }, [getToken]);

  const kpis = [
    {
      label: 'Negócios ativos',
      value: stats ? String(stats.activeBusinesses) : '—',
    },
    {
      label: 'Aguardando aprovação',
      value: stats ? String(stats.pendingApprovals) : '—',
    },
    {
      label: 'MRR',
      value: stats ? formatBrl(stats.mrrCents) : '—',
    },
    {
      label: 'Clientes na plataforma',
      value: stats ? String(stats.customers) : '—',
    },
    {
      label: 'Carimbos hoje',
      value: stats ? String(stats.stampsToday) : '—',
    },
  ];

  return (
    <AdminShell>
      <header className="mb-8 flex min-h-[60px] flex-wrap items-center justify-between gap-4">
        <h1 className="text-[32px] font-extrabold tracking-[-0.025em]">
          Visão geral da plataforma
        </h1>
        <Link
          href="/businesses"
          className="inline-flex min-h-11 items-center rounded-[8px] bg-[var(--color-primary-500)] px-5 text-[14px] font-extrabold text-[var(--color-on-primary)]"
        >
          Estabelecimentos
        </Link>
      </header>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {kpis.map((kpi) => (
          <div
            key={kpi.label}
            className="rounded-[16px] border border-[var(--color-hairline)] bg-[var(--color-card)] p-5 shadow-[var(--shadow-card)]"
          >
            <p className="text-[13px] font-semibold uppercase tracking-[0.04em] text-[var(--color-neutral-400)]">
              {kpi.label}
            </p>
            <p className="mt-2 text-[28px] font-semibold tracking-[-0.02em]">
              {kpi.value}
            </p>
          </div>
        ))}
      </div>
      {stats && stats.pendingApprovals > 0 && (
        <p className="mt-8 text-[15px] text-[var(--color-neutral-500)]">
          Há{' '}
          <Link
            href="/businesses"
            className="font-semibold text-[var(--color-primary-500)]"
          >
            {stats.pendingApprovals}{' '}
            {stats.pendingApprovals === 1
              ? 'estabelecimento pendente'
              : 'estabelecimentos pendentes'}
          </Link>
          .
        </p>
      )}
    </AdminShell>
  );
}
