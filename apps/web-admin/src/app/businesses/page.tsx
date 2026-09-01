'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { AdminShell } from '@/components/admin-shell';
import { useAuth } from '@/lib/auth-context';
import { API_URL } from '@/lib/api';
import { STATUS_LABEL, TYPE_LABEL } from '@/lib/labels';

type BusinessRow = {
  id: string;
  name: string;
  type: string;
  status: string;
  slug: string | null;
  slogan: string | null;
  logoUrl: string | null;
  primaryColor: string;
  createdAt: string;
  owner: { email: string | null; displayName: string | null } | null;
  location: { name: string; address: string | null } | null;
  customers: number;
  campaigns: number;
};

export default function BusinessesPage() {
  const { getToken } = useAuth();
  const [filter, setFilter] = useState<'pending' | 'all'>('all');
  const [q, setQ] = useState('');
  const [debouncedQ, setDebouncedQ] = useState('');
  const [rows, setRows] = useState<BusinessRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const token = await getToken();
      const params = new URLSearchParams();
      if (filter === 'pending') params.set('status', 'pending');
      if (debouncedQ.trim()) params.set('q', debouncedQ.trim());
      const qs = params.toString() ? `?${params.toString()}` : '';
      const res = await fetch(`${API_URL}/admin/businesses${qs}`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? 'Falha ao listar');
      setRows(json.businesses ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro');
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [filter, debouncedQ, getToken]);

  useEffect(() => {
    const timer = window.setTimeout(() => setDebouncedQ(q), 300);
    return () => window.clearTimeout(timer);
  }, [q]);

  useEffect(() => {
    void load();
  }, [load]);

  async function act(id: string, action: 'approve' | 'reject') {
    setBusyId(id);
    try {
      const token = await getToken();
      const res = await fetch(`${API_URL}/admin/businesses/${id}/${action}`, {
        method: 'POST',
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? 'Falha');
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro');
    } finally {
      setBusyId(null);
    }
  }

  return (
    <AdminShell>
      <header className="mb-8 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-[28px] font-semibold tracking-[-0.02em]">
            Estabelecimentos
          </h1>
          <p className="mt-1 text-[15px] text-[var(--color-neutral-500)]">
            Veja os dados de cada loja e edite o que precisar.
          </p>
        </div>
        <div className="flex gap-2">
          {(
            [
              { key: 'all' as const, label: 'Todos' },
              { key: 'pending' as const, label: 'Pendentes' },
            ] as const
          ).map((tab) => (
            <button
              key={tab.key}
              type="button"
              onClick={() => setFilter(tab.key)}
              className={`min-h-10 rounded-[10px] px-4 text-[14px] font-semibold ${
                filter === tab.key
                  ? 'bg-[var(--color-primary-500)] text-white'
                  : 'border border-[var(--color-hairline)] bg-[var(--color-card)] text-[var(--color-neutral-700)]'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </header>

      <label className="mb-6 block text-[13px] font-semibold uppercase tracking-[0.04em]">
        Buscar
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Nome, slug ou e-mail do dono"
          className="mt-2 min-h-11 w-full max-w-md rounded-[8px] border border-[var(--color-neutral-200)] bg-[var(--color-card)] px-3 text-[16px] font-normal normal-case tracking-normal"
        />
      </label>

      {error && (
        <p className="mb-4 text-[13px] text-[var(--color-danger)]" role="alert">
          {error}
        </p>
      )}

      {loading ? (
        <p className="text-[15px] text-[var(--color-neutral-500)]">
          Carregando…
        </p>
      ) : rows.length === 0 ? (
        <p className="rounded-[16px] border border-[var(--color-hairline)] bg-[var(--color-card)] p-8 text-[15px] text-[var(--color-neutral-500)]">
          {filter === 'pending'
            ? 'Nenhum estabelecimento aguardando aprovação.'
            : q.trim()
              ? 'Nenhum estabelecimento encontrado.'
              : 'Nenhum negócio cadastrado.'}
        </p>
      ) : (
        <ul className="flex flex-col gap-3">
          {rows.map((b) => (
            <li
              key={b.id}
              className="rounded-[16px] border border-[var(--color-hairline)] bg-[var(--color-card)] p-5 shadow-[var(--shadow-card)]"
            >
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div className="flex min-w-0 flex-1 gap-3">
                  <div
                    className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-[12px] text-[16px] font-bold text-white"
                    style={{ background: b.primaryColor }}
                  >
                    {b.logoUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={b.logoUrl}
                        alt=""
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      b.name.trim().charAt(0).toUpperCase()
                    )}
                  </div>
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <h2 className="text-[18px] font-semibold">{b.name}</h2>
                      <span className="rounded-[6px] bg-[var(--color-bg)] px-2 py-0.5 text-[12px] font-semibold uppercase tracking-[0.04em] text-[var(--color-neutral-500)]">
                        {STATUS_LABEL[b.status] ?? b.status}
                      </span>
                    </div>
                    <p className="mt-1 text-[14px] text-[var(--color-neutral-500)]">
                      {TYPE_LABEL[b.type] ?? b.type}
                      {b.slug ? ` · /${b.slug}` : ''}
                      {` · ${b.customers} clientes`}
                    </p>
                    {b.slogan && (
                      <p className="mt-1 text-[14px] text-[var(--color-neutral-600)]">
                        {b.slogan}
                      </p>
                    )}
                    {b.owner && (
                      <p className="mt-2 text-[14px] text-[var(--color-neutral-700)]">
                        Dono: {b.owner.displayName ?? '—'}{' '}
                        <span className="text-[var(--color-neutral-400)]">
                          ({b.owner.email})
                        </span>
                      </p>
                    )}
                    {b.location && (
                      <p className="mt-1 text-[13px] text-[var(--color-neutral-400)]">
                        {b.location.name}
                        {b.location.address ? ` — ${b.location.address}` : ''}
                      </p>
                    )}
                    <p className="mt-2 text-[12px] text-[var(--color-neutral-400)]">
                      Cadastro:{' '}
                      {new Date(b.createdAt).toLocaleString('pt-BR')}
                    </p>
                  </div>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Link
                    href={`/businesses/${b.id}`}
                    className="inline-flex min-h-10 items-center rounded-[10px] bg-[var(--color-primary-500)] px-4 text-[14px] font-semibold text-white"
                  >
                    Ver / editar
                  </Link>
                  {b.status === 'pending' && (
                    <>
                      <button
                        type="button"
                        disabled={busyId === b.id}
                        onClick={() => act(b.id, 'approve')}
                        className="min-h-10 rounded-[10px] border border-[var(--color-hairline)] px-4 text-[14px] font-semibold text-[var(--color-neutral-700)] disabled:opacity-60"
                      >
                        Aprovar
                      </button>
                      <button
                        type="button"
                        disabled={busyId === b.id}
                        onClick={() => act(b.id, 'reject')}
                        className="min-h-10 rounded-[10px] border border-[var(--color-hairline)] px-4 text-[14px] font-semibold text-[var(--color-neutral-700)] disabled:opacity-60"
                      >
                        Recusar
                      </button>
                    </>
                  )}
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </AdminShell>
  );
}
