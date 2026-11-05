'use client';

import { FormEvent, useCallback, useEffect, useState } from 'react';
import { API_URL } from '@/lib/api';
import { useBusiness } from '@/lib/business-context';

type Connection = {
  status: string;
  connectedAt: string;
  lastSyncAt: string | null;
  lastError: string | null;
};

const TOKEN_HELP = 'https://saipos-data-api.readme.io/reference/introducao';

function formatWhen(iso: string): string {
  return new Date(iso).toLocaleString('pt-BR', {
    dateStyle: 'short',
    timeStyle: 'short',
  });
}

export function SaiposStatus() {
  const { businessId, authHeaders, loading: businessLoading } = useBusiness();
  const [label, setLabel] = useState<string | null>(null);
  const [broken, setBroken] = useState(false);

  useEffect(() => {
    if (businessLoading || !businessId) return;
    let cancelled = false;
    void (async () => {
      try {
        const headers = await authHeaders();
        const res = await fetch(`${API_URL}/saipos/connection`, { headers });
        const data = (await res.json().catch(() => ({}))) as {
          connected?: boolean;
          connection?: Connection | null;
        };
        if (cancelled || !res.ok) return;
        if (!data.connected || !data.connection) {
          setLabel('Desligada');
          setBroken(false);
          return;
        }
        setBroken(data.connection.status === 'error');
        setLabel(data.connection.status === 'error' ? 'Token recusado' : 'Conectada');
      } catch {
        if (!cancelled) setLabel(null);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [authHeaders, businessId, businessLoading]);

  if (!label) return null;
  return (
    <span
      className={`rounded-full px-2.5 py-1 text-[12px] font-semibold ${
        broken
          ? 'bg-[var(--color-danger)]/10 text-[var(--color-danger)]'
          : label === 'Conectada'
            ? 'bg-[var(--color-success)]/10 text-[var(--color-success)]'
            : 'bg-[var(--color-neutral-100)] text-[var(--color-neutral-500)]'
      }`}
    >
      {label}
    </span>
  );
}

export function SaiposSettingsCard({ embedded = false }: { embedded?: boolean }) {
  const { business, businessId, authHeaders, loading: businessLoading } = useBusiness();
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [connection, setConnection] = useState<Connection | null>(null);
  const [token, setToken] = useState('');
  const [error, setError] = useState<string | null>(null);
  const canEdit = business?.role !== 'employee';

  const load = useCallback(async () => {
    if (businessLoading || !businessId) return;
    setLoading(true);
    setError(null);
    try {
      const headers = await authHeaders();
      const res = await fetch(`${API_URL}/saipos/connection`, { headers });
      const data = (await res.json().catch(() => ({}))) as {
        connected?: boolean;
        connection?: Connection | null;
        message?: string;
        error?: string;
      };
      if (!res.ok) {
        throw new Error(data.message ?? 'Não foi possível carregar a Saipos.');
      }
      setConnection(data.connected ? (data.connection ?? null) : null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Não foi possível carregar a Saipos.');
    } finally {
      setLoading(false);
    }
  }, [authHeaders, businessId, businessLoading]);

  useEffect(() => {
    void load();
  }, [load]);

  async function onConnect(event: FormEvent) {
    event.preventDefault();
    if (!canEdit) return;
    setBusy(true);
    setError(null);
    try {
      const headers = await authHeaders();
      const res = await fetch(`${API_URL}/saipos/connection`, {
        method: 'POST',
        headers: { ...headers, 'Content-Type': 'application/json' },
        body: JSON.stringify({ token }),
      });
      const data = (await res.json().catch(() => ({}))) as {
        connection?: Connection;
        message?: string;
      };
      if (!res.ok) {
        throw new Error(data.message ?? 'A Saipos não aceitou esse token.');
      }
      setToken('');
      setConnection(data.connection ?? null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Não foi possível conectar.');
    } finally {
      setBusy(false);
    }
  }

  async function onDisconnect() {
    if (!canEdit) return;
    setBusy(true);
    setError(null);
    try {
      const headers = await authHeaders();
      const res = await fetch(`${API_URL}/saipos/connection`, {
        method: 'DELETE',
        headers,
      });
      if (!res.ok) throw new Error('Não foi possível desconectar.');
      setConnection(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Não foi possível desconectar.');
    } finally {
      setBusy(false);
    }
  }

  const broken = connection?.status === 'error';

  const body = (
    <>
      {embedded ? null : (
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/integrations/saipos.svg" alt="" className="h-8 w-auto" />
            <h2 className="sr-only">Saipos</h2>
            <p className="mt-2 max-w-xl text-[13px] leading-relaxed text-[var(--color-neutral-500)]">
                Vendas fechadas na Saipos creditam pontos e cashback neste clube. O token é da
                API de dados da Saipos, pedido por eles, e custa R$ 59,90 por loja por mês —
                pago à Saipos, não ao Frego. O token precisa ser só deste estabelecimento.
              </p>
          </div>
          {connection ? (
            <span
              className={`rounded-full px-2.5 py-1 text-[12px] font-semibold ${
                broken
                  ? 'bg-[var(--color-danger)]/10 text-[var(--color-danger)]'
                  : 'bg-[var(--color-success)]/10 text-[var(--color-success)]'
              }`}
            >
              {broken ? 'Token recusado' : 'Conectada'}
            </span>
          ) : null}
        </div>
      )}

      <p className={`max-w-xl text-[13px] leading-relaxed text-[var(--color-neutral-500)] ${embedded ? '' : 'mt-3'}`}>
        Peça o token à Saipos. Custa R$ 59,90 por loja por mês, pago a eles, e vale só
        para este estabelecimento. Cada venda fechada credita as campanhas de pontos e
        de cashback que estiverem abertas. O crédito pode levar até o dia seguinte. O
        cashback desta venda não é descontado na Saipos. Carimbos continuam no balcão.
      </p>
      <div
        className="mt-3 max-w-xl rounded-[12px] border border-[var(--color-warning)]/30 bg-[var(--color-warning-bg)] px-4 py-3"
        role="note"
      >
        <p className="text-[13px] font-semibold leading-relaxed text-[var(--color-ink)]">
          Pontos e cashback abertos juntos: a mesma venda credita os dois.
        </p>
        <p className="mt-1 text-[13px] leading-relaxed text-[var(--color-neutral-700)]">
          Na mesma compra o cliente recebe os pontos e o cashback vira saldo. A
          Saipos não escolhe um dos dois. Para creditar só pontos, pause a campanha
          de cashback. Para creditar só cashback, pause a campanha de pontos.
        </p>
      </div>

      {loading ? (
        <div className="mt-4 h-16 animate-pulse rounded-[12px] bg-[var(--color-neutral-100)]" />
      ) : connection ? (
        <div className="mt-4 flex flex-col gap-3">
          <p className="text-[13px] text-[var(--color-neutral-500)]">
            {connection.lastSyncAt
              ? `Última sincronização ${formatWhen(connection.lastSyncAt)}.`
              : 'A primeira sincronização ainda não aconteceu.'}
          </p>
          {connection.lastError ? (
            <p className="text-[13px] text-[var(--color-danger)]" role="alert">
              {connection.lastError}
            </p>
          ) : null}
          {canEdit && broken ? (
            <form onSubmit={onConnect} className="flex max-w-xl flex-col gap-3">
              <label className="flex flex-col gap-1.5">
                <span className="text-[13px] font-medium text-[var(--color-ink)]">
                  Novo token
                </span>
                <input
                  type="password"
                  autoComplete="off"
                  value={token}
                  onChange={(event) => setToken(event.target.value)}
                  placeholder="Cole o token"
                  className="min-h-11 rounded-[12px] border border-[var(--color-hairline)] bg-[var(--color-canvas)] px-3 text-[14px] text-[var(--color-ink)]"
                />
              </label>
              <button
                type="submit"
                disabled={busy || token.trim().length < 8}
                className="min-h-11 w-fit rounded-[12px] bg-[var(--color-primary-500)] px-4 text-[14px] font-semibold text-white disabled:bg-[var(--color-primary-200)]"
              >
                {busy ? 'Conferindo…' : 'Trocar token'}
              </button>
            </form>
          ) : null}
          {canEdit ? (
            <div className="flex flex-col gap-2">
              <button
                type="button"
                onClick={() => void onDisconnect()}
                disabled={busy}
                className="min-h-11 w-fit rounded-[12px] border border-[var(--color-hairline)] px-4 text-[14px] font-semibold text-[var(--color-ink)] disabled:opacity-60"
              >
                {busy ? 'Desconectando…' : 'Desconectar'}
              </button>
              <p className="text-[12px] text-[var(--color-neutral-500)]">
                Desconectar interrompe a sincronização. Créditos já dados continuam na conta.
              </p>
            </div>
          ) : null}
        </div>
      ) : canEdit ? (
        <form onSubmit={onConnect} className="mt-4 flex max-w-xl flex-col gap-3">
          <label className="flex flex-col gap-1.5">
            <span className="text-[13px] font-medium text-[var(--color-ink)]">
              Token da API de dados
            </span>
            <input
              type="password"
              autoComplete="off"
              value={token}
              onChange={(event) => setToken(event.target.value)}
              placeholder="Cole o token"
              className="min-h-11 rounded-[12px] border border-[var(--color-hairline)] bg-[var(--color-canvas)] px-3 text-[14px] text-[var(--color-ink)]"
            />
          </label>
          <a
            href={TOKEN_HELP}
            target="_blank"
            rel="noreferrer"
            className="text-[13px] font-medium text-[var(--color-primary-600)]"
          >
            Como pedir o token à Saipos
          </a>
          <button
            type="submit"
            disabled={busy || token.trim().length < 8}
            className="min-h-11 w-fit rounded-[12px] bg-[var(--color-primary-500)] px-4 text-[14px] font-semibold text-white disabled:bg-[var(--color-primary-200)]"
          >
            {busy ? 'Conferindo…' : 'Conectar'}
          </button>
        </form>
      ) : (
        <p className="mt-4 text-[13px] text-[var(--color-neutral-500)]">
          A Saipos ainda não está conectada.
        </p>
      )}

      {error ? (
        <p className="mt-3 text-[13px] text-[var(--color-danger)]" role="alert">
          {error}
        </p>
      ) : null}
    </>
  );

  if (embedded) return <div id="saipos">{body}</div>;

  return (
    <section
      id="saipos"
      className="scroll-mt-6 rounded-[16px] border border-[var(--color-hairline)] bg-[var(--color-card)] p-5 shadow-[var(--shadow-card)]"
    >
      {body}
    </section>
  );
}
