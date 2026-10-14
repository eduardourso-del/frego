'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useAuth } from '@/lib/auth-context';
import { API_URL } from '@/lib/api';

type CustomerTag = {
  id: string;
  name: string;
  color: string | null;
};

type CustomerRow = {
  customerId: string;
  membershipId: string;
  displayName: string | null;
  phoneE164: string;
  isVip: boolean;
  associatedAt: string;
  tags: CustomerTag[];
  stats: {
    visits: number;
    lastVisitAt: string | null;
    spendCents: number;
  };
};

function displayPhone(e164: string) {
  const digits = e164.replace(/\D/g, '');
  const local = digits.startsWith('55') ? digits.slice(2) : digits;
  if (local.length === 11) {
    return `(${local.slice(0, 2)}) ${local.slice(2, 7)}-${local.slice(7)}`;
  }
  if (local.length === 10) {
    return `(${local.slice(0, 2)}) ${local.slice(2, 6)}-${local.slice(6)}`;
  }
  return e164;
}

function formatWhen(iso: string | null) {
  if (!iso) return 'Sem visita';
  return new Date(iso).toLocaleString('pt-BR', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function formatBrl(cents: number) {
  return (cents / 100).toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  });
}

function tagStyle(color: string | null) {
  const hex = color && /^#[0-9A-Fa-f]{6}$/.test(color) ? color : '#3F505C';
  return { background: `${hex}1A`, color: hex };
}

type SortKey =
  | 'name'
  | 'phone'
  | 'visits'
  | 'spend'
  | 'lastVisit'
  | 'associatedAt';
type SortDir = 'asc' | 'desc';

const COLUMNS: { key: SortKey; label: string }[] = [
  { key: 'name', label: 'Cliente' },
  { key: 'phone', label: 'Telefone' },
  { key: 'visits', label: 'Visitas' },
  { key: 'spend', label: 'Gasto' },
  { key: 'lastVisit', label: 'Última visita' },
  { key: 'associatedAt', label: 'Desde' },
];

function defaultDir(key: SortKey): SortDir {
  return key === 'name' || key === 'phone' ? 'asc' : 'desc';
}

export function BusinessCustomers({ businessId }: { businessId: string }) {
  const { getToken, ready } = useAuth();
  const [q, setQ] = useState('');
  const [debouncedQ, setDebouncedQ] = useState('');
  const [customers, setCustomers] = useState<CustomerRow[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [matchCount, setMatchCount] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [sort, setSort] = useState<SortKey>('associatedAt');
  const [dir, setDir] = useState<SortDir>('desc');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const hasLoaded = useRef(false);
  const loadGen = useRef(0);

  const prevQuery = useRef(debouncedQ);

  useEffect(() => {
    const timer = window.setTimeout(() => setDebouncedQ(q), 300);
    return () => window.clearTimeout(timer);
  }, [q]);

  useEffect(() => {
    if (prevQuery.current === debouncedQ) return;
    prevQuery.current = debouncedQ;
    setPage(1);
  }, [debouncedQ]);

  const load = useCallback(async () => {
    if (!ready) return;
    const gen = ++loadGen.current;
    if (!hasLoaded.current) setLoading(true);
    setError(null);
    try {
      const token = await getToken();
      const params = new URLSearchParams();
      if (debouncedQ.trim()) params.set('q', debouncedQ.trim());
      params.set('page', String(page));
      params.set('sort', sort);
      params.set('dir', dir);
      const res = await fetch(
        `${API_URL}/admin/businesses/${businessId}/customers?${params.toString()}`,
        { headers: token ? { Authorization: `Bearer ${token}` } : {} },
      );
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? 'Falha ao listar clientes');
      if (gen !== loadGen.current) return;
      hasLoaded.current = true;
      setCustomers(json.customers ?? []);
      setTotalCount(json.totalCount ?? 0);
      setMatchCount(json.matchCount ?? 0);
      if (typeof json.pageSize === 'number') setPageSize(json.pageSize);
      if (typeof json.page === 'number' && json.page !== page) setPage(json.page);
    } catch (err) {
      if (gen !== loadGen.current) return;
      setError(err instanceof Error ? err.message : 'Erro');
    } finally {
      if (gen === loadGen.current) setLoading(false);
    }
  }, [businessId, debouncedQ, dir, getToken, page, ready, sort]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (loading) return;
    if (window.location.hash !== '#clientes') return;
    document.getElementById('clientes')?.scrollIntoView({ block: 'start' });
  }, [loading]);

  function onSort(key: SortKey) {
    setPage(1);
    if (key === sort) {
      setDir((current) => (current === 'asc' ? 'desc' : 'asc'));
      return;
    }
    setSort(key);
    setDir(defaultDir(key));
  }

  const pageCount = Math.max(1, Math.ceil(matchCount / pageSize));
  const rangeFrom = matchCount === 0 ? 0 : (page - 1) * pageSize + 1;
  const rangeTo = Math.min(page * pageSize, matchCount);

  return (
    <section
      id="clientes"
      className="mb-8 scroll-mt-6 overflow-x-auto rounded-[16px] border border-[var(--color-hairline)] bg-[var(--color-card)] shadow-[var(--shadow-card)]"
    >
      <div className="flex flex-wrap items-end justify-between gap-4 px-5 pt-5">
        <div>
          <p className="text-[13px] font-semibold uppercase tracking-[0.04em] text-[var(--color-neutral-400)]">
            Clientes
          </p>
          <p className="mt-1 text-[14px] text-[var(--color-neutral-500)]">
            {loading && !hasLoaded.current
              ? 'Carregando…'
              : debouncedQ.trim()
                ? matchCount === 1
                  ? '1 cliente encontrado.'
                  : `${matchCount} clientes encontrados.`
                : totalCount === 1
                  ? '1 cliente neste estabelecimento.'
                  : `${totalCount} clientes neste estabelecimento.`}
          </p>
        </div>
        <label className="block text-[13px] font-semibold uppercase tracking-[0.04em]">
          Buscar
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Nome ou telefone"
            className="mt-2 min-h-11 w-full min-w-[240px] rounded-[8px] border border-[var(--color-neutral-200)] bg-[var(--color-card)] px-3 text-[16px] font-normal normal-case tracking-normal"
          />
        </label>
      </div>

      {error && (
        <p className="px-5 pt-4 text-[13px] text-[var(--color-danger)]" role="alert">
          {error}
        </p>
      )}

      {loading && !hasLoaded.current ? (
        <p className="px-5 py-4 text-[14px] text-[var(--color-neutral-500)]">
          Carregando…
        </p>
      ) : customers.length === 0 ? (
        <p className="px-5 py-4 text-[14px] text-[var(--color-neutral-500)]">
          {debouncedQ.trim()
            ? 'Nenhum cliente encontrado.'
            : 'Nenhum cliente neste estabelecimento.'}
        </p>
      ) : (
        <>
          <table className="mt-3 w-full min-w-[760px] border-collapse text-left text-[14px]">
            <thead>
              <tr className="border-b border-[var(--color-hairline)] text-[12px] font-semibold uppercase tracking-[0.04em] text-[var(--color-neutral-400)]">
                {COLUMNS.map((column) => {
                  const active = sort === column.key;
                  return (
                    <th
                      key={column.key}
                      className="px-5 py-3 font-semibold"
                      aria-sort={
                        active
                          ? dir === 'asc'
                            ? 'ascending'
                            : 'descending'
                          : 'none'
                      }
                    >
                      <button
                        type="button"
                        onClick={() => onSort(column.key)}
                        className={`inline-flex items-center gap-1 uppercase tracking-[0.04em] ${
                          active
                            ? 'text-[var(--color-ink)]'
                            : 'text-[var(--color-neutral-400)] hover:text-[var(--color-ink)]'
                        }`}
                      >
                        {column.label}
                        <span aria-hidden="true" className="text-[11px]">
                          {active ? (dir === 'asc' ? '↑' : '↓') : '↕'}
                        </span>
                      </button>
                    </th>
                  );
                })}
              </tr>
            </thead>
            <tbody>
              {customers.map((customer) => (
                <tr
                  key={customer.membershipId}
                  className="border-b border-[var(--color-hairline)] last:border-0"
                >
                  <td className="px-5 py-3">
                    <p className="font-semibold">
                      {customer.displayName?.trim() || 'Sem nome'}
                      {customer.isVip && (
                        <span className="ml-2 rounded-full bg-[var(--color-primary-50)] px-2 py-0.5 text-[10px] font-semibold text-[var(--color-primary-600)]">
                          VIP
                        </span>
                      )}
                    </p>
                    {customer.tags.length > 0 && (
                      <p className="mt-1 flex flex-wrap gap-1">
                        {customer.tags.map((tag) => (
                          <span
                            key={tag.id}
                            className="rounded-full px-2 py-0.5 text-[11px] font-semibold"
                            style={tagStyle(tag.color)}
                          >
                            {tag.name}
                          </span>
                        ))}
                      </p>
                    )}
                  </td>
                  <td className="px-5 py-3 tabular-nums text-[var(--color-neutral-700)]">
                    {displayPhone(customer.phoneE164)}
                  </td>
                  <td className="px-5 py-3 tabular-nums text-[var(--color-neutral-700)]">
                    {customer.stats.visits}
                  </td>
                  <td className="px-5 py-3 tabular-nums text-[var(--color-neutral-700)]">
                    {formatBrl(customer.stats.spendCents)}
                  </td>
                  <td className="px-5 py-3 whitespace-nowrap text-[var(--color-neutral-700)]">
                    {formatWhen(customer.stats.lastVisitAt)}
                  </td>
                  <td className="px-5 py-3 whitespace-nowrap text-[var(--color-neutral-700)]">
                    {formatWhen(customer.associatedAt)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[var(--color-hairline)] px-5 py-3">
            <p className="text-[13px] text-[var(--color-neutral-500)]">
              Mostrando {rangeFrom}–{rangeTo} de {matchCount}
            </p>
            {pageCount > 1 && (
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  disabled={page <= 1 || loading}
                  onClick={() => setPage((current) => Math.max(1, current - 1))}
                  className="min-h-9 rounded-[8px] border border-[var(--color-hairline)] px-3 text-[13px] font-semibold disabled:opacity-40"
                >
                  Anterior
                </button>
                <span className="text-[13px] tabular-nums text-[var(--color-neutral-500)]">
                  {page} de {pageCount}
                </span>
                <button
                  type="button"
                  disabled={page >= pageCount || loading}
                  onClick={() =>
                    setPage((current) => Math.min(pageCount, current + 1))
                  }
                  className="min-h-9 rounded-[8px] border border-[var(--color-hairline)] px-3 text-[13px] font-semibold disabled:opacity-40"
                >
                  Próxima
                </button>
              </div>
            )}
          </div>
        </>
      )}
    </section>
  );
}
