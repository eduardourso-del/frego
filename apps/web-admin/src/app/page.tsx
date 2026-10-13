'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { AdminShell } from '@/components/admin-shell';
import { BusinessPerformanceTable } from '@/components/business-performance-table';
import type { BusinessPerformanceRow } from '@/components/business-performance-table';
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
  const [rows, setRows] = useState<BusinessPerformanceRow[]>([]);

  useEffect(() => {
    void (async () => {
      try {
        const token = await getToken();
        const headers: Record<string, string> = {};
        if (token) headers.Authorization = `Bearer ${token}`;
        const [statsRes, businessesRes] = await Promise.all([
          fetch(`${API_URL}/admin/stats`, { headers }),
          fetch(`${API_URL}/admin/businesses`, { headers }),
        ]);
        const statsJson = await statsRes.json();
        const businessesJson = await businessesRes.json();
        if (statsRes.ok) setStats(statsJson.stats);
        if (businessesRes.ok) setRows(businessesJson.businesses ?? []);
      } catch {
        /* ignore */
      }
    })();
  }, [getToken]);

  const kpis = [
    {
      label: 'Estabelecimentos ativos',
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
      <section className="mt-10">
        <h2 className="mb-4 text-[20px] font-semibold tracking-[-0.02em]">
          Movimento recente
        </h2>
        {rows.length === 0 ? (
          <p className="text-[15px] text-[var(--color-neutral-500)]">
            {stats ? 'Nenhum estabelecimento.' : 'Carregando…'}
          </p>
        ) : (
          <BusinessPerformanceTable rows={rows} />
        )}
      </section>
    </AdminShell>
  );
}
