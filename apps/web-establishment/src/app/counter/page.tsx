'use client';

import {
  FormEvent,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { Banknote, Coins, ScanQrCode, Stamp, Undo2 } from 'lucide-react';
import { useBusiness } from '@/lib/business-context';
import { AppShell } from '@/components/app-shell';
import {
  CounterSheet,
  StickyActionBar,
  type StickyTone,
} from '@/components/counter-chrome';
import { VoucherScanSheet } from '@/components/voucher-scan-sheet';
import { TagChipRow } from '@/components/tag-chips';
import { API_URL } from '@/lib/api';
import {
  digitsOnly,
  formatPhoneBr,
  phoneDigitsForApi,
} from '@/lib/phone';
import { formatBrl, formatCentsAsInput, maskMoneyInput, parseMoneyToCents } from '@/lib/money';
import { tagChipStyle, type CatalogTag, type CustomerTag } from '@/lib/tags';
import {
  formatVoucherInput,
  normalizeVoucherCode,
} from '@/lib/voucher';

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
type TillFocus = 'none' | 'voucher' | 'phone' | 'fullPhone' | 'amount' | 'apply';
type TillTask = 'earn' | 'voucher';
type CounterOverlay = 'matches' | 'vouchers' | 'sales' | 'tags' | 'scan' | null;

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
  tags?: CustomerTag[];
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
  tags?: CustomerTag[];
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
  const phoneInputRef = useRef<HTMLInputElement>(null);
  const fullPhoneRef = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState('');
  const [fullPhone, setFullPhone] = useState('');
  const [createName, setCreateName] = useState('');
  const [amount, setAmount] = useState('');
  const [earnMode, setEarnMode] = useState<EarnMode>('stamps');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lookup, setLookup] = useState<LookupResult | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [lastSale, setLastSale] = useState<CounterSale | null>(null);
  const [pendingUndo, setPendingUndo] = useState<CounterSale | null>(null);
  const [pendingCreate, setPendingCreate] = useState(false);
  const [reversingId, setReversingId] = useState<string | null>(null);
  const [voucherCode, setVoucherCode] = useState('');
  const [tillTask, setTillTask] = useState<TillTask>('earn');
  const [voucherAmount, setVoucherAmount] = useState('');
  const [focus, setFocus] = useState<TillFocus>('none');
  const [overlay, setOverlay] = useState<CounterOverlay>(null);
  const [canScan, setCanScan] = useState(true);
  const [applyCashback, setApplyCashback] = useState(false);
  const [applyAmount, setApplyAmount] = useState('');
  const [fulfillingId, setFulfillingId] = useState<string | null>(null);
  const [fetchedKinds, setFetchedKinds] = useState<EarnMode[] | null>(null);
  const [catalog, setCatalog] = useState<CatalogTag[]>([]);
  const [tagDraft, setTagDraft] = useState<string[]>([]);
  const [tagBusy, setTagBusy] = useState(false);
  const [pendingVoucher, setPendingVoucher] = useState<{
    voucherCode: string;
    voucherDisplay: string;
    rewardTitle: string;
    customerName: string;
    phoneTail: string | null;
  } | null>(null);
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
    amountCents?: number | null;
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
        const tagRes = await fetch(`${API_URL}/tags`, {
          headers: await bizAuthHeaders(),
        });
        const tagJson = await tagRes.json().catch(() => ({}));
        if (!cancelled && tagRes.ok) setCatalog(tagJson.tags ?? []);
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

  useEffect(() => {
    const mq = window.matchMedia('(max-width: 1400px)');
    const update = () => {
      const touch =
        window.matchMedia('(pointer: coarse)').matches ||
        navigator.maxTouchPoints > 0;
      setCanScan(
        touch && mq.matches && !!navigator.mediaDevices?.getUserMedia,
      );
    };
    update();
    mq.addEventListener('change', update);
    return () => mq.removeEventListener('change', update);
  }, []);

  useEffect(() => {
    if (!canScan && overlay === 'scan') setOverlay(null);
  }, [canScan, overlay]);

  const applyScannedCodigo = useCallback((codigo: string) => {
    setVoucherCode(formatVoucherInput(codigo));
    setVoucherAmount('');
    setVoucherResult(null);
    setOverlay(null);
    setFocus('voucher');
  }, []);

  async function authHeaders(): Promise<HeadersInit> {
    return {
      ...(await bizAuthHeaders()),
      'Content-Type': 'application/json',
    };
  }

  function openTagSheet() {
    if (catalog.length === 0 || !lookup?.associatedHere) return;
    setTagDraft((lookup.tags ?? []).map((t) => t.id));
    setOverlay('tags');
  }

  async function saveTags() {
    const customerId = lookup?.customer?.id;
    if (!customerId || tagBusy) return;
    setTagBusy(true);
    setError(null);
    try {
      const res = await fetch(`${API_URL}/customers/${customerId}`, {
        method: 'PATCH',
        headers: await authHeaders(),
        body: JSON.stringify({ tagIds: tagDraft }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(
          json.message ?? json.error ?? 'Não foi possível salvar as etiquetas.',
        );
      }
      setLookup((prev) =>
        prev ? { ...prev, tags: json.tags ?? [] } : prev,
      );
      setOverlay(null);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Não foi possível salvar as etiquetas.',
      );
    } finally {
      setTagBusy(false);
    }
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
    setCreateName('');
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
        setFocus('none');
        phoneInputRef.current?.blur();
        if (qDigits.length >= 10) setFullPhone(formatPhoneBr(qDigits));
        else {
          setFullPhone('');
          window.setTimeout(() => fullPhoneRef.current?.focus(), 60);
        }
        return;
      }
      if (!res.ok) {
        throw new Error(data.error ?? 'Não foi possível buscar.');
      }
      setLookup(data);
      if (data.multiple) setOverlay('matches');
      if (data.found && data.customer && !data.multiple) {
        setFocus((current) => (current === 'phone' ? 'none' : current));
        phoneInputRef.current?.blur();
      }
      if (!data.found && !data.multiple) {
        setFocus('none');
        phoneInputRef.current?.blur();
        if (qDigits.length >= 10) setFullPhone(formatPhoneBr(qDigits));
        else {
          setFullPhone('');
          window.setTimeout(() => fullPhoneRef.current?.focus(), 60);
        }
      }
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
      if (data.found && data.customer && !data.multiple) {
        setFocus((current) => (current === 'phone' ? 'none' : current));
        phoneInputRef.current?.blur();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Não foi possível buscar.');
    } finally {
      setLoading(false);
    }
  }

  /** From not-found: try global lookup first, then create if new. */
  async function resolveFullPhoneAndEarn(phoneOverride?: string) {
    const phone = phoneDigitsForApi(phoneOverride ?? createPhoneDigits);
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

  function askCreateNotFound() {
    if (!hasFullPhoneForCreate) {
      setError('Informe o telefone completo com DDD.');
      setFocus('fullPhone');
      return;
    }
    if (
      canEarn &&
      (earnMode === 'points' || earnMode === 'cashback') &&
      amountCents == null
    ) {
      setError('Informe o valor da compra.');
      setFocus('amount');
      return;
    }
    setPendingCreate(true);
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
      const name = createName.trim().slice(0, 80);
      const res = await fetch(`${API_URL}/customers`, {
        method: 'POST',
        headers: await authHeaders(),
        body: JSON.stringify({
          phone,
          addFirstStamp: earnMode === 'stamps' && withEarn && amountCents == null,
          ...(name ? { displayName: name } : {}),
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

  function phoneTail(phone?: string | null): string | null {
    const digits = (phone ?? '').replace(/\D/g, '');
    if (digits.length < 4) return null;
    return digits.slice(-4);
  }

  async function requestVoucherConfirm(code: string) {
    setFulfillingId(code);
    setError(null);
    setVoucherResult(null);
    setPendingVoucher(null);
    let handedOff = false;
    try {
      const res = await fetch(
        `${API_URL}/vouchers/lookup?code=${encodeURIComponent(code)}`,
        { headers: await authHeaders() },
      );
      const data = await res.json();
      const voucher = data.voucher as
        | {
            status?: string;
            voucherCode?: string;
            voucherDisplay?: string;
            rewardTitle?: string;
          }
        | undefined;
      const customer = data.customer as
        | { displayName?: string | null; phoneE164?: string | null }
        | undefined;
      if (!res.ok || voucher?.status !== 'open') {
        handedOff = true;
        setFulfillingId(null);
        await fulfillVoucher({ voucherCode: code });
        return;
      }
      setPendingVoucher({
        voucherCode: voucher.voucherCode ?? code,
        voucherDisplay: voucher.voucherDisplay ?? code,
        rewardTitle: voucher.rewardTitle ?? 'Prêmio',
        customerName: customer?.displayName?.trim() || 'Cliente sem nome',
        phoneTail: phoneTail(customer?.phoneE164),
      });
    } catch (err) {
      const message =
        err instanceof Error ? err.message : 'Não foi possível buscar o voucher.';
      setVoucherResult({ kind: 'error', message });
      setError(message);
    } finally {
      if (!handedOff) setFulfillingId(null);
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
      if (!voucherAmount && amount) setVoucherAmount(amount);
      const ticket =
        parseMoneyToCents(voucherAmount || amount) ?? undefined;
      const res = await fetch(`${API_URL}/vouchers/fulfill`, {
        method: 'POST',
        headers: await authHeaders(),
        body: JSON.stringify({
          ...opts,
          ...(ticket != null ? { amountCents: ticket } : {}),
        }),
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
            amountCents?: number | null;
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
        amountCents: voucher?.amountCents ?? null,
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
  const showCashbackPool = cashbackBalance > 0 || canEarnCashback;
  const balanceCount = [showStampsPool, showPointsPool, showCashbackPool].filter(
    Boolean,
  ).length;
  const title =
    tillTask === 'voucher'
      ? 'Confirmar voucher'
      : earnKinds.length === 0
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
  const notFoundAction = (() => {
    const hasFull =
      digitsOnly(fullPhone).length >= 10 ||
      digitsOnly(query).length >= 10 ||
      digitsOnly(lookup?.phoneE164 ?? '').length >= 10;
    if (!hasFull) return 'Informe o telefone';
    if (!canEarn) return 'Criar cliente';
    return earnMode === 'points'
      ? 'Criar e registrar gasto'
      : earnMode === 'cashback'
        ? 'Criar e registrar cashback'
        : 'Criar e carimbar';
  })();
  const queryIsFullPhone = digitsOnly(query).length >= 10;
  const hasFullPhoneForCreate =
    digitsOnly(fullPhone).length >= 10 ||
    queryIsFullPhone ||
    digitsOnly(lookup?.phoneE164 ?? '').length >= 10;
  const createPhoneDigits = (() => {
    const full = phoneDigitsForApi(fullPhone);
    if (digitsOnly(full).length >= 10) return full;
    const q = phoneDigitsForApi(query);
    if (digitsOnly(q).length >= 10) return q;
    return phoneDigitsForApi(lookup?.phoneE164 ?? '');
  })();
  const createBenefitSummary = !canEarn
    ? 'cadastrar o cliente nesta loja'
    : earnMode === 'points'
      ? 'cadastrar e registrar o gasto em pontos'
      : earnMode === 'cashback'
        ? 'cadastrar e registrar o cashback'
        : 'cadastrar e dar o primeiro carimbo';
  const foundAction = lookup?.associatedHere
    ? primaryAction
    : !canEarn
      ? 'Adicionar à loja'
      : earnMode === 'points'
        ? 'Adicionar à loja e registrar'
        : earnMode === 'cashback'
          ? 'Adicionar à loja e registrar cashback'
          : 'Adicionar à loja e carimbar';
  const voucherTask = tillTask === 'voucher';
  const voucherExpired = voucherResult?.kind === 'expired';
  const customerResolved = Boolean(
    lookup?.found && lookup.customer && !lookup.multiple,
  );
  const awaitingCreate = Boolean(
    lookup && !lookup.found && !lookup.multiple,
  );
  const searchSettled = Boolean(lookup) && tillTask === 'earn';
  const actionTone: StickyTone = !canEarn
    ? canApplyLeftover
      ? 'cashback'
      : 'primary'
    : earnMode === 'points'
      ? 'points'
      : earnMode === 'cashback'
        ? 'cashback'
        : 'stamps';
  const stickyLabel =
    voucherTask && voucherExpired
      ? fulfillingId
        ? '…'
        : 'Aceitar mesmo assim'
      : voucherTask
        ? fulfillingId
          ? '…'
          : 'Usar'
        : customerResolved
          ? foundAction
          : awaitingCreate
            ? notFoundAction
            : focus === 'phone'
              ? loading
                ? 'Buscando…'
                : 'Buscar'
              : focus === 'fullPhone'
                ? loading
                  ? 'Buscando…'
                  : notFoundAction
                : !lookup || lookup.multiple
                  ? loading
                    ? 'Buscando…'
                    : 'Buscar'
                  : !lookup.found
                    ? loading
                      ? 'Buscando…'
                      : notFoundAction
                    : foundAction;
  const stickyTone: StickyTone =
    customerResolved || awaitingCreate ? actionTone : 'primary';
  const phoneDigits = digitsOnly(query);
  const phoneReady = phoneDigits.length === 4 || phoneDigits.length >= 10;
  const stickyDisabled =
    (voucherTask &&
      (fulfillingId != null ||
        (!voucherExpired && normalizeVoucherCode(voucherCode).length < 4))) ||
    (!voucherTask &&
      !customerResolved &&
      !awaitingCreate &&
      focus === 'phone' &&
      (loading || !phoneReady)) ||
    (!voucherTask &&
      (customerResolved || focus !== 'phone') &&
      (loading ||
        Boolean(
          lookup?.found &&
            lookup.associatedHere &&
            !canEarn &&
            !canApplyLeftover,
        )));

  function startNewSearch() {
    setLookup(null);
    setError(null);
    setVoucherResult(null);
    setApplyCashback(false);
    setLastSale(null);
    setQuery('');
    setCreateName('');
    setFullPhone('');
    setFocus('none');
  }

  const resultScrollKey =
    !lookup || lookup.multiple
      ? ''
      : `${lookup.found}:${lookup.customer?.id ?? lookup.phoneE164 ?? lookup.last4 ?? 'new'}`;
  useEffect(() => {
    if (!resultScrollKey) return;
    window.scrollTo(0, 0);
  }, [resultScrollKey]);

  function runStickyAction() {
    if (voucherTask) {
      if (voucherExpired) {
        void fulfillVoucher({
          transactionId: voucherResult?.transactionId,
          voucherCode: voucherResult?.voucherCode,
          acceptExpired: true,
        });
        return;
      }
      const code = normalizeVoucherCode(voucherCode);
      if (code.length < 4) return;
      void requestVoucherConfirm(code);
      return;
    }
    if (customerResolved && lookup) {
      if (lookup.associatedHere && lookup.membership) void earn();
      else void createCustomer(canEarn);
      return;
    }
    if (awaitingCreate) {
      askCreateNotFound();
      return;
    }
    if (focus === 'phone' || !lookup || lookup.multiple) {
      void doLookup();
      return;
    }
    if (focus === 'fullPhone' || !lookup.found) {
      askCreateNotFound();
      return;
    }
    if (lookup.associatedHere && lookup.membership) void earn();
    else void createCustomer(canEarn);
  }

  return (
    <AppShell title="Balcão">
      <main className="mx-auto max-w-lg px-4 py-6 pb-40 md:py-10 md:pb-36">
        <header className={searchSettled ? 'mb-3' : 'mb-5'}>
          <p className="text-[12px] font-semibold uppercase tracking-[0.04em] text-[var(--color-neutral-400)]">
            Balcão · {business?.name ?? 'funcionário'}
          </p>
          <h1 className="mt-1 text-[28px] font-semibold tracking-[-0.03em] text-[var(--color-ink)]">
            {title}
          </h1>
          <p className="mt-1 text-[14px] leading-relaxed text-[var(--color-neutral-500)]">
            {tillTask === 'voucher'
              ? 'Código que o cliente mostra no app.'
              : 'Últimos 4 dígitos do celular.'}
          </p>
        </header>

        <div className={`flex gap-1 rounded-[14px] bg-[var(--color-neutral-100)] p-1 ${searchSettled ? 'mb-3' : 'mb-5'}`}>
          {(
            [
              { value: 'earn' as const, label: 'Registrar' },
              { value: 'voucher' as const, label: 'Voucher' },
            ] as const
          ).map((opt) => {
            const selected = tillTask === opt.value;
            return (
              <button
                key={opt.value}
                type="button"
                onClick={() => {
                  setTillTask(opt.value);
                  if (opt.value === 'voucher') {
                    if (!voucherAmount && amount) setVoucherAmount(amount);
                    setFocus('voucher');
                  } else {
                    setFocus('none');
                    setOverlay((o) => (o === 'scan' ? null : o));
                  }
                }}
                className={`flex min-h-11 flex-1 items-center justify-center rounded-[11px] px-3 text-[14px] font-semibold ${
                  selected
                    ? 'bg-[var(--color-card)] text-[var(--color-ink)] shadow-[0_1px_3px_rgba(16,24,40,0.08)]'
                    : 'text-[var(--color-neutral-500)]'
                }`}
              >
                {opt.label}
              </button>
            );
          })}
        </div>

        {tillTask === 'voucher' ? (
        <section className="mb-6 rounded-[16px] border border-[var(--color-hairline)] bg-[var(--color-card)] p-4 shadow-[var(--shadow-card)]" id="voucher-section">
          <p className="text-[13px] font-semibold uppercase tracking-[0.04em] text-[var(--color-neutral-400)]">
            Código do prêmio
          </p>
          <form
            className="mt-3"
            onSubmit={(e) => {
              e.preventDefault();
              const code = normalizeVoucherCode(voucherCode);
              if (code.length < 4) return;
              void requestVoucherConfirm(code);
            }}
          >
            <input
              value={voucherCode}
              onChange={(e) => setVoucherCode(formatVoucherInput(e.target.value))}
              onFocus={() => {
                setFocus('voucher');
              }}
              onBlur={() => setFocus((f) => (f === 'voucher' ? 'none' : f))}
              placeholder="K7M-2PQ"
              maxLength={7}
              inputMode="text"
              className="min-h-20 w-full rounded-[12px] border border-[var(--color-neutral-200)] bg-[var(--color-bg)] px-3 text-center font-mono text-[31px] font-semibold leading-none tracking-[0.08em] md:text-[39px]"
              autoCapitalize="characters"
              autoCorrect="off"
              spellCheck={false}
            />
          </form>
          {canScan ? (
            <button
              type="button"
              onClick={() => setOverlay('scan')}
              disabled={fulfillingId != null}
              className="mt-3 inline-flex min-h-14 w-full items-center justify-center gap-2 rounded-[12px] border border-[var(--color-hairline)] bg-[var(--color-bg)] text-[16px] font-semibold text-[var(--color-ink)] disabled:opacity-50"
            >
              <ScanQrCode size={22} strokeWidth={2.25} aria-hidden />
              Escanear QR
            </button>
          ) : null}
          <label className="mt-3 block">
            <span className="text-[12px] font-medium text-[var(--color-neutral-500)]">
              Valor desta compra (R$)
            </span>
            <input
              value={voucherAmount}
              onChange={(e) => setVoucherAmount(maskMoneyInput(e.target.value))}
              onFocus={() => {
                setFocus('voucher');
                if (!voucherAmount && amount) setVoucherAmount(amount);
              }}
              placeholder="Opcional"
              inputMode="numeric"
              className="mt-1 min-h-16 w-full rounded-[12px] border border-[var(--color-neutral-200)] bg-[var(--color-bg)] px-3 text-center text-[27px] font-semibold leading-none md:min-h-20 md:text-[35px]"
            />
            <span className="mt-1 block text-[12px] text-[var(--color-neutral-400)]">
              Opcional · retorno da campanha
            </span>
          </label>
          <div className="mt-2 flex flex-wrap gap-2">
            {[2000, 4000, 6000, 10000].map((cents) => (
              <button
                key={cents}
                type="button"
                onClick={() => setVoucherAmount(formatCentsAsInput(cents))}
                className="min-h-10 rounded-[10px] border border-[var(--color-hairline)] px-3 text-[13px] font-semibold text-[var(--color-ink)]"
              >
                {formatBrl(cents)}
              </button>
            ))}
          </div>

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
                  {voucherResult.amountCents != null && (
                    <p className="mt-0.5 text-[13px] text-[var(--color-neutral-600)]">
                      {voucherResult.amountCents === 0
                        ? 'Sem valor nesta compra'
                        : `${formatBrl(voucherResult.amountCents)} nesta compra`}
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
        ) : (
        <>
        {earnKinds.length > 1 ? (
          <div className={`flex gap-1 rounded-[14px] bg-[var(--color-neutral-100)] p-1 ${searchSettled ? 'mb-3' : 'mb-6'}`}>
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

        {lookup ? null : (
        <form onSubmit={doLookup} className="flex flex-col gap-3">
          <label className="text-[13px] font-semibold uppercase tracking-[0.04em] text-[var(--color-neutral-700)]">
            {isLast4 ? 'Últimos 4 dígitos' : 'Telefone'}
            <input
              ref={phoneInputRef}
              value={query}
              onChange={(e) => {
                const raw = e.target.value;
                const d = digitsOnly(raw);
                // 4 dígitos = busca rápida; acima disso aplica máscara com DDD
                setQuery(d.length <= 4 ? d : formatPhoneBr(raw));
              }}
              onFocus={() => setFocus('phone')}
              onBlur={() => setFocus((f) => (f === 'phone' ? 'none' : f))}
              inputMode="numeric"
              autoComplete="off"
              autoFocus
              className={`mt-2 min-h-20 w-full rounded-[12px] border bg-[var(--color-card)] px-3 text-center text-[35px] font-semibold leading-none md:min-h-24 md:text-[43px] ${
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
        </form>
        )}

        {lookup && error ? (
          <p className="mt-3 text-[13px] text-[var(--color-danger)]" role="alert">
            {error}
          </p>
        ) : null}

        {lookup?.multiple && lookup.matches && (
          <section className="mt-4 rounded-[16px] border border-[var(--color-hairline)] bg-[var(--color-card)] p-5 shadow-[var(--shadow-card)]">
            <h2 className="text-[20px] font-semibold">Vários clientes</h2>
            <p className="mt-1 text-[15px] text-[var(--color-neutral-500)]">
              Estes clientes terminam em {lookup.last4}. Qual deles?
            </p>
            <button
              type="button"
              onClick={() => setOverlay('matches')}
              className="mt-4 min-h-12 w-full rounded-[12px] bg-[var(--color-primary-500)] text-[15px] font-semibold text-white"
            >
              Ver {lookup.matches.length} clientes
            </button>
          </section>
        )}

        {lookup && !lookup.found && !lookup.multiple && (
          <section className="rounded-[16px] border border-[var(--color-hairline)] bg-[var(--color-card)] p-4 shadow-[var(--shadow-card)]">
            <h2 className="text-[22px] font-semibold">Cliente não encontrado</h2>
            <p className="mt-2 text-[15px] text-[var(--color-neutral-500)]">
              {queryIsFullPhone || hasFullPhoneForCreate
                ? 'Ninguém com este telefone nesta loja. Confirme para cadastrar e registrar o benefício.'
                : 'Busca pelos 4 dígitos não achou. Informe o telefone completo com DDD para cadastrar.'}
            </p>
            {queryIsFullPhone || digitsOnly(fullPhone).length >= 10 ? (
              <p className="mt-4 font-mono text-[28px] font-semibold tracking-wide text-[var(--color-ink)] md:text-[36px]">
                {formatPhoneBr(
                  digitsOnly(
                    digitsOnly(fullPhone).length >= 10 ? fullPhone : query,
                  ),
                )}
              </p>
            ) : (
              <label className="mt-4 block text-[13px] font-semibold uppercase tracking-[0.04em]">
                Telefone completo
                <input
                  ref={fullPhoneRef}
                  value={fullPhone}
                  onChange={(e) => setFullPhone(formatPhoneBr(e.target.value))}
                  onFocus={() => setFocus('fullPhone')}
                  onBlur={() => setFocus((f) => (f === 'fullPhone' ? 'none' : f))}
                  inputMode="tel"
                  autoComplete="tel"
                  className="mt-2 min-h-20 w-full rounded-[12px] border border-[var(--color-neutral-200)] px-3 text-[31px] font-semibold leading-none tracking-wide md:text-[35px]"
                  placeholder="(19) 99488-5914"
                />
              </label>
            )}
            <label className="mt-4 block text-[13px] font-semibold uppercase tracking-[0.04em]">
              Nome (opcional)
              <input
                value={createName}
                onChange={(e) => setCreateName(e.target.value.slice(0, 80))}
                maxLength={80}
                autoComplete="name"
                autoCapitalize="words"
                className="mt-2 min-h-14 w-full rounded-[12px] border border-[var(--color-neutral-200)] px-3 text-[20px] md:min-h-16 md:text-[24px]"
                placeholder="Como o cliente se chama"
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
                onFocus={() => setFocus('amount')}
                onBlur={() => setFocus((f) => (f === 'amount' ? 'none' : f))}
              />
            )}
          </section>
        )}

        {lookup?.found && lookup.customer && !lookup.multiple && (
          <section className="rounded-[16px] border border-[var(--color-hairline)] bg-[var(--color-card)] p-4 shadow-[var(--shadow-card)]">
            <h2 className="truncate text-[20px] font-semibold">
              {lookup.customer.displayName ?? 'Cliente'}
            </h2>
            <p className="truncate font-mono text-[15px] text-[var(--color-neutral-500)]">
              {lookup.customer.phoneE164}
            </p>
            {catalog.length > 0 && lookup.associatedHere ? (
              <div className="mt-2 flex flex-wrap items-center gap-1.5">
                {lookup.customer && lookup.membership?.isVip ? (
                  <span className="rounded-full bg-[var(--color-primary-50)] px-2 py-0.5 text-[10px] font-semibold text-[var(--color-primary-500)]">
                    VIP
                  </span>
                ) : null}
                <TagChipRow tags={lookup.tags} max={4} />
                <button
                  type="button"
                  onClick={openTagSheet}
                  className="rounded-full border border-[var(--color-hairline)] px-2.5 py-0.5 text-[11px] font-semibold text-[var(--color-neutral-600)]"
                >
                  + Etiqueta
                </button>
              </div>
            ) : null}
            {!lookup.associatedHere && (
              <p className="mt-2 rounded-[8px] bg-[var(--color-primary-50)] px-3 py-2 text-[13px] text-[var(--color-primary-800)]">
                {(lookup.otherShopsCount ?? 0) > 0
                  ? `Já está no Frego — ativo em ${lookup.otherShopsCount} outro${lookup.otherShopsCount === 1 ? '' : 's'} estabelecimento${lookup.otherShopsCount === 1 ? '' : 's'}. Adicione a esta loja para carimbar.`
                  : 'Já está no Frego (aplicativo), mas ainda não nesta loja. Adicione para carimbar.'}
              </p>
            )}

            {balanceCount > 0 && (
            <div
              className={`mt-3 grid gap-2 ${
                balanceCount > 2
                  ? 'grid-cols-3'
                  : balanceCount > 1
                    ? 'grid-cols-2'
                    : 'grid-cols-1'
              }`}
            >
              {showStampsPool && (
                <div className="rounded-[14px] bg-[var(--color-stamps-bg)] px-2.5 py-2.5 ring-1 ring-inset ring-[var(--color-stamps-ring)]">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.04em] text-[var(--color-stamps)]">
                    Carimbos
                  </p>
                  <p className="mt-0.5 text-[22px] font-semibold leading-none text-[var(--color-ink)]">
                    {pools.stamps}
                  </p>
                </div>
              )}
              {showPointsPool && (
                <div className="rounded-[14px] bg-[var(--color-points-bg)] px-2.5 py-2.5 ring-1 ring-inset ring-[var(--color-points-ring)]">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.04em] text-[var(--color-points)]">
                    Pontos
                  </p>
                  <p className="mt-0.5 text-[22px] font-semibold leading-none text-[var(--color-ink)]">
                    {pools.points}
                  </p>
                </div>
              )}
              {showCashbackPool && (
                <div className="rounded-[14px] bg-[var(--color-cashback-bg)] px-2.5 py-2.5 ring-1 ring-inset ring-[var(--color-cashback-ring)]">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.04em] text-[var(--color-cashback)]">
                    Cashback
                  </p>
                  <p className="mt-0.5 text-[18px] font-semibold leading-tight text-[var(--color-ink)]">
                    {formatBrl(cashbackBalance)}
                  </p>
                </div>
              )}
            </div>
            )}
            {cashbackBalance > 0 && saleMode ? (
              <div className="mt-2 rounded-[14px] bg-[var(--color-cashback-bg)] px-3 py-3 ring-1 ring-inset ring-[var(--color-cashback-ring)]">
                {cashbackPercent > 0 && earnMode === 'cashback' && (
                  <p className="mb-2 text-[12px] text-[var(--color-cashback)]">
                    {cashbackPercent}% do valor pago
                  </p>
                )}
                <div>
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
                          onFocus={() => setFocus('apply')}
                          onBlur={() =>
                            setFocus((f) => (f === 'apply' ? 'none' : f))
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
              </div>
            ) : null}

            {(earnMode === 'points' || earnMode === 'cashback') && showAmount && (
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
                onFocus={() => setFocus('amount')}
                onBlur={() => setFocus((f) => (f === 'amount' ? 'none' : f))}
              />
            )}

            {openVouchers.length > 0 && (
              <div className="mt-4 rounded-[12px] border border-[var(--color-hairline)] bg-[var(--color-bg)] p-3">
                <p className="text-[12px] font-semibold uppercase tracking-[0.04em] text-[var(--color-neutral-400)]">
                  Vouchers em aberto · {openVouchers.length}
                </p>
                <ul className="mt-2 flex flex-col gap-2">
                  {openVouchers.slice(0, 2).map((v) => (
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
                {openVouchers.length > 2 ? (
                  <button
                    type="button"
                    onClick={() => setOverlay('vouchers')}
                    className="mt-2 min-h-11 text-[14px] font-semibold text-[var(--color-primary-500)]"
                  >
                    Ver todos os {openVouchers.length} vouchers
                  </button>
                ) : null}
              </div>
            )}

            {showAmount && earnMode !== 'points' && earnMode !== 'cashback' && (
              <AmountField
                amount={amount}
                setAmount={setAmount}
                previewPoints={previewPoints}
                pointsPerReal={pointsPerReal}
                previewCashback={previewCashback}
                cashbackPercent={cashbackPercent}
                applyCents={applyCents}
                paidCents={paidCents}
                showPointsRate={false}
                onFocus={() => setFocus('amount')}
                onBlur={() => setFocus((f) => (f === 'amount' ? 'none' : f))}
              />
            )}

            <p className="mt-3 text-[13px] text-[var(--color-neutral-500)]">
              {earnMode === 'cashback'
                ? 'O pagamento acontece no caixa da loja. Aqui só registramos o valor e o cashback usado.'
                : 'O resgate de carimbos e pontos é no aplicativo do cliente. Confirme o voucher ao entregar o prêmio.'}
            </p>

            {(lookup.recentSales?.length ?? 0) > 0 && (
              <div className="mt-5 border-t border-[var(--color-hairline)] pt-4">
                <p className="text-[12px] font-semibold uppercase tracking-[0.04em] text-[var(--color-neutral-400)]">
                  Lançamentos deste cliente
                </p>
                <p className="mt-1 text-[12px] leading-relaxed text-[var(--color-neutral-500)]">
                  Errou? Desfaça se o cliente ainda não usou o benefício.
                </p>
                <ul className="mt-3 flex flex-col gap-2">
                  {lookup.recentSales!.slice(0, 3).map((sale) => {
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
                {(lookup.recentSales?.length ?? 0) > 3 ? (
                  <button
                    type="button"
                    onClick={() => setOverlay('sales')}
                    className="mt-2 min-h-11 text-[14px] font-semibold text-[var(--color-primary-500)]"
                  >
                    Ver {lookup.recentSales!.length} lançamentos
                  </button>
                ) : null}
              </div>
            )}
          </section>
        )}
        </>
        )}

        {toast ? (
          <div
            className="fixed inset-x-0 z-50 mx-auto w-[min(calc(100%-2rem),24rem)] rounded-full bg-[var(--color-ink)] px-4 py-3 text-center text-[14px] text-white shadow-[var(--shadow-raised)] bottom-[calc(13.5rem+env(safe-area-inset-bottom))] md:left-[var(--app-sidebar-w)] md:bottom-[9.5rem]"
            role="status"
          >
            {toast}
          </div>
        ) : null}

        <StickyActionBar
          label={stickyLabel}
          tone={stickyTone}
          disabled={stickyDisabled}
          onClick={runStickyAction}
          undoLabel={lastSale?.summary}
          undoBusy={reversingId != null}
          onUndo={lastSale ? () => setPendingUndo(lastSale) : undefined}
          secondaryLabel={searchSettled ? 'Nova busca' : undefined}
          onSecondary={searchSettled ? startNewSearch : undefined}
        />

        {overlay === 'scan' ? (
          <VoucherScanSheet
            onClose={() => setOverlay(null)}
            onCode={applyScannedCodigo}
          />
        ) : null}

        {overlay === 'matches' && lookup?.matches ? (
          <CounterSheet
            title={lookup.last4 ? `Terminam em ${lookup.last4}` : 'Vários clientes'}
            subtitle="Qual cliente está no caixa?"
            onClose={() => setOverlay(null)}
          >
            <ul className="flex flex-col gap-2">
              {lookup.matches.map((m) => (
                <li key={m.customerId}>
                  <button
                    type="button"
                    onClick={() => {
                      setOverlay(null);
                      void selectMatch(m);
                    }}
                    className="flex min-h-14 w-full items-center justify-between rounded-[12px] border border-[var(--color-hairline)] px-4 text-left"
                  >
                    <span className="font-semibold">
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
          </CounterSheet>
        ) : null}

        {overlay === 'vouchers' && openVouchers.length > 0 ? (
          <CounterSheet
            title="Vouchers em aberto"
            subtitle={`${openVouchers.length} prêmios para confirmar`}
            onClose={() => setOverlay(null)}
          >
            <ul className="flex flex-col gap-2">
              {openVouchers.map((v) => (
                <li
                  key={v.transactionId}
                  className="flex items-center gap-3 rounded-[12px] border border-[var(--color-hairline)] px-3 py-2.5"
                >
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[14px] font-semibold">
                      {v.rewardTitle}
                    </p>
                    <p className="font-mono text-[13px] text-[var(--color-neutral-500)]">
                      {v.voucherDisplay}
                    </p>
                  </div>
                  <button
                    type="button"
                    disabled={fulfillingId != null}
                    onClick={() => {
                      setOverlay(null);
                      void fulfillVoucher({ transactionId: v.transactionId });
                    }}
                    className="min-h-11 shrink-0 rounded-[8px] bg-[var(--color-success)] px-3 text-[13px] font-semibold text-white"
                  >
                    Confirmar
                  </button>
                </li>
              ))}
            </ul>
          </CounterSheet>
        ) : null}

        {overlay === 'sales' && lookup?.recentSales ? (
          <CounterSheet
            title="Lançamentos"
            onClose={() => setOverlay(null)}
          >
            <ul className="flex flex-col gap-2">
              {lookup.recentSales.map((sale) => (
                <li
                  key={sale.saleId}
                  className="flex items-center justify-between gap-3 rounded-[12px] border border-[var(--color-hairline)] px-3 py-2.5"
                >
                  <div className="min-w-0">
                    <p className="text-[14px] font-semibold">{sale.summary}</p>
                    <p className="text-[12px] text-[var(--color-neutral-400)]">
                      {formatSaleClock(sale.createdAt)}
                    </p>
                  </div>
                  <button
                    type="button"
                    disabled={reversingId != null}
                    onClick={() => {
                      setOverlay(null);
                      setPendingUndo(sale);
                    }}
                    className="inline-flex min-h-11 items-center gap-1 px-2 text-[13px] font-semibold"
                  >
                    <Undo2 size={14} />
                    Desfazer
                  </button>
                </li>
              ))}
            </ul>
          </CounterSheet>
        ) : null}

        {overlay === 'tags' && catalog.length > 0 ? (
          <CounterSheet
            title="Etiquetas"
            subtitle="Adicione as que fizerem sentido nesta visita."
            onClose={() => setOverlay(null)}
          >
            <div className="flex flex-col gap-2">
              {catalog.map((tag) => {
                const on = tagDraft.includes(tag.id);
                return (
                  <button
                    key={tag.id}
                    type="button"
                    aria-pressed={on}
                    onClick={() =>
                      setTagDraft((prev) =>
                        on
                          ? prev.filter((id) => id !== tag.id)
                          : [...prev, tag.id],
                      )
                    }
                    className={`flex min-h-14 items-center justify-between rounded-[12px] border px-4 text-left ${
                      on
                        ? 'border-[var(--color-primary-200)] bg-[var(--color-primary-50)]'
                        : 'border-[var(--color-hairline)]'
                    }`}
                  >
                    <span
                      className="rounded-full px-2.5 py-1 text-[13px] font-semibold"
                      style={tagChipStyle(tag.color)}
                    >
                      {tag.name}
                    </span>
                    <span className="text-[12px] font-semibold text-[var(--color-neutral-500)]">
                      {on ? 'Adicionada' : 'Toque para adicionar'}
                    </span>
                  </button>
                );
              })}
            </div>
            <button
              type="button"
              disabled={tagBusy}
              onClick={() => void saveTags()}
              className="mt-4 mb-1 min-h-12 w-full shrink-0 rounded-[12px] bg-[var(--color-primary-500)] text-[15px] font-semibold text-white disabled:opacity-60"
            >
              {tagBusy ? 'Salvando…' : 'Pronto'}
            </button>
          </CounterSheet>
        ) : null}

        {pendingCreate ? (
          <div
            className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 px-4 md:left-[var(--app-sidebar-w)]"
            role="dialog"
            aria-modal="true"
            aria-labelledby="create-title"
            onClick={() => !loading && setPendingCreate(false)}
          >
            <div
              className="w-full max-w-sm rounded-[16px] bg-[var(--color-card)] p-5 shadow-[var(--shadow-raised)]"
              onClick={(e) => e.stopPropagation()}
            >
              <p
                id="create-title"
                className="text-[16px] font-semibold text-[var(--color-ink)]"
              >
                Criar cliente?
              </p>
              <p className="mt-2 text-[14px] leading-relaxed text-[var(--color-neutral-600)]">
                Não encontramos{' '}
                <span className="font-mono font-semibold">
                  {formatPhoneBr(digitsOnly(createPhoneDigits))}
                </span>{' '}
                nesta loja.
              </p>
              <label className="mt-4 block text-[13px] font-semibold uppercase tracking-[0.04em]">
                Nome (opcional)
                <input
                  value={createName}
                  onChange={(e) => setCreateName(e.target.value.slice(0, 80))}
                  maxLength={80}
                  autoComplete="name"
                  autoCapitalize="words"
                  className="mt-2 min-h-11 w-full rounded-[8px] border border-[var(--color-neutral-200)] px-3 text-[17px]"
                  placeholder="Como o cliente se chama"
                />
              </label>
              <p className="mt-2 text-[12px] leading-relaxed text-[var(--color-neutral-500)]">
                Confirma {createBenefitSummary}?
              </p>
              <div className="mt-5 flex justify-end gap-2">
                <button
                  type="button"
                  disabled={loading}
                  onClick={() => setPendingCreate(false)}
                  className="min-h-10 rounded-[10px] px-3 text-[14px] font-semibold text-[var(--color-neutral-600)]"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  disabled={loading}
                  onClick={() => {
                    setPendingCreate(false);
                    void resolveFullPhoneAndEarn(createPhoneDigits);
                  }}
                  className="min-h-10 rounded-[10px] bg-[var(--color-primary-500)] px-4 text-[14px] font-semibold text-white disabled:opacity-60"
                >
                  {loading ? '…' : 'Confirmar'}
                </button>
              </div>
            </div>
          </div>
        ) : null}

        {pendingVoucher ? (
          <div
            className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 px-4 md:left-[var(--app-sidebar-w)]"
            role="dialog"
            aria-modal="true"
            aria-labelledby="voucher-confirm-title"
            onClick={() => fulfillingId == null && setPendingVoucher(null)}
          >
            <div
              className="w-full max-w-sm rounded-[16px] bg-[var(--color-card)] p-5 shadow-[var(--shadow-raised)]"
              onClick={(e) => e.stopPropagation()}
            >
              <p
                id="voucher-confirm-title"
                className="text-[16px] font-semibold text-[var(--color-ink)]"
              >
                Confirmar este voucher?
              </p>
              <p className="mt-2 font-mono text-[20px] font-semibold tracking-[0.08em] text-[var(--color-ink)]">
                {pendingVoucher.voucherDisplay}
              </p>
              <p className="mt-2 text-[14px] leading-relaxed text-[var(--color-neutral-600)]">
                {pendingVoucher.rewardTitle} · {pendingVoucher.customerName}
                {pendingVoucher.phoneTail
                  ? ` · final ${pendingVoucher.phoneTail}`
                  : ''}
              </p>
              <p className="mt-2 text-[12px] leading-relaxed text-[var(--color-neutral-500)]">
                Confira se é o cliente na sua frente. Confirmar entrega o prêmio.
              </p>
              <div className="mt-5 flex justify-end gap-2">
                <button
                  type="button"
                  disabled={fulfillingId != null}
                  onClick={() => setPendingVoucher(null)}
                  className="min-h-10 rounded-[10px] px-3 text-[14px] font-semibold text-[var(--color-neutral-600)]"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  disabled={fulfillingId != null}
                  onClick={() => {
                    const code = pendingVoucher.voucherCode;
                    setPendingVoucher(null);
                    void fulfillVoucher({ voucherCode: code });
                  }}
                  className="min-h-10 rounded-[10px] bg-[var(--color-primary-500)] px-4 text-[14px] font-semibold text-white disabled:opacity-60"
                >
                  {fulfillingId != null ? '…' : 'Confirmar'}
                </button>
              </div>
            </div>
          </div>
        ) : null}

        {pendingUndo ? (
          <div
            className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 px-4 md:left-[var(--app-sidebar-w)]"
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
  onFocus,
  onBlur,
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
  onFocus?: () => void;
  onBlur?: () => void;
}) {
  const chips = [2000, 4000, 6000, 10000];
  return (
    <div className="mt-4">
      <label className="block text-[13px] font-semibold uppercase tracking-[0.04em]">
        Valor da compra (R$)
        <input
          value={amount}
          onChange={(e) => setAmount(maskMoneyInput(e.target.value))}
          onFocus={onFocus}
          onBlur={onBlur}
          inputMode="numeric"
          className="mt-2 min-h-14 w-full rounded-[8px] border border-[var(--color-neutral-200)] px-3 text-center text-[23px] font-semibold"
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
