'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { AdminShell } from '@/components/admin-shell';
import { BusinessPerformanceTable } from '@/components/business-performance-table';
import type { BusinessPerformanceRow } from '@/components/business-performance-table';
import { useAuth } from '@/lib/auth-context';
import { API_URL } from '@/lib/api';

export default function BusinessesPage() {
  const { getToken } = useAuth();
  const [filter, setFilter] = useState<'pending' | 'all'>('all');
  const [q, setQ] = useState('');
  const [debouncedQ, setDebouncedQ] = useState('');
  const [rows, setRows] = useState<BusinessPerformanceRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const hasRows = useRef(false);

  const load = useCallback(async () => {
    if (!hasRows.current) setLoading(true);
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
      const next = json.businesses ?? [];
      hasRows.current = next.length > 0;
      setRows(next);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro');
      hasRows.current = false;
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

  async function remove(id: string, name: string) {
    const ok = window.confirm(
      `Excluir ${name}?\n\nCampanhas, pesquisas, equipe e o histórico deste estabelecimento somem. A conta do cliente na Frego permanece.`,
    );
    if (!ok) return;
    setBusyId(id);
    setError(null);
    try {
      const token = await getToken();
      const res = await fetch(`${API_URL}/admin/businesses/${id}`, {
        method: 'DELETE',
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.error ?? 'Falha ao excluir');
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro');
    } finally {
      setBusyId(null);
    }
  }

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
            Campanhas ativas e o movimento dos últimos 30 dias.
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
        <BusinessPerformanceTable
          rows={rows}
          busyId={busyId}
          onAct={(id, action) => void act(id, action)}
          onDelete={(id, name) => void remove(id, name)}
        />
      )}
    </AdminShell>
  );
}
