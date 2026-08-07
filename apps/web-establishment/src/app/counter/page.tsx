'use client';

import { FormEvent, useEffect, useMemo, useState } from 'react';
import { Coins, Stamp } from 'lucide-react';
import { useBusiness } from '@/lib/business-context';
import { AppShell } from '@/components/app-shell';
import { API_URL } from '@/lib/api';
import {
  digitsOnly,
  formatPhoneBr,
  phoneDigitsForApi,
} from '@/lib/phone';

type WalletSnapshot = {
  pools: { stamps: number; points: number };
  campaigns?: Array<{
    campaignId: string;
    campaignName: string;
    type: string;
    unitsNeeded: number;
    canRedeem: boolean;
    rewardTitle: string | null;
  }>;
};

type Match = {
  customerId: string;
  displayName: string | null;
  phoneE164: string;
  isVip: boolean;
  membershipId: string;
};

type LookupResult = {
  found: boolean;
  multiple?: boolean;
  last4?: string;
  phoneE164?: string;
  associatedHere?: boolean;
  customer?: {
    id: string;
    displayName: string | null;
    phoneE164: string;
  };
  membership?: { id: string; isVip: boolean } | null;
  otherShopsCount?: number;
  wallet?: WalletSnapshot | null;
  pools?: { stamps: number; points: number };
  pointsPerReal?: number;
  matches?: Match[];
  error?: string;
};

type EarnMode = 'stamps' | 'points';

function parseMoneyToCents(raw: string): number | null {
  const cleaned = raw.replace(/[^\d,.-]/g, '').replace(',', '.');
  if (!cleaned) return null;
  const n = Number(cleaned);
  if (!Number.isFinite(n) || n <= 0) return null;
  return Math.round(n * 100);
}

function poolsFrom(lookup: LookupResult | null) {
  return (
    lookup?.pools ??
    lookup?.wallet?.pools ?? { stamps: 0, points: 0 }
  );
}

export default function CounterPage() {
  const { authHeaders: bizAuthHeaders, business } = useBusiness();
  const [query, setQuery] = useState('');
  const [fullPhone, setFullPhone] = useState('');
  const [amount, setAmount] = useState('');
  const [earnMode, setEarnMode] = useState<EarnMode>('stamps');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lookup, setLookup] = useState<LookupResult | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  const pointsPerReal = lookup?.pointsPerReal ?? business?.pointsPerReal ?? 1;
  const pools = useMemo(() => poolsFrom(lookup), [lookup]);
  const qDigits = digitsOnly(query);
  const isLast4 = qDigits.length === 4;
  const amountCents = parseMoneyToCents(amount);
  const previewPoints =
    earnMode === 'points' && amountCents != null
      ? Math.floor(amountCents / 100) * pointsPerReal
      : 0;

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 3200);
    return () => clearTimeout(t);
  }, [toast]);

  async function authHeaders(): Promise<HeadersInit> {
    return {
      ...(await bizAuthHeaders()),
      'Content-Type': 'application/json',
    };
  }

  async function doLookup(e?: FormEvent) {
    e?.preventDefault();
    setLoading(true);
    setError(null);
    setLookup(null);
    try {
      const payload =
        qDigits.length === 4
          ? { last4: qDigits }
          : { phone: phoneDigitsForApi(query) };

      if (qDigits.length !== 4 && qDigits.length < 10) {
        throw new Error('Digite os 4 últimos dígitos ou o telefone completo');
      }

      const res = await fetch(`${API_URL}/customers/lookup`, {
        method: 'POST',
        headers: await authHeaders(),
        body: JSON.stringify(payload),
      });
      const data = (await res.json()) as LookupResult;
      if (res.status === 404 || data.found === false) {
        setLookup({
          found: false,
          last4: data.last4,
          phoneE164: data.phoneE164,
          matches: [],
        });
        return;
      }
      if (!res.ok) {
        throw new Error(data.error ?? 'Falha na busca');
      }
      setLookup(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Falha na busca');
    } finally {
      setLoading(false);
    }
  }

  async function selectMatch(match: Match) {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${API_URL}/customers/lookup`, {
        method: 'POST',
        headers: await authHeaders(),
        body: JSON.stringify({ phone: match.phoneE164 }),
      });
      const data = (await res.json()) as LookupResult;
      if (!res.ok) throw new Error(data.error ?? 'Falha na busca');
      setLookup(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Falha na busca');
    } finally {
      setLoading(false);
    }
  }

  async function createCustomer(withEarn: boolean) {
    const phone =
      phoneDigitsForApi(fullPhone) ||
      (lookup?.phoneE164 ? lookup.phoneE164 : phoneDigitsForApi(query));
    if (digitsOnly(phone).length < 10) {
      setError('Para criar cliente, informe o telefone completo com DDD');
      return;
    }
    if (withEarn && earnMode === 'points' && amountCents == null) {
      setError('Informe o valor da compra');
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${API_URL}/customers`, {
        method: 'POST',
        headers: await authHeaders(),
        body: JSON.stringify({
          phone,
          addFirstStamp: earnMode === 'stamps' && withEarn,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Falha ao criar');
      setLookup({
        found: true,
        associatedHere: true,
        phoneE164: data.customer.phoneE164,
        customer: data.customer,
        membership: data.membership,
        wallet: data.wallet,
        pools: data.pools ?? data.wallet?.pools,
        pointsPerReal,
      });

      if (earnMode === 'points' && withEarn && data.membership?.id) {
        await earn(data.membership.id);
        return;
      }

      setToast(
        earnMode === 'stamps' && withEarn
          ? data.message ??
              `Carimbo adicionado — saldo ${data.pools?.stamps ?? data.wallet?.pools?.stamps ?? 1}`
          : 'Cliente adicionado à loja',
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Falha ao criar');
    } finally {
      setLoading(false);
    }
  }

  async function earn(membershipId?: string) {
    const mid = membershipId ?? lookup?.membership?.id;
    if (!mid) return;
    if (earnMode === 'points' && amountCents == null) {
      setError('Informe o valor da compra');
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${API_URL}/transactions`, {
        method: 'POST',
        headers: await authHeaders(),
        body: JSON.stringify({
          membershipId: mid,
          type: 'stamp',
          unitKind: earnMode,
          ...(earnMode === 'points' ? { amountCents } : { quantity: 1 }),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Falha ao registrar');
      setLookup((prev) =>
        prev
          ? {
              ...prev,
              associatedHere: true,
              membership: prev.membership ?? { id: mid, isVip: false },
              wallet: data.wallet,
              pools: data.wallet?.pools ?? data.pools,
            }
          : prev,
      );
      setToast(data.message);
      setAmount('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Falha ao registrar');
    } finally {
      setLoading(false);
    }
  }

  const title = earnMode === 'points' ? 'Pontos' : 'Carimbar';
  const primaryAction =
    earnMode === 'points' ? 'Registrar gasto' : 'Carimbar';

  return (
    <AppShell title="Balcão">
      <main className="mx-auto max-w-lg px-4 py-6 md:py-10">
        <header className="mb-6 md:mb-8">
          <p className="text-[12px] font-semibold uppercase tracking-[0.04em] text-[var(--color-neutral-400)]">
            Balcão · {business?.name ?? 'funcionário'}
          </p>
          <h1 className="mt-1 text-[28px] font-semibold tracking-[-0.03em] text-[var(--color-ink)]">
            {title}
          </h1>
          <p className="mt-2 text-[15px] leading-relaxed text-[var(--color-neutral-500)]">
            Digite os <strong>4 últimos dígitos</strong> do celular. O acúmulo
            vai para o pool do cliente — ele escolhe a campanha no app.
          </p>
        </header>

        <div className="mb-6 flex gap-1 rounded-[14px] bg-[var(--color-neutral-100)] p-1">
          {(
            [
              {
                key: 'stamps' as const,
                label: 'Carimbos',
                Icon: Stamp,
              },
              {
                key: 'points' as const,
                label: 'Pontos (R$)',
                Icon: Coins,
              },
            ] as const
          ).map(({ key, label, Icon }) => {
            const selected = earnMode === key;
            return (
              <button
                key={key}
                type="button"
                onClick={() => setEarnMode(key)}
                className={`flex min-h-11 flex-1 items-center justify-center gap-2 rounded-[11px] text-[14px] font-semibold transition-all ${
                  selected
                    ? key === 'points'
                      ? 'bg-[var(--color-points)] text-white shadow-[0_8px_18px_-10px_rgba(180,83,9,0.55)]'
                      : 'bg-[var(--color-stamps)] text-white shadow-[0_8px_18px_-10px_rgba(15,118,110,0.55)]'
                    : 'text-[var(--color-neutral-600)] hover:text-[var(--color-ink)]'
                }`}
              >
                <Icon size={16} strokeWidth={2.25} aria-hidden />
                {label}
              </button>
            );
          })}
        </div>

        <form onSubmit={doLookup} className="flex flex-col gap-3">
          <label className="text-[13px] font-semibold uppercase tracking-[0.04em] text-[var(--color-neutral-700)]">
            {isLast4 ? 'Últimos 4 dígitos' : 'Telefone'}
            <input
              value={query}
              onChange={(e) => {
                const raw = e.target.value;
                const d = digitsOnly(raw);
                // 4 dígitos = busca rápida; acima disso aplica máscara com DDD
                setQuery(d.length <= 4 ? d : formatPhoneBr(raw));
              }}
              inputMode="numeric"
              autoComplete="off"
              autoFocus
              className={`mt-2 min-h-14 w-full rounded-[8px] border bg-[var(--color-card)] px-3 text-center text-[28px] font-semibold ${
                isLast4 ? 'tracking-[0.2em]' : 'tracking-normal'
              } ${
                error
                  ? 'border-[var(--color-danger)]'
                  : 'border-[var(--color-neutral-200)] focus:border-[var(--color-primary-500)]'
              }`}
              placeholder={isLast4 ? '4321' : '(11) 98765-4321'}
            />
          </label>
          {error && (
            <p className="text-[13px] text-[var(--color-danger)]" role="alert">
              {error}
            </p>
          )}
          <button
            type="submit"
            disabled={loading}
            className="min-h-12 rounded-[12px] bg-[var(--color-primary-500)] px-4 text-[15px] font-semibold text-white shadow-[var(--shadow-cta)] disabled:bg-[var(--color-primary-200)] disabled:shadow-none"
          >
            {loading ? 'Consultando Frego…' : 'Buscar'}
          </button>
        </form>

        {lookup?.multiple && lookup.matches && (
          <section className="mt-8 rounded-[16px] border border-[var(--color-hairline)] bg-[var(--color-card)] p-5 shadow-[var(--shadow-card)]">
            <h2 className="text-[20px] font-semibold">Vários clientes</h2>
            <p className="mt-1 text-[15px] text-[var(--color-neutral-500)]">
              Terminam em {lookup.last4}. Qual é?
            </p>
            <ul className="mt-4 flex flex-col gap-2">
              {lookup.matches.map((m) => (
                <li key={m.membershipId}>
                  <button
                    type="button"
                    onClick={() => selectMatch(m)}
                    className="flex min-h-11 w-full items-center justify-between rounded-[12px] border border-[var(--color-hairline)] px-4 text-left hover:border-[var(--color-primary-200)]"
                  >
                    <span className="font-medium">
                      {m.displayName ?? 'Cliente'}
                      {m.isVip ? ' · VIP' : ''}
                    </span>
                    <span className="font-mono text-[13px] text-[var(--color-neutral-500)]">
                      {m.phoneE164}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          </section>
        )}

        {lookup && !lookup.found && !lookup.multiple && (
          <section className="mt-8 rounded-[16px] border border-[var(--color-hairline)] bg-[var(--color-card)] p-5 shadow-[var(--shadow-card)]">
            <h2 className="text-[20px] font-semibold">Não encontrado</h2>
            <p className="mt-1 text-[15px] text-[var(--color-neutral-500)]">
              Informe o telefone completo para criar o cliente.
            </p>
            <label className="mt-4 block text-[13px] font-semibold uppercase tracking-[0.04em]">
              Telefone completo
              <input
                value={fullPhone}
                onChange={(e) => setFullPhone(formatPhoneBr(e.target.value))}
                inputMode="tel"
                autoComplete="tel"
                className="mt-2 min-h-11 w-full rounded-[8px] border border-[var(--color-neutral-200)] px-3 text-[17px] tracking-wide"
                placeholder="(19) 99488-5914"
              />
            </label>
            {earnMode === 'points' && (
              <AmountField
                amount={amount}
                setAmount={setAmount}
                previewPoints={previewPoints}
                pointsPerReal={pointsPerReal}
              />
            )}
            <button
              type="button"
              onClick={() => createCustomer(true)}
              disabled={loading}
              className="mt-4 min-h-11 w-full rounded-[12px] bg-[var(--color-primary-500)] text-[15px] font-semibold text-white disabled:bg-[var(--color-primary-200)]"
            >
              {earnMode === 'points'
                ? 'Criar e registrar gasto'
                : 'Criar e dar primeiro carimbo'}
            </button>
          </section>
        )}

        {lookup?.found && lookup.customer && !lookup.multiple && (
          <section className="mt-8 rounded-[16px] border border-[var(--color-hairline)] bg-[var(--color-card)] p-5 shadow-[var(--shadow-card)]">
            <h2 className="text-[20px] font-semibold">
              {lookup.customer.displayName ?? 'Cliente'}
            </h2>
            <p className="font-mono text-[15px] text-[var(--color-neutral-500)]">
              {lookup.customer.phoneE164}
            </p>
            {!lookup.associatedHere && (
              <p className="mt-2 rounded-[8px] bg-[var(--color-primary-50)] px-3 py-2 text-[13px] text-[var(--color-primary-800)]">
                Identidade Frego compartilhada — ativo em{' '}
                {lookup.otherShopsCount ?? 0} outro(s) estabelecimento(s).
              </p>
            )}

            <div className="mt-4 grid grid-cols-2 gap-2">
              <div className="rounded-[14px] bg-[var(--color-stamps-bg)] px-3 py-3 ring-1 ring-inset ring-[var(--color-stamps-ring)]">
                <p className="text-[12px] font-semibold uppercase tracking-[0.04em] text-[var(--color-stamps)]">
                  Carimbos
                </p>
                <p className="mt-1 text-[24px] font-semibold text-[var(--color-ink)]">
                  {pools.stamps}
                </p>
              </div>
              <div className="rounded-[14px] bg-[var(--color-points-bg)] px-3 py-3 ring-1 ring-inset ring-[var(--color-points-ring)]">
                <p className="text-[12px] font-semibold uppercase tracking-[0.04em] text-[var(--color-points)]">
                  Pontos
                </p>
                <p className="mt-1 text-[24px] font-semibold text-[var(--color-ink)]">
                  {pools.points}
                </p>
              </div>
            </div>

            <p className="mt-3 text-[13px] text-[var(--color-neutral-500)]">
              Resgate no app do cliente — ele escolhe a campanha.
            </p>

            {earnMode === 'points' && (
              <AmountField
                amount={amount}
                setAmount={setAmount}
                previewPoints={previewPoints}
                pointsPerReal={pointsPerReal}
              />
            )}

            <button
              type="button"
              onClick={() =>
                lookup.associatedHere && lookup.membership
                  ? earn()
                  : createCustomer(true)
              }
              disabled={loading}
              className="mt-6 min-h-11 w-full rounded-[12px] bg-[var(--color-primary-500)] text-[15px] font-semibold text-white shadow-[var(--shadow-cta)] disabled:bg-[var(--color-primary-200)]"
            >
              {lookup.associatedHere
                ? primaryAction
                : earnMode === 'points'
                  ? 'Adicionar à loja e registrar'
                  : 'Adicionar à loja e carimbar'}
            </button>
          </section>
        )}

        {toast && (
          <div
            className="fixed bottom-[calc(5.5rem+env(safe-area-inset-bottom))] left-1/2 z-40 w-[min(92vw,24rem)] -translate-x-1/2 rounded-full bg-[var(--color-ink)] px-4 py-3 text-center text-[14px] text-white shadow-[var(--shadow-raised)] md:bottom-6"
            role="status"
          >
            {toast}
          </div>
        )}
      </main>
    </AppShell>
  );
}

function AmountField({
  amount,
  setAmount,
  previewPoints,
  pointsPerReal,
}: {
  amount: string;
  setAmount: (v: string) => void;
  previewPoints: number;
  pointsPerReal: number;
}) {
  const chips = ['20', '40', '60', '100'];
  return (
    <div className="mt-4">
      <label className="block text-[13px] font-semibold uppercase tracking-[0.04em]">
        Valor da compra (R$)
        <input
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          inputMode="decimal"
          className="mt-2 min-h-14 w-full rounded-[8px] border border-[var(--color-neutral-200)] px-3 text-center text-[28px] font-semibold"
          placeholder="0,00"
        />
      </label>
      <p className="mt-1 text-[12px] text-[var(--color-neutral-400)]">
        Taxa da loja: {pointsPerReal} pt / R$1
      </p>
      <div className="mt-2 flex flex-wrap gap-2">
        {chips.map((c) => (
          <button
            key={c}
            type="button"
            onClick={() => setAmount(c)}
            className="min-h-9 rounded-[8px] border border-[var(--color-hairline)] px-3 text-[13px] font-semibold text-[var(--color-neutral-700)]"
          >
            R$ {c}
          </button>
        ))}
      </div>
      {previewPoints > 0 && (
        <p className="mt-2 text-center text-[13px] font-semibold text-[var(--color-primary-600)]">
          +{previewPoints} pts
        </p>
      )}
    </div>
  );
}
