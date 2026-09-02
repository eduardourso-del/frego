'use client';

import { FormEvent, useEffect, useMemo, useState } from 'react';
import { Banknote, Coins, Stamp, Undo2 } from 'lucide-react';
import { useBusiness } from '@/lib/business-context';
import { AppShell } from '@/components/app-shell';
import { API_URL } from '@/lib/api';
import {
  digitsOnly,
  formatPhoneBr,
  phoneDigitsForApi,
} from '@/lib/phone';
import {
  formatBrl,
  formatCentsAsInput,
  maskMoneyInput,
  parseMoneyToCents,
} from '@/lib/money';

/** Matches API display: K7M-2PQ */
function normalizeVoucherCode(raw: string): string {
  return raw.replace(/[^0-9A-Za-z]/g, '').toUpperCase().slice(0, 6);
}

function formatVoucherInput(raw: string): string {
  const clean = normalizeVoucherCode(raw);
  if (clean.length <= 3) return clean;
  return `${clean.slice(0, 3)}-${clean.slice(3)}`;
}

function formatSaleClock(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const now = new Date();
  const sameDay =
    d.getFullYear() === now.getFullYear() &&
    d.getMonth() === now.getMonth() &&
    d.getDate() === now.getDate();
  const time = d.toLocaleTimeString('pt-BR', {
    hour: '2-digit',
    minute: '2-digit',
  });
  return sameDay ? `Hoje, ${time}` : `${d.toLocaleDateString('pt-BR')} · ${time}`;
}

type EarnMode = 'stamps' | 'points' | 'cashback';

type WalletSnapshot = {
  pools: { stamps: number; points: number; cashbackCents?: number };
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
  membershipId: string | null;
  associatedHere?: boolean;
};

type OpenVoucher = {
  transactionId: string;
  voucherCode: string;
  voucherDisplay: string;
  status: 'open' | 'used' | 'expired';
  expiresAt?: string;
  createdAt: string;
  rewardTitle: string;
  campaignName: string | null;
};

type CounterSale = {
  saleId: string;
  anchorId: string;
  createdAt: string;
  summary: string;
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
  pools?: { stamps: number; points: number; cashbackCents?: number };
  pointsPerReal?: number;
  cashbackPercent?: number;
  cashback?: {
    campaignId: string | null;
    percent: number;
    balanceCents: number;
  };
  matches?: Match[];
  openVouchers?: OpenVoucher[];
  recentSales?: CounterSale[];
  activeEarnKinds?: EarnMode[];
  error?: string;
};

const EARN_MODE_OPTIONS = [
  { key: 'stamps' as const, label: 'Carimbos', Icon: Stamp },
  { key: 'points' as const, label: 'Pontos', Icon: Coins },
  { key: 'cashback' as const, label: 'Cashback', Icon: Banknote },
] as const;

function parseEarnKinds(raw: unknown): EarnMode[] {
  if (!Array.isArray(raw)) return [];
  const allowed = new Set<EarnMode>(['stamps', 'points', 'cashback']);
  return raw.filter((k): k is EarnMode => allowed.has(k as EarnMode));
}

function poolsFrom(lookup: LookupResult | null) {
  return (
    lookup?.pools ??
    lookup?.wallet?.pools ?? { stamps: 0, points: 0, cashbackCents: 0 }
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
  const [lastSale, setLastSale] = useState<CounterSale | null>(null);
  const [pendingUndo, setPendingUndo] = useState<CounterSale | null>(null);
  const [reversingId, setReversingId] = useState<string | null>(null);
  const [voucherCode, setVoucherCode] = useState('');
  const [applyCashback, setApplyCashback] = useState(false);
  const [applyAmount, setApplyAmount] = useState('');
  const [fulfillingId, setFulfillingId] = useState<string | null>(null);
  const [fetchedKinds, setFetchedKinds] = useState<EarnMode[] | null>(null);
  const [voucherResult, setVoucherResult] = useState<{
    kind: 'used' | 'already_used' | 'expired' | 'not_found' | 'error';
    message: string;
    voucherDisplay?: string;
    rewardTitle?: string;
    expiresAt?: string | null;
    usedAt?: string | null;
    customerName?: string | null;
    transactionId?: string;
    voucherCode?: string;
  } | null>(null);

  const pointsPerReal = lookup?.pointsPerReal ?? business?.pointsPerReal ?? 1;
  const cashbackPercent =
    lookup?.cashback?.percent ?? lookup?.cashbackPercent ?? 0;
  const cashbackBalance =
    poolsFrom(lookup).cashbackCents ?? lookup?.cashback?.balanceCents ?? 0;
  const earnKinds = useMemo(() => {
    if (lookup?.activeEarnKinds) return parseEarnKinds(lookup.activeEarnKinds);
    if (fetchedKinds) return fetchedKinds;
    return parseEarnKinds(business?.activeEarnKinds);
  }, [lookup?.activeEarnKinds, fetchedKinds, business?.activeEarnKinds]);
  const canEarn = earnKinds.length > 0;
  const canEarnCashback = earnKinds.includes('cashback');
  const saleMode =
    earnMode === 'points' ||
    earnMode === 'cashback' ||
    (!canEarn && cashbackBalance > 0);
  const showAmount = saleMode;
  const pools = useMemo(() => poolsFrom(lookup), [lookup]);
  const qDigits = digitsOnly(query);
  const isLast4 = qDigits.length === 4;
  const amountCents = parseMoneyToCents(amount);
  const previewPoints =
    earnMode === 'points' && amountCents != null
      ? Math.floor(amountCents / 100 / pointsPerReal)
      : 0;
  const maxApplyCents =
    cashbackBalance <= 0
      ? 0
      : Math.min(cashbackBalance, amountCents ?? cashbackBalance);
  const typedApply = parseMoneyToCents(applyAmount);
  const applyCents =
    saleMode && applyCashback && maxApplyCents > 0
      ? Math.min(typedApply ?? maxApplyCents, maxApplyCents)
      : 0;
  const paidCents = Math.max(0, (amountCents ?? 0) - applyCents);
  const previewCashback =
    earnMode === 'cashback' &&
    canEarnCashback &&
    cashbackPercent > 0 &&
    paidCents > 0
      ? Math.floor((paidCents * cashbackPercent) / 100)
      : 0;

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const res = await fetch(`${API_URL}/business`, {
          headers: await bizAuthHeaders(),
        });
        const json = await res.json();
        if (cancelled || !res.ok) return;
        setFetchedKinds(parseEarnKinds(json.business?.activeEarnKinds));
      } catch {
        // Keep kinds from session.
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [bizAuthHeaders, business?.id]);

  useEffect(() => {
    if (earnKinds.length === 0) return;
    if (!earnKinds.includes(earnMode)) setEarnMode(earnKinds[0]);
  }, [earnKinds, earnMode]);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 3200);
    return () => clearTimeout(t);
  }, [toast]);

  useEffect(() => {
    if (!applyCashback || maxApplyCents <= 0) return;
    const typed = parseMoneyToCents(applyAmount);
    if (typed != null && typed > maxApplyCents) {
      setApplyAmount(formatCentsAsInput(maxApplyCents));
    }
  }, [applyCashback, applyAmount, maxApplyCents]);

  async function authHeaders(): Promise<HeadersInit> {
    return {
      ...(await bizAuthHeaders()),
      'Content-Type': 'application/json',
    };
  }

  function prependSale(
    prev: LookupResult,
    sale: CounterSale | null | undefined,
  ): LookupResult {
    if (!sale?.anchorId) return prev;
    const rest = (prev.recentSales ?? []).filter(
      (s) => s.saleId !== sale.saleId && s.anchorId !== sale.anchorId,
    );
    return { ...prev, recentSales: [sale, ...rest].slice(0, 8) };
  }

  function rememberSale(sale: CounterSale | null | undefined) {
    if (!sale?.anchorId) return;
    setLastSale(sale);
    setPendingUndo(null);
  }

  async function reverseSale(sale: CounterSale) {
    setReversingId(sale.anchorId);
    setPendingUndo(null);
    setError(null);
    try {
      const res = await fetch(
        `${API_URL}/transactions/${sale.anchorId}/reverse`,
        {
          method: 'POST',
          headers: await authHeaders(),
        },
      );
      const data = await res.json();
      if (!res.ok) {
        throw new Error(
          data.message ?? data.error ?? 'Não foi possível desfazer.',
        );
      }
      const nextPools = data.wallet?.pools ?? data.pools;
      const nextCashbackCents =
        data.cashback?.balanceCents ?? nextPools?.cashbackCents;
      setLookup((prev) =>
        prev
          ? {
              ...prev,
              wallet: data.wallet ?? prev.wallet,
              pools: nextPools ?? prev.pools,
              cashback: prev.cashback
                ? {
                    ...prev.cashback,
                    balanceCents:
                      nextCashbackCents ?? prev.cashback.balanceCents,
                  }
                : prev.cashback,
              recentSales: (prev.recentSales ?? []).filter(
                (s) =>
                  s.saleId !== sale.saleId && s.anchorId !== sale.anchorId,
              ),
            }
          : prev,
      );
      if (
        lastSale &&
        (lastSale.saleId === sale.saleId || lastSale.anchorId === sale.anchorId)
      ) {
        setLastSale(null);
      }
      setPendingUndo(null);
      setToast(data.message ?? 'Lançamento desfeito.');
    } catch (err) {
      const message =
        err instanceof Error ? err.message : 'Não foi possível desfazer.';
      setError(message);
      setToast(message);
    } finally {
      setReversingId(null);
    }
  }

  async function doLookup(e?: FormEvent) {
    e?.preventDefault();
    setLoading(true);
    setError(null);
    setLookup(null);
    setVoucherResult(null);
    setApplyAmount('');
    setApplyCashback(false);
    setLastSale(null);
    setPendingUndo(null);
    try {
      const payload =
        qDigits.length === 4
          ? { last4: qDigits }
          : { phone: phoneDigitsForApi(query) };

      if (qDigits.length !== 4 && qDigits.length < 10) {
        throw new Error('Digite os 4 últimos dígitos ou o telefone completo.');
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
        throw new Error(data.error ?? 'Não foi possível buscar.');
      }
      setLookup(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Não foi possível buscar.');
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
      if (!res.ok) throw new Error(data.error ?? 'Não foi possível buscar.');
      setLookup(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Não foi possível buscar.');
    } finally {
      setLoading(false);
    }
  }

  /** From not-found: try global lookup first, then create if new. */
  async function resolveFullPhoneAndEarn() {
    const phone = phoneDigitsForApi(fullPhone);
    if (digitsOnly(phone).length < 10) {
      setError('Informe o telefone completo com DDD.');
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${API_URL}/customers/lookup`, {
        method: 'POST',
        headers: await authHeaders(),
        body: JSON.stringify({ phone }),
      });
      const data = (await res.json()) as LookupResult;
      if (res.ok && data.found && data.customer) {
        setLookup(data);
        setFullPhone('');
        if (data.associatedHere && data.membership) {
          if (canEarn) await earn(data.membership.id);
        } else {
          await createCustomer(canEarn, phone);
        }
        return;
      }
      await createCustomer(canEarn, phone);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Não foi possível buscar.');
      setLoading(false);
    }
  }

  async function createCustomer(withEarn: boolean, phoneOverride?: string) {
    const phone =
      phoneOverride ||
      phoneDigitsForApi(fullPhone) ||
      (lookup?.phoneE164 ? lookup.phoneE164 : phoneDigitsForApi(query));
    if (digitsOnly(phone).length < 10) {
      setError('Para cadastrar o cliente, informe o telefone completo com DDD.');
      setLoading(false);
      return;
    }
    if (
      withEarn &&
      (earnMode === 'points' || earnMode === 'cashback') &&
      amountCents == null
    ) {
      setError('Informe o valor da compra.');
      setLoading(false);
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
          addFirstStamp: earnMode === 'stamps' && withEarn && amountCents == null,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Não foi possível cadastrar.');
      setLookup({
        found: true,
        associatedHere: true,
        phoneE164: data.customer.phoneE164,
        customer: data.customer,
        membership: data.membership,
        wallet: data.wallet,
        pools: data.pools ?? data.wallet?.pools,
        pointsPerReal,
        cashbackPercent,
        cashback: data.cashback,
        recentSales: data.sale ? [data.sale as CounterSale] : [],
      });
      rememberSale(data.sale as CounterSale | undefined);

      if (
        withEarn &&
        data.membership?.id &&
        (earnMode === 'points' || earnMode === 'cashback')
      ) {
        await earn(data.membership.id);
        return;
      }

      setToast(
        data.sale
          ? null
          : earnMode === 'stamps' && withEarn
            ? data.message ??
              `Carimbo adicionado — saldo ${data.pools?.stamps ?? data.wallet?.pools?.stamps ?? 1}.`
            : 'Cliente adicionado à loja.',
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Não foi possível cadastrar.');
    } finally {
      setLoading(false);
    }
  }

  async function earn(membershipId?: string) {
    const mid = membershipId ?? lookup?.membership?.id;
    if (!mid) return;
    const applyingLeftover = saleMode && applyCents > 0;
    const unitKind =
      canEarn && earnKinds.includes(earnMode) ? earnMode : 'cashback';
    if (!canEarn && !applyingLeftover) {
      setError('Nenhuma campanha ativa para registrar no caixa.');
      setLoading(false);
      return;
    }
    if (
      (unitKind === 'points' ||
        unitKind === 'cashback' ||
        applyingLeftover) &&
      amountCents == null
    ) {
      setError('Informe o valor da compra.');
      setLoading(false);
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
          unitKind,
          ...(unitKind !== 'stamps' && amountCents != null
            ? { amountCents }
            : {}),
          ...(unitKind === 'stamps' ? { quantity: 1 } : {}),
          ...(applyingLeftover ? { applyCashbackCents: applyCents } : {}),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Não foi possível registrar.');
      const sale = data.sale as CounterSale | undefined;
      setLookup((prev) => {
        if (!prev) return prev;
        const nextPools = data.wallet?.pools ?? data.pools;
        const nextCashbackCents =
          data.cashback?.balanceCents ?? nextPools?.cashbackCents;
        return prependSale(
          {
            ...prev,
            associatedHere: true,
            membership: prev.membership ?? { id: mid, isVip: false },
            wallet: data.wallet,
            pools: nextPools,
            cashback: prev.cashback
              ? {
                  ...prev.cashback,
                  balanceCents:
                    nextCashbackCents ?? prev.cashback.balanceCents,
                }
              : {
                  campaignId: null,
                  percent: prev.cashbackPercent ?? 0,
                  balanceCents: nextCashbackCents ?? 0,
                },
          },
          sale,
        );
      });
      rememberSale(sale);
      setToast(sale ? null : data.message);
      setAmount('');
      setApplyAmount('');
      setApplyCashback(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Não foi possível registrar.');
    } finally {
      setLoading(false);
    }
  }

  async function fulfillVoucher(opts: {
    transactionId?: string;
    voucherCode?: string;
    acceptExpired?: boolean;
  }) {
    setFulfillingId(opts.transactionId ?? opts.voucherCode ?? 'code');
    setError(null);
    setVoucherResult(null);
    try {
      const res = await fetch(`${API_URL}/vouchers/fulfill`, {
        method: 'POST',
        headers: await authHeaders(),
        body: JSON.stringify(opts),
      });
      const data = await res.json();
      const voucher = data.voucher as
        | {
            transactionId?: string;
            voucherCode?: string;
            voucherDisplay?: string;
            rewardTitle?: string;
            expiresAt?: string | null;
            usedAt?: string | null;
            status?: string;
          }
        | undefined;
      const customerName =
        (data.customer as { displayName?: string | null } | undefined)
          ?.displayName ?? null;

      if (!res.ok) {
        if (data.error === 'VOUCHER_EXPIRED') {
          setVoucherResult({
            kind: 'expired',
            message:
              data.message ??
              `O voucher ${voucher?.voucherDisplay ?? ''} expirou (válido por 24 h).`,
            voucherDisplay: voucher?.voucherDisplay,
            rewardTitle: voucher?.rewardTitle,
            expiresAt: voucher?.expiresAt,
            customerName,
            transactionId: voucher?.transactionId ?? opts.transactionId,
            voucherCode:
              voucher?.voucherCode ??
              voucher?.voucherDisplay ??
              opts.voucherCode,
          });
          return;
        }
        if (data.error === 'VOUCHER_NOT_FOUND') {
          setVoucherResult({
            kind: 'not_found',
            message: 'Voucher não encontrado nesta loja.',
          });
          return;
        }
        throw new Error(data.error ?? 'Não foi possível confirmar o voucher.');
      }

      setVoucherResult({
        kind: data.alreadyUsed ? 'already_used' : 'used',
        message:
          data.message ??
          (data.alreadyUsed
            ? 'Este voucher já tinha sido usado.'
            : data.acceptedExpired
              ? 'Voucher aceito mesmo depois do prazo.'
              : 'Voucher confirmado.'),
        voucherDisplay: voucher?.voucherDisplay,
        rewardTitle: voucher?.rewardTitle,
        expiresAt: voucher?.expiresAt,
        usedAt: voucher?.usedAt,
        customerName,
      });
      setVoucherCode('');
      if (!data.alreadyUsed) {
        setToast(data.message ?? 'Voucher confirmado.');
      }

      if (lookup?.customer?.phoneE164 || lookup?.phoneE164) {
        const phone = lookup.customer?.phoneE164 ?? lookup.phoneE164!;
        const refresh = await fetch(`${API_URL}/customers/lookup`, {
          method: 'POST',
          headers: await authHeaders(),
          body: JSON.stringify({ phone }),
        });
        const refreshed = (await refresh.json()) as LookupResult;
        if (refresh.ok) setLookup(refreshed);
      }
    } catch (err) {
      const message =
        err instanceof Error ? err.message : 'Não foi possível confirmar o voucher.';
      setVoucherResult({ kind: 'error', message });
      setError(message);
    } finally {
      setFulfillingId(null);
    }
  }

  const openVouchers = lookup?.openVouchers ?? [];
  const canApplyLeftover = cashbackBalance > 0;
  const showStampsPool = earnKinds.includes('stamps') || pools.stamps > 0;
  const showPointsPool = earnKinds.includes('points') || pools.points > 0;
  const title =
    earnKinds.length === 0
      ? 'Balcão'
      : earnMode === 'points'
        ? 'Pontos'
        : earnMode === 'cashback'
          ? 'Cashback'
          : 'Carimbos';
  const primaryAction = !canEarn
    ? canApplyLeftover
      ? 'Usar cashback'
      : 'Sem campanha ativa'
    : earnMode === 'points'
      ? 'Registrar gasto'
      : earnMode === 'cashback'
        ? 'Registrar cashback'
        : 'Carimbar';

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
            vai para o saldo do cliente — ele escolhe a campanha no aplicativo.
            Prêmios resgatados no app são confirmados aqui na entrega.
          </p>
        </header>

        <section className="mb-6 rounded-[16px] border border-[var(--color-hairline)] bg-[var(--color-card)] p-4 shadow-[var(--shadow-card)]">
          <p className="text-[13px] font-semibold uppercase tracking-[0.04em] text-[var(--color-neutral-400)]">
            Confirmar voucher
          </p>
          <p className="mt-1 text-[13px] text-[var(--color-neutral-500)]">
            Digite o código que o cliente mostra no app e marque como usado.
          </p>
          <form
            className="mt-3 flex gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              const code = normalizeVoucherCode(voucherCode);
              if (code.length < 4) return;
              void fulfillVoucher({ voucherCode: code });
            }}
          >
            <input
              value={voucherCode}
              onChange={(e) => setVoucherCode(formatVoucherInput(e.target.value))}
              placeholder="K7M-2PQ"
              maxLength={7}
              inputMode="text"
              className="min-h-11 flex-1 rounded-[10px] border border-[var(--color-neutral-200)] bg-[var(--color-bg)] px-3 font-mono text-[16px] tracking-[0.12em]"
              autoCapitalize="characters"
              autoCorrect="off"
              spellCheck={false}
            />
            <button
              type="submit"
              disabled={
                loading ||
                normalizeVoucherCode(voucherCode).length < 4 ||
                fulfillingId != null
              }
              className="min-h-11 shrink-0 rounded-[10px] bg-[var(--color-ink)] px-4 text-[14px] font-semibold text-white disabled:opacity-50"
            >
              {fulfillingId === normalizeVoucherCode(voucherCode) ||
              fulfillingId === 'code'
                ? '…'
                : 'Usar'}
            </button>
          </form>

          {voucherResult && (
            <div
              className={`mt-3 rounded-[12px] border px-3.5 py-3 ${
                voucherResult.kind === 'expired'
                  ? 'border-[#F5C6A5] bg-[#FFF7ED]'
                  : voucherResult.kind === 'already_used'
                    ? 'border-[var(--color-neutral-300)] bg-[var(--color-neutral-100)]'
                    : voucherResult.kind === 'used'
                      ? 'border-[var(--color-success)]/25 bg-[var(--color-success-bg)]'
                      : 'border-[var(--color-danger)]/25 bg-[var(--color-danger-bg, #FEF2F2)]'
              }`}
              role="status"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p
                    className={`text-[13px] font-semibold ${
                      voucherResult.kind === 'expired'
                        ? 'text-[#C45C26]'
                        : voucherResult.kind === 'already_used'
                          ? 'text-[var(--color-neutral-600)]'
                          : voucherResult.kind === 'used'
                            ? 'text-[var(--color-success)]'
                            : 'text-[var(--color-danger)]'
                    }`}
                  >
                    {voucherResult.kind === 'expired'
                      ? 'Voucher expirado'
                      : voucherResult.kind === 'used'
                        ? 'Voucher confirmado'
                        : voucherResult.kind === 'already_used'
                          ? 'Voucher já foi usado'
                          : voucherResult.kind === 'not_found'
                            ? 'Voucher não encontrado'
                            : 'Erro'}
                  </p>
                  {voucherResult.voucherDisplay && (
                    <p className="mt-1 font-mono text-[18px] font-semibold tracking-[0.12em] text-[var(--color-ink)]">
                      {voucherResult.voucherDisplay}
                    </p>
                  )}
                  {voucherResult.rewardTitle && (
                    <p className="mt-0.5 text-[13px] text-[var(--color-neutral-600)]">
                      {voucherResult.rewardTitle}
                      {voucherResult.customerName
                        ? ` · ${voucherResult.customerName}`
                        : ''}
                    </p>
                  )}
                  {voucherResult.kind === 'already_used' &&
                    voucherResult.usedAt && (
                      <p className="mt-1 text-[12px] font-medium text-[var(--color-neutral-600)]">
                        Usado em{' '}
                        {new Date(voucherResult.usedAt).toLocaleString(
                          'pt-BR',
                          {
                            day: '2-digit',
                            month: 'short',
                            hour: '2-digit',
                            minute: '2-digit',
                          },
                        )}
                      </p>
                    )}
                  {voucherResult.kind === 'expired' && voucherResult.expiresAt && (
                    <p className="mt-1 text-[12px] font-medium text-[#C45C26]">
                      Expirou em{' '}
                      {new Date(voucherResult.expiresAt).toLocaleString(
                        'pt-BR',
                        {
                          day: '2-digit',
                          month: 'short',
                          hour: '2-digit',
                          minute: '2-digit',
                        },
                      )}{' '}
                      · validade de 24h
                    </p>
                  )}
                  {voucherResult.kind === 'expired' && (
                    <div className="mt-3 flex flex-wrap gap-2">
                      <button
                        type="button"
                        disabled={fulfillingId != null}
                        onClick={() =>
                          void fulfillVoucher({
                            transactionId: voucherResult.transactionId,
                            voucherCode: voucherResult.voucherCode,
                            acceptExpired: true,
                          })
                        }
                        className="min-h-9 rounded-[8px] bg-[var(--color-ink)] px-3 text-[13px] font-semibold text-white disabled:opacity-60"
                      >
                        {fulfillingId != null
                          ? '…'
                          : 'Aceitar mesmo assim'}
                      </button>
                      <button
                        type="button"
                        onClick={() => setVoucherResult(null)}
                        className="min-h-9 rounded-[8px] border border-[var(--color-hairline)] px-3 text-[13px] font-semibold text-[var(--color-neutral-600)]"
                      >
                        Cancelar
                      </button>
                    </div>
                  )}
                  {voucherResult.kind !== 'expired' &&
                    voucherResult.kind !== 'already_used' && (
                    <p className="mt-1 text-[12px] text-[var(--color-neutral-500)]">
                      {voucherResult.message}
                    </p>
                  )}
                  {voucherResult.kind === 'already_used' && (
                    <p className="mt-1 text-[12px] text-[var(--color-neutral-500)]">
                      Este voucher já foi confirmado e não pode ser usado de
                      novo.
                    </p>
                  )}
                </div>
                {voucherResult.kind !== 'expired' && (
                  <button
                    type="button"
                    onClick={() => setVoucherResult(null)}
                    className="text-[12px] font-semibold text-[var(--color-neutral-400)]"
                  >
                    Fechar
                  </button>
                )}
              </div>
            </div>
          )}
        </section>

        {earnKinds.length > 1 ? (
          <div className="mb-6 flex gap-1 rounded-[14px] bg-[var(--color-neutral-100)] p-1">
            {EARN_MODE_OPTIONS.filter((opt) => earnKinds.includes(opt.key)).map(
              ({ key, label, Icon }) => {
                const selected = earnMode === key;
                const selectedClass =
                  key === 'points'
                    ? 'bg-[var(--color-points)] text-white shadow-[0_8px_18px_-10px_rgba(180,83,9,0.55)]'
                    : key === 'cashback'
                      ? 'bg-[var(--color-cashback)] text-white shadow-[0_8px_18px_-10px_rgba(15,118,110,0.55)]'
                      : 'bg-[var(--color-stamps)] text-white shadow-[0_8px_18px_-10px_rgba(109,40,217,0.55)]';
                return (
                  <button
                    key={key}
                    type="button"
                    onClick={() => setEarnMode(key)}
                    className={`flex min-h-11 flex-1 items-center justify-center gap-1.5 rounded-[11px] px-1 text-[13px] font-semibold whitespace-nowrap transition-all sm:gap-2 sm:text-[14px] ${
                      selected
                        ? selectedClass
                        : 'text-[var(--color-neutral-600)] hover:text-[var(--color-ink)]'
                    }`}
                  >
                    <Icon size={16} strokeWidth={2.25} aria-hidden />
                    {label}
                  </button>
                );
              },
            )}
          </div>
        ) : earnKinds.length === 0 ? (
          <p className="mb-6 rounded-[12px] bg-[var(--color-neutral-100)] px-3 py-3 text-[13px] text-[var(--color-neutral-500)]">
            Nenhuma campanha ativa para registrar no caixa. Crie carimbos,
            pontos ou cashback em Campanhas.
          </p>
        ) : null}

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
            {loading ? 'Buscando…' : 'Buscar'}
          </button>
        </form>

        {lookup?.multiple && lookup.matches && (
          <section className="mt-8 rounded-[16px] border border-[var(--color-hairline)] bg-[var(--color-card)] p-5 shadow-[var(--shadow-card)]">
            <h2 className="text-[20px] font-semibold">Vários clientes</h2>
            <p className="mt-1 text-[15px] text-[var(--color-neutral-500)]">
              Estes clientes terminam em {lookup.last4}. Qual deles?
            </p>
            <ul className="mt-4 flex flex-col gap-2">
              {lookup.matches.map((m) => (
                <li key={m.customerId}>
                  <button
                    type="button"
                    onClick={() => selectMatch(m)}
                    className="flex min-h-11 w-full items-center justify-between rounded-[12px] border border-[var(--color-hairline)] px-4 text-left hover:border-[var(--color-primary-200)]"
                  >
                    <span className="font-medium">
                      {m.displayName ?? 'Cliente'}
                      {m.isVip ? ' · VIP' : ''}
                      {m.associatedHere === false ? ' · outra loja ou app' : ''}
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
            <h2 className="text-[20px] font-semibold">Cliente não encontrado nesta loja</h2>
            <p className="mt-1 text-[15px] text-[var(--color-neutral-500)]">
              Pode já estar no Frego (aplicativo ou outra loja). Informe o
              telefone completo para localizar ou cadastrar.
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
            {showAmount && (
              <AmountField
                amount={amount}
                setAmount={setAmount}
                previewPoints={previewPoints}
                pointsPerReal={pointsPerReal}
                previewCashback={previewCashback}
                cashbackPercent={cashbackPercent}
                applyCents={applyCents}
                paidCents={paidCents}
                showPointsRate={earnMode === 'points'}
              />
            )}
            <button
              type="button"
              onClick={() => void resolveFullPhoneAndEarn()}
              disabled={loading}
              className="mt-4 min-h-11 w-full rounded-[12px] bg-[var(--color-primary-500)] text-[15px] font-semibold text-white disabled:bg-[var(--color-primary-200)]"
            >
              {!canEarn
                ? 'Buscar / criar cliente'
                : earnMode === 'points'
                  ? 'Buscar / criar e registrar gasto'
                  : earnMode === 'cashback'
                    ? 'Buscar / criar e registrar cashback'
                    : 'Buscar / criar e dar primeiro carimbo'}
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
                {(lookup.otherShopsCount ?? 0) > 0
                  ? `Já está no Frego — ativo em ${lookup.otherShopsCount} outro${lookup.otherShopsCount === 1 ? '' : 's'} estabelecimento${lookup.otherShopsCount === 1 ? '' : 's'}. Adicione a esta loja para carimbar.`
                  : 'Já está no Frego (aplicativo), mas ainda não nesta loja. Adicione para carimbar.'}
              </p>
            )}

            {(showStampsPool || showPointsPool) && (
            <div
              className={`mt-4 grid gap-2 ${
                showStampsPool && showPointsPool ? 'grid-cols-2' : 'grid-cols-1'
              }`}
            >
              {showStampsPool && (
                <div className="rounded-[14px] bg-[var(--color-stamps-bg)] px-3 py-3 ring-1 ring-inset ring-[var(--color-stamps-ring)]">
                  <p className="text-[12px] font-semibold uppercase tracking-[0.04em] text-[var(--color-stamps)]">
                    Carimbos
                  </p>
                  <p className="mt-1 text-[24px] font-semibold text-[var(--color-ink)]">
                    {pools.stamps}
                  </p>
                </div>
              )}
              {showPointsPool && (
                <div className="rounded-[14px] bg-[var(--color-points-bg)] px-3 py-3 ring-1 ring-inset ring-[var(--color-points-ring)]">
                  <p className="text-[12px] font-semibold uppercase tracking-[0.04em] text-[var(--color-points)]">
                    Pontos
                  </p>
                  <p className="mt-1 text-[24px] font-semibold text-[var(--color-ink)]">
                    {pools.points}
                  </p>
                </div>
              )}
            </div>
            )}
            {cashbackBalance > 0 || canEarnCashback ? (
              <div className="mt-2 rounded-[14px] bg-[var(--color-cashback-bg)] px-3 py-3 ring-1 ring-inset ring-[var(--color-cashback-ring)]">
                <p className="text-[12px] font-semibold uppercase tracking-[0.04em] text-[var(--color-cashback)]">
                  Cashback
                </p>
                <p className="mt-1 text-[24px] font-semibold text-[var(--color-ink)]">
                  {formatBrl(cashbackBalance)}
                </p>
                {cashbackPercent > 0 && earnMode === 'cashback' && (
                  <p className="mt-1 text-[12px] text-[var(--color-cashback)]">
                    {cashbackPercent}% do valor pago
                  </p>
                )}
                {cashbackBalance > 0 && saleMode && (
                  <div className="mt-3">
                    <label className="flex cursor-pointer items-center gap-2 text-[13px] font-semibold text-[var(--color-ink)]">
                      <input
                        type="checkbox"
                        checked={applyCashback}
                        onChange={(e) => setApplyCashback(e.target.checked)}
                        className="h-4 w-4 rounded border-[var(--color-neutral-300)]"
                      />
                      Usar cashback nesta compra
                    </label>
                    {applyCashback && (
                      <label className="mt-2 block text-[12px] font-semibold uppercase tracking-[0.04em] text-[var(--color-cashback)]">
                        Valor a usar (R$)
                        <input
                          value={applyAmount}
                          onChange={(e) =>
                            setApplyAmount(maskMoneyInput(e.target.value))
                          }
                          inputMode="numeric"
                          className="mt-1.5 min-h-12 w-full rounded-[8px] border border-[var(--color-cashback-ring)] bg-[var(--color-card)] px-3 text-center text-[22px] font-semibold text-[var(--color-ink)]"
                          placeholder={
                            maxApplyCents > 0
                              ? formatCentsAsInput(maxApplyCents)
                              : '0,00'
                          }
                        />
                      </label>
                    )}
                    <p className="mt-1.5 text-[12px] leading-relaxed text-[var(--color-cashback)]">
                      {applyCashback && applyCents > 0
                        ? `Desconta ${formatBrl(applyCents)} do saldo. O caixa da loja cobra ${formatBrl(paidCents || (amountCents ?? 0))}.`
                        : `Saldo disponível: ${formatBrl(cashbackBalance)}. Informe quanto o outro sistema descontou.`}
                    </p>
                  </div>
                )}
              </div>
            ) : null}

            <p className="mt-3 text-[13px] text-[var(--color-neutral-500)]">
              {earnMode === 'cashback'
                ? 'O pagamento acontece no caixa da loja. Aqui só registramos o valor e o cashback usado.'
                : 'O resgate de carimbos e pontos é no aplicativo do cliente. Confirme o voucher abaixo ao entregar o prêmio.'}
            </p>

            {openVouchers.length > 0 && (
              <div className="mt-4 rounded-[12px] border border-[var(--color-hairline)] bg-[var(--color-bg)] p-3">
                <p className="text-[12px] font-semibold uppercase tracking-[0.04em] text-[var(--color-neutral-400)]">
                  Vouchers em aberto · {openVouchers.length}
                </p>
                <ul className="mt-2 flex flex-col gap-2">
                  {openVouchers.map((v) => (
                    <li
                      key={v.transactionId}
                      className="flex items-center gap-3 rounded-[10px] border border-[var(--color-hairline)] bg-[var(--color-card)] px-3 py-2.5"
                    >
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-[14px] font-semibold text-[var(--color-ink)]">
                          {v.rewardTitle}
                        </p>
                        <p className="font-mono text-[13px] tracking-[0.08em] text-[var(--color-neutral-500)]">
                          {v.voucherDisplay}
                        </p>
                        {v.expiresAt && (
                          <p className="mt-0.5 text-[11px] text-[var(--color-neutral-400)]">
                            Válido até{' '}
                            {new Date(v.expiresAt).toLocaleString('pt-BR', {
                              day: '2-digit',
                              month: 'short',
                              hour: '2-digit',
                              minute: '2-digit',
                            })}{' '}
                            · 24h
                          </p>
                        )}
                      </div>
                      <button
                        type="button"
                        disabled={fulfillingId != null}
                        onClick={() =>
                          void fulfillVoucher({
                            transactionId: v.transactionId,
                          })
                        }
                        className="min-h-9 shrink-0 rounded-[8px] bg-[var(--color-success)] px-3 text-[13px] font-semibold text-white disabled:opacity-60"
                      >
                        {fulfillingId === v.transactionId
                          ? '…'
                          : 'Confirmar'}
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {showAmount && (
              <AmountField
                amount={amount}
                setAmount={setAmount}
                previewPoints={previewPoints}
                pointsPerReal={pointsPerReal}
                previewCashback={previewCashback}
                cashbackPercent={cashbackPercent}
                applyCents={applyCents}
                paidCents={paidCents}
                showPointsRate={earnMode === 'points'}
              />
            )}

            <button
              type="button"
              onClick={() =>
                lookup.associatedHere && lookup.membership
                  ? earn()
                  : createCustomer(canEarn)
              }
              disabled={
                loading ||
                (Boolean(lookup.associatedHere) &&
                  !canEarn &&
                  !canApplyLeftover)
              }
              className="mt-6 min-h-11 w-full rounded-[12px] bg-[var(--color-primary-500)] text-[15px] font-semibold text-white shadow-[var(--shadow-cta)] disabled:bg-[var(--color-primary-200)]"
            >
              {lookup.associatedHere
                ? primaryAction
                : !canEarn
                  ? 'Adicionar à loja'
                  : earnMode === 'points'
                    ? 'Adicionar à loja e registrar'
                    : earnMode === 'cashback'
                      ? 'Adicionar à loja e registrar cashback'
                      : 'Adicionar à loja e carimbar'}
            </button>

            {(lookup.recentSales?.length ?? 0) > 0 && (
              <div className="mt-5 border-t border-[var(--color-hairline)] pt-4">
                <p className="text-[12px] font-semibold uppercase tracking-[0.04em] text-[var(--color-neutral-400)]">
                  Lançamentos deste cliente
                </p>
                <p className="mt-1 text-[12px] leading-relaxed text-[var(--color-neutral-500)]">
                  Errou o valor ou o carimbo? Desfaça. Só funciona se o
                  cliente ainda não usou o benefício.
                </p>
                <ul className="mt-3 flex flex-col gap-2">
                  {lookup.recentSales!.map((sale) => {
                    const busy = reversingId === sale.anchorId;
                    return (
                      <li
                        key={sale.saleId}
                        className="rounded-[12px] border border-[var(--color-hairline)] bg-[var(--color-bg)] px-3 py-2.5"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <p className="text-[14px] font-semibold text-[var(--color-ink)]">
                              {sale.summary}
                            </p>
                            <p className="mt-0.5 text-[12px] text-[var(--color-neutral-400)]">
                              {formatSaleClock(sale.createdAt)}
                            </p>
                          </div>
                          <button
                            type="button"
                            disabled={reversingId != null}
                            onClick={() => setPendingUndo(sale)}
                            className="inline-flex min-h-8 shrink-0 items-center gap-1 rounded-[8px] px-2.5 text-[12px] font-semibold text-[var(--color-neutral-600)] hover:bg-[var(--color-card)] hover:text-[var(--color-ink)] disabled:opacity-60"
                          >
                            <Undo2 size={14} strokeWidth={2.25} aria-hidden />
                            {busy ? '…' : 'Desfazer'}
                          </button>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              </div>
            )}
          </section>
        )}

        {toast ? (
          <div
            className={`fixed left-1/2 z-50 w-[min(92vw,24rem)] -translate-x-1/2 rounded-full bg-[var(--color-ink)] px-4 py-3 text-center text-[14px] text-white shadow-[var(--shadow-raised)] ${
              lastSale
                ? 'bottom-[calc(9.75rem+env(safe-area-inset-bottom))] md:bottom-[6.5rem]'
                : 'bottom-[calc(5.5rem+env(safe-area-inset-bottom))] md:bottom-6'
            }`}
            role="status"
          >
            {toast}
          </div>
        ) : null}

        {lastSale ? (
          <div
            className="fixed bottom-[calc(5.5rem+env(safe-area-inset-bottom))] left-1/2 z-40 flex w-[min(92vw,24rem)] -translate-x-1/2 items-center gap-3 rounded-[16px] bg-[var(--color-ink)] px-4 py-3 text-white shadow-[var(--shadow-raised)] md:bottom-6"
            role="status"
          >
            <div className="min-w-0 flex-1">
              <p className="text-[11px] font-semibold uppercase tracking-[0.04em] text-white/60">
                Registrado
              </p>
              <p className="truncate text-[14px] font-semibold">
                {lastSale.summary}
              </p>
            </div>
            <button
              type="button"
              disabled={reversingId != null}
              onClick={() => setPendingUndo(lastSale)}
              className="inline-flex min-h-9 shrink-0 items-center gap-1.5 rounded-[8px] bg-white/10 px-3 text-[13px] font-semibold text-white"
            >
              <Undo2 size={15} strokeWidth={2.25} aria-hidden />
              {reversingId === lastSale.anchorId ? '…' : 'Desfazer'}
            </button>
          </div>
        ) : null}

        {pendingUndo ? (
          <div
            className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 px-4"
            role="dialog"
            aria-modal="true"
            aria-labelledby="undo-title"
            onClick={() => reversingId == null && setPendingUndo(null)}
          >
            <div
              className="w-full max-w-sm rounded-[16px] bg-[var(--color-card)] p-5 shadow-[var(--shadow-raised)]"
              onClick={(e) => e.stopPropagation()}
            >
              <p
                id="undo-title"
                className="text-[16px] font-semibold text-[var(--color-ink)]"
              >
                Desfazer lançamento?
              </p>
              <p className="mt-2 text-[14px] leading-relaxed text-[var(--color-neutral-600)]">
                {pendingUndo.summary}
              </p>
              <p className="mt-2 text-[12px] leading-relaxed text-[var(--color-neutral-500)]">
                Só funciona se o cliente ainda não usou o benefício.
              </p>
              <div className="mt-5 flex justify-end gap-2">
                <button
                  type="button"
                  disabled={reversingId != null}
                  onClick={() => setPendingUndo(null)}
                  className="min-h-10 rounded-[10px] px-3 text-[14px] font-semibold text-[var(--color-neutral-600)]"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  disabled={reversingId != null}
                  onClick={() => void reverseSale(pendingUndo)}
                  className="min-h-10 rounded-[10px] bg-[var(--color-danger)] px-4 text-[14px] font-semibold text-white disabled:opacity-60"
                >
                  {reversingId === pendingUndo.anchorId ? '…' : 'Desfazer'}
                </button>
              </div>
            </div>
          </div>
        ) : null}
      </main>
    </AppShell>
  );
}

function AmountField({
  amount,
  setAmount,
  previewPoints,
  pointsPerReal,
  previewCashback = 0,
  cashbackPercent = 0,
  applyCents = 0,
  paidCents = 0,
  showPointsRate = true,
}: {
  amount: string;
  setAmount: (v: string) => void;
  previewPoints: number;
  pointsPerReal: number;
  previewCashback?: number;
  cashbackPercent?: number;
  applyCents?: number;
  paidCents?: number;
  showPointsRate?: boolean;
}) {
  const chips = [2000, 4000, 6000, 10000];
  return (
    <div className="mt-4">
      <label className="block text-[13px] font-semibold uppercase tracking-[0.04em]">
        Valor da compra (R$)
        <input
          value={amount}
          onChange={(e) => setAmount(maskMoneyInput(e.target.value))}
          inputMode="numeric"
          className="mt-2 min-h-14 w-full rounded-[8px] border border-[var(--color-neutral-200)] px-3 text-center text-[28px] font-semibold"
          placeholder="0,00"
        />
      </label>
      {showPointsRate && (
        <p className="mt-1 text-[12px] text-[var(--color-neutral-400)]">
          Taxa da loja: R$ {pointsPerReal} → 1 ponto
        </p>
      )}
      {cashbackPercent > 0 && (
        <p className="mt-1 text-[12px] text-[var(--color-cashback)]">
          Cashback {cashbackPercent}%
        </p>
      )}
      <div className="mt-2 flex flex-wrap gap-2">
        {chips.map((cents) => (
          <button
            key={cents}
            type="button"
            onClick={() => setAmount(formatCentsAsInput(cents))}
            className="min-h-9 rounded-[8px] border border-[var(--color-hairline)] px-3 text-[13px] font-semibold text-[var(--color-neutral-700)]"
          >
            {formatBrl(cents)}
          </button>
        ))}
      </div>
      {applyCents > 0 && (
        <p className="mt-2 text-center text-[13px] font-semibold text-[var(--color-cashback)]">
          −{formatBrl(applyCents)} de cashback · a pagar {formatBrl(paidCents)}
        </p>
      )}
      {previewPoints > 0 && (
        <p className="mt-2 text-center text-[13px] font-semibold text-[var(--color-primary-600)]">
          +{previewPoints} {previewPoints === 1 ? 'ponto' : 'pontos'}
        </p>
      )}
      {previewCashback > 0 && (
        <p className="mt-1 text-center text-[13px] font-semibold text-[var(--color-cashback)]">
          +{formatBrl(previewCashback)} de cashback
        </p>
      )}
    </div>
  );
}
