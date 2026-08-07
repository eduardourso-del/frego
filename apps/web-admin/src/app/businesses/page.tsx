'use client';

import { useCallback, useEffect, useState } from 'react';
import { AdminShell } from '@/components/admin-shell';
import { useAuth } from '@/lib/auth-context';
import { API_URL } from '@/lib/api';

type BusinessRow = {
  id: string;
  name: string;
  type: string;
  status: string;
  slug: string | null;
  createdAt: string;
  owner: { email: string | null; displayName: string | null } | null;
  location: { name: string; address: string | null } | null;
};

const STATUS_LABEL: Record<string, string> = {
  pending: 'Pendente',
  trial: 'Trial',
  active: 'Ativo',
  past_due: 'Inadimplente',
  suspended: 'Suspenso',
};

export default function BusinessesPage() {
  const { getToken } = useAuth();
  const [filter, setFilter] = useState<'pending' | 'all'>('pending');
  const [rows, setRows] = useState<BusinessRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const token = await getToken();
      const qs = filter === 'pending' ? '?status=pending' : '';
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
  }, [filter, getToken]);

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
            Negócios
          </h1>
          <p className="mt-1 text-[15px] text-[var(--color-neutral-500)]">
            Aprove cadastros novos ou veja a base completa.
          </p>
        </div>
        <div className="flex gap-2">
          {(
            [
              { key: 'pending' as const, label: 'Pendentes' },
              { key: 'all' as const, label: 'Todos' },
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
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="text-[18px] font-semibold">{b.name}</h2>
                    <span className="rounded-[6px] bg-[var(--color-bg)] px-2 py-0.5 text-[12px] font-semibold uppercase tracking-[0.04em] text-[var(--color-neutral-500)]">
                      {STATUS_LABEL[b.status] ?? b.status}
                    </span>
                  </div>
                  <p className="mt-1 text-[14px] text-[var(--color-neutral-500)]">
                    {b.type}
                    {b.slug ? ` · /${b.slug}` : ''}
                  </p>
                  {b.owner && (
                    <p className="mt-2 text-[14px] text-[var(--color-neutral-700)]">
                      Dono:{' '}
                      {b.owner.displayName ?? '—'}{' '}
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
                {b.status === 'pending' && (
                  <div className="flex gap-2">
                    <button
                      type="button"
                      disabled={busyId === b.id}
                      onClick={() => act(b.id, 'approve')}
                      className="min-h-10 rounded-[10px] bg-[var(--color-primary-500)] px-4 text-[14px] font-semibold text-white disabled:opacity-60"
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
                  </div>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </AdminShell>
  );
}
