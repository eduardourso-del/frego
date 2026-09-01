'use client';

import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  Suspense,
  type FormEvent,
} from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import {
  Banknote,
  Gift,
  Link2,
  Plus,
  Search,
  Stamp,
  X,
} from 'lucide-react';
import { AppShell } from '@/components/app-shell';
import {
  Alert,
  Button,
  Card,
  EmptyState,
  Skeleton,
} from '@/components/ui';
import { API_URL } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';
import { useBusiness } from '@/lib/business-context';
import { formatPhoneBr } from '@/lib/phone';

type Progress = {
  campaignId: string;
  campaignName: string;
  type: string;
  current: number;
  needed: number;
  canRedeem: boolean;
  rewardTitle: string | null;
};

type CustomerListItem = {
  customerId: string;
  membershipId: string;
  displayName: string | null;
  phoneE164: string;
  birthday: string | null;
  isVip: boolean;
  associatedAt: string;
  stats: {
    visits: number;
    lastVisitAt: string | null;
    stampsEarned: number;
    pointsEarned: number;
    redeems: number;
    spendCents: number;
    cashbackEarnedCents?: number;
    cashbackSpentCents?: number;
  };
  pools: { stamps: number; points: number; cashbackCents?: number };
  progress: Progress | null;
  redeemableCampaigns: number;
};

type ListResponse = {
  totalCount: number;
  vipCount: number;
  audience?: {
    id?: string;
    name?: string;
    memberCount: number;
  } | null;
  customers: CustomerListItem[];
};

type ProfileResponse = {
  customer: {
    id: string;
    displayName: string | null;
    phoneE164: string;
    birthday: string | null;
    onboardingCompleted: boolean;
    createdAt: string;
  };
  membership: {
    id: string;
    isVip: boolean;
    associatedAt: string;
  };
  stats: {
    visits: number;
    lastVisitAt: string | null;
    stampsEarned: number;
    pointsEarned: number;
    redeems: number;
    spendCents: number;
    cashbackEarnedCents?: number;
    cashbackSpentCents?: number;
    redeemableCampaigns: number;
  };
  wallet: {
    pools: { stamps: number; points: number; cashbackCents?: number };
    campaigns: Array<{
      campaignId: string;
      campaignName: string;
      type: string;
      unitsNeeded: number;
      canRedeem: boolean;
      rewardTitle: string | null;
      rewardsAvailable: number;
    }>;
  };
  pools: { stamps: number; points: number; cashbackCents?: number };
  otherShopsCount: number;
  otherShops: Array<{
    businessId: string;
    name: string;
    logoUrl: string | null;
  }>;
  recentTransactions: Array<{
    id: string;
    type: string;
    quantity: number;
    unitKind: string | null;
    createdAt: string;
    voucherCode?: string | null;
    voucherDisplay?: string | null;
    actorTeamMember: { displayName: string; role: string } | null;
    location: { name: string } | null;
    campaign: { name: string; rewardTitle: string | null } | null;
  }>;
};

function displayPhone(e164: string | null | undefined) {
  if (!e164) return '—';
  const d = e164.replace(/\D/g, '');
  const local = d.startsWith('55') ? d.slice(2) : d;
  return formatPhoneBr(local) || e164;
}

function initials(name: string | null | undefined, phone: string) {
  if (name?.trim()) {
    const parts = name.trim().split(/\s+/).filter(Boolean);
    if (parts.length >= 2) {
      return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
    }
    return name.trim().slice(0, 2).toUpperCase();
  }
  const d = phone.replace(/\D/g, '');
  return (d.slice(-2) || '??').toUpperCase();
}

function formatRelativeVisit(iso: string | null | undefined) {
  if (!iso) return '—';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '—';
  const now = new Date();
  const startToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const startThat = new Date(
    date.getFullYear(),
    date.getMonth(),
    date.getDate(),
  );
  const days = Math.round(
    (startToday.getTime() - startThat.getTime()) / 86_400_000,
  );
  if (days <= 0) return 'Hoje';
  if (days === 1) return 'Ontem';
  if (days < 7) return `Há ${days} dias`;
  if (days < 30) {
    const weeks = Math.floor(days / 7);
    return weeks === 1 ? 'Há 1 semana' : `Há ${weeks} semanas`;
  }
  return date.toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: 'short',
  });
}

function formatBirthday(iso: string | null | undefined) {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleDateString('pt-BR', { day: 'numeric', month: 'short' });
}

function formatMoney(cents: number) {
  return (cents / 100).toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  });
}

function showPool(
  kinds: Array<'stamps' | 'points' | 'cashback'> | undefined,
  kind: 'stamps' | 'points' | 'cashback',
  value: number,
) {
  if (value > 0) return true;
  if (kinds == null) return true;
  return kinds.includes(kind);
}

function poolGridClass(
  kinds: Array<'stamps' | 'points' | 'cashback'> | undefined,
  pools: { stamps: number; points: number; cashbackCents?: number },
) {
  const n = [
    showPool(kinds, 'stamps', pools.stamps),
    showPool(kinds, 'points', pools.points),
    showPool(kinds, 'cashback', pools.cashbackCents ?? 0),
  ].filter(Boolean).length;
  if (n <= 1) return 'grid-cols-1';
  if (n === 2) return 'grid-cols-2';
  return 'grid-cols-3';
}

function formatWhen(iso: string) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const rel = formatRelativeVisit(iso);
  const time = d.toLocaleTimeString('pt-BR', {
    hour: '2-digit',
    minute: '2-digit',
  });
  if (rel === 'Hoje') return `Hoje, ${time}`;
  return `${rel} · ${time}`;
}

function ProgressCell({ progress }: { progress: Progress | null }) {
  if (!progress || progress.needed <= 0) {
    return (
      <span className="text-[13px] text-[var(--color-neutral-400)]">—</span>
    );
  }
  if (progress.canRedeem) {
    return (
      <span className="inline-flex items-center gap-2">
        <span className="h-1.5 w-[90px] overflow-hidden rounded-full bg-[var(--color-neutral-100)]">
          <span className="block h-full w-full rounded-full bg-[var(--color-success)]" />
        </span>
        <span className="text-[12px] font-semibold text-[var(--color-success)]">
          Prêmio!
        </span>
      </span>
    );
  }
  const inCycle = progress.current % progress.needed;
  const pct = Math.min(
    100,
    Math.round((inCycle / progress.needed) * 100),
  );
  return (
    <span className="inline-flex items-center gap-2">
      <span className="h-1.5 w-[90px] overflow-hidden rounded-full bg-[var(--color-neutral-100)]">
        <span
          className="block h-full rounded-full bg-[var(--color-primary-500)] transition-all"
          style={{ width: `${Math.max(pct > 0 ? 6 : 0, pct)}%` }}
        />
      </span>
      <span className="tabular-nums text-[12px] text-[var(--color-neutral-500)]">
        {inCycle}/{progress.needed}
      </span>
    </span>
  );
}

function txLabel(tx: ProfileResponse['recentTransactions'][number]) {
  if (tx.unitKind === 'cashback_cents') {
    const money = formatMoney(tx.quantity);
    return tx.type === 'redeem'
      ? `Cashback no caixa · −${money}`
      : `+${money} cashback`;
  }
  if (tx.type === 'redeem') {
    const reward =
      tx.campaign?.rewardTitle ?? tx.campaign?.name ?? 'recompensa';
    return `Resgatou ${reward}`;
  }
  const kind = tx.unitKind === 'points' ? 'pontos' : 'carimbos';
  const qty = tx.quantity;
  return qty === 1
    ? `+1 ${kind === 'pontos' ? 'ponto' : 'carimbo'}`
    : `+${qty} ${kind}`;
}

export default function CustomersPage() {
  return (
    <Suspense
      fallback={
        <AppShell title="Clientes">
          <div className="px-4 py-5 md:px-7 md:py-6">
            <p className="text-[15px] text-[var(--color-neutral-500)]">
              Carregando…
            </p>
          </div>
        </AppShell>
      }
    >
      <CustomersPageContent />
    </Suspense>
  );
}

function CustomersPageContent() {
  const { loading: authLoading } = useAuth();
  const {
    authHeaders,
    businessId,
    business,
    loading: businessLoading,
  } = useBusiness();
  const searchParams = useSearchParams();

  const audienceFilter = useMemo(() => {
    const audienceId = searchParams.get('audienceId');
    if (audienceId) return { audienceId };
    const keys = [
      'spendCentsMin',
      'spendCentsMax',
      'windowDays',
      'inactiveDaysMin',
      'visitsMin',
      'visitsMax',
      'nearReward',
      'isVip',
    ] as const;
    const rules: Record<string, string> = {};
    let any = false;
    for (const k of keys) {
      const v = searchParams.get(k);
      if (v != null && v !== '') {
        rules[k] = v;
        any = true;
      }
    }
    return any ? rules : null;
  }, [searchParams]);

  const [q, setQ] = useState('');
  const [debouncedQ, setDebouncedQ] = useState('');
  const [list, setList] = useState<ListResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [profile, setProfile] = useState<ProfileResponse | null>(null);
  const [profileLoading, setProfileLoading] = useState(false);
  const [profileError, setProfileError] = useState<string | null>(null);

  useEffect(() => {
    const t = setTimeout(() => setDebouncedQ(q.trim()), 280);
    return () => clearTimeout(t);
  }, [q]);

  const loadList = useCallback(async () => {
    if (!businessId) return;
    setLoading(true);
    setError(null);
    try {
      const headers = await authHeaders();
      const params = new URLSearchParams();
      if (debouncedQ) params.set('q', debouncedQ);
      params.set('limit', '100');
      if (audienceFilter) {
        for (const [k, v] of Object.entries(audienceFilter)) {
          params.set(k, v);
        }
      }
      const res = await fetch(`${API_URL}/customers?${params}`, { headers });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? 'Não foi possível carregar os clientes.');
      setList(json as ListResponse);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Não foi possível carregar.');
      setList(null);
    } finally {
      setLoading(false);
    }
  }, [authHeaders, businessId, debouncedQ, audienceFilter]);

  useEffect(() => {
    if (authLoading || businessLoading) return;
    if (
      !businessId ||
      business?.status === 'pending' ||
      business?.status === 'suspended'
    ) {
      setLoading(false);
      setList(null);
      return;
    }
    void loadList();
  }, [
    authLoading,
    businessLoading,
    businessId,
    business?.status,
    loadList,
  ]);

  const loadProfile = useCallback(
    async (customerId: string) => {
      setProfileLoading(true);
      setProfileError(null);
      try {
        const headers = await authHeaders();
        const res = await fetch(`${API_URL}/customers/${customerId}`, {
          headers,
        });
        const json = await res.json();
        if (!res.ok) throw new Error(json.error ?? 'Não foi possível carregar o perfil.');
        setProfile(json as ProfileResponse);
      } catch (err) {
        setProfile(null);
        setProfileError(
          err instanceof Error ? err.message : 'Não foi possível carregar o perfil.',
        );
      } finally {
        setProfileLoading(false);
      }
    },
    [authHeaders],
  );

  useEffect(() => {
    if (!selectedId) {
      setProfile(null);
      setProfileError(null);
      return;
    }
    void loadProfile(selectedId);
  }, [selectedId, loadProfile]);

  const customers = list?.customers ?? [];
  const avgVisits = useMemo(() => {
    if (customers.length === 0) return 0;
    const sum = customers.reduce((acc, c) => acc + c.stats.visits, 0);
    return Math.round((sum / customers.length) * 10) / 10;
  }, [customers]);

  function openCustomer(id: string) {
    setSelectedId(id);
  }

  function closeProfile() {
    setSelectedId(null);
  }

  function onSearchSubmit(e: FormEvent) {
    e.preventDefault();
    setDebouncedQ(q.trim());
  }

  const topbar = (
    <header className="flex h-[60px] shrink-0 items-center gap-4 border-b border-[var(--color-hairline)] bg-[var(--color-card)] px-5 md:px-7">
      <h1 className="text-[17px] font-semibold text-[var(--color-ink)]">
        Clientes
      </h1>
      {list ? (
        <span className="text-[13px] text-[var(--color-neutral-500)]">
          {list.totalCount.toLocaleString('pt-BR')} no total
        </span>
      ) : null}
      <Link
        href="/counter"
        className="ml-auto inline-flex min-h-10 items-center justify-center gap-2 rounded-[12px] bg-[var(--color-primary-500)] px-3.5 text-[13px] font-semibold text-white shadow-[var(--shadow-cta)] hover:bg-[var(--color-primary-600)]"
      >
        <Plus className="h-4 w-4" strokeWidth={2.25} />
        Adicionar
      </Link>
    </header>
  );

  return (
    <AppShell businessName={business?.name} title="Clientes" topbar={topbar}>
      <div className="px-4 py-5 md:px-7 md:py-6">
        <div className="mb-5 flex items-center justify-between gap-3 md:hidden">
          <div>
            <h1 className="text-[26px] font-semibold tracking-[-0.03em] text-[var(--color-ink)]">
              Clientes
            </h1>
            {list ? (
              <p className="mt-0.5 text-[13px] text-[var(--color-neutral-500)]">
                {list.totalCount.toLocaleString('pt-BR')} no total
              </p>
            ) : null}
          </div>
          <Link
            href="/counter"
            className="inline-flex min-h-10 items-center gap-1.5 rounded-[12px] bg-[var(--color-primary-500)] px-3.5 text-[13px] font-semibold text-white shadow-[var(--shadow-cta)]"
          >
            <Plus className="h-4 w-4" strokeWidth={2.25} />
            Adicionar
          </Link>
        </div>

        {list && !loading ? (
          <div className="mb-5 grid grid-cols-2 gap-3 sm:grid-cols-3">
            <Card padding="sm" className="!p-4">
              <p className="text-[12px] font-medium text-[var(--color-neutral-500)]">
                Cadastrados
              </p>
              <p className="mt-1 text-[24px] font-semibold tracking-[-0.02em] tabular-nums text-[var(--color-ink)]">
                {list.totalCount.toLocaleString('pt-BR')}
              </p>
            </Card>
            <Card padding="sm" className="!p-4">
              <p className="text-[12px] font-medium text-[var(--color-neutral-500)]">
                VIP
              </p>
              <p className="mt-1 text-[24px] font-semibold tracking-[-0.02em] tabular-nums text-[var(--color-ink)]">
                {list.vipCount.toLocaleString('pt-BR')}
              </p>
            </Card>
            <Card padding="sm" className="col-span-2 !p-4 sm:col-span-1">
              <p className="text-[12px] font-medium text-[var(--color-neutral-500)]">
                Média de visitas
              </p>
              <p className="mt-1 text-[24px] font-semibold tracking-[-0.02em] tabular-nums text-[var(--color-ink)]">
                {avgVisits.toLocaleString('pt-BR')}
              </p>
            </Card>
          </div>
        ) : null}

        {audienceFilter ? (
          <div className="mb-4 flex flex-wrap items-center gap-2 rounded-[12px] border border-[var(--color-primary-200)] bg-[var(--color-primary-50)] px-3.5 py-2.5 text-[13px]">
            <span className="font-semibold text-[var(--color-ink)]">
              Filtro de audiência
              {list?.audience?.name ? `: ${list.audience.name}` : ''}
            </span>
            {list?.audience?.memberCount != null && (
              <span className="text-[var(--color-neutral-600)]">
                {list.audience.memberCount} clientes
              </span>
            )}
            <Link
              href={`/campaigns?${
                audienceFilter.audienceId
                  ? `audienceId=${audienceFilter.audienceId}`
                  : `fromAudience=1&${new URLSearchParams(audienceFilter).toString()}`
              }`}
              className="font-semibold text-[var(--color-primary-600)]"
            >
              Criar campanha para esta audiência →
            </Link>
            <Link
              href="/customers"
              className="ml-auto text-[var(--color-neutral-500)]"
            >
              Limpar
            </Link>
          </div>
        ) : null}

        <form onSubmit={onSearchSubmit} className="mb-5">
          <label className="relative block">
            <Search
              className="pointer-events-none absolute left-4 top-1/2 h-[18px] w-[18px] -translate-y-1/2 text-[var(--color-primary-500)]"
              strokeWidth={2}
            />
            <input
              type="search"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Buscar por nome ou telefone"
              className="min-h-12 w-full rounded-[13px] border border-[var(--color-neutral-200)] bg-[var(--color-card)] py-3 pl-11 pr-4 text-[16px] text-[var(--color-ink)] outline-none transition-[border,box-shadow] placeholder:text-[var(--color-neutral-400)] focus:border-[var(--color-primary-500)] focus:shadow-[var(--shadow-focus)]"
              autoComplete="off"
            />
          </label>
        </form>

        {error ? (
          <Alert tone="danger" action={
            <Button variant="ghost" className="min-h-9 text-[13px]" onClick={() => void loadList()}>
              Tentar de novo
            </Button>
          }>
            {error}
          </Alert>
        ) : null}

        {loading ? (
          <div className="space-y-3">
            <Skeleton className="h-14 w-full" />
            <Skeleton className="h-14 w-full" />
            <Skeleton className="h-14 w-full" />
          </div>
        ) : null}

        {!loading && !error && customers.length === 0 ? (
          <EmptyState
            title={debouncedQ ? 'Nenhum cliente encontrado' : 'Ainda sem clientes'}
            description={
              debouncedQ
                ? 'Tente outro nome ou telefone, ou cadastre no balcão.'
                : 'Cadastre o primeiro cliente no balcão. O telefone é o que identifica a pessoa no Frego.'
            }
            action={
              <Link
                href="/counter"
                className="inline-flex min-h-11 items-center justify-center gap-2 rounded-[12px] bg-[var(--color-primary-500)] px-4 text-[14px] font-semibold text-white shadow-[var(--shadow-cta)]"
              >
                Ir para o balcão
              </Link>
            }
          />
        ) : null}

        {!loading && customers.length > 0 ? (
          <>
            {/* Mobile cards */}
            <div className="space-y-2 md:hidden">
              {customers.map((c) => (
                <button
                  key={c.customerId}
                  type="button"
                  onClick={() => openCustomer(c.customerId)}
                  className="flex w-full items-center gap-3 rounded-[14px] border border-[var(--color-hairline)] bg-[var(--color-card)] p-3.5 text-left shadow-[var(--shadow-card)] transition-colors hover:border-[var(--color-primary-200)]"
                >
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[var(--color-primary-50)] text-[13px] font-bold text-[var(--color-primary-500)]">
                    {initials(c.displayName, c.phoneE164)}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center gap-2">
                      <span className="truncate text-[15px] font-semibold text-[var(--color-ink)]">
                        {c.displayName?.trim() || 'Sem nome'}
                      </span>
                      {c.isVip ? (
                        <span className="shrink-0 rounded-full bg-[var(--color-primary-50)] px-2 py-0.5 text-[10px] font-semibold text-[var(--color-primary-500)]">
                          VIP
                        </span>
                      ) : null}
                    </span>
                    <span className="mt-0.5 block text-[13px] text-[var(--color-neutral-500)]">
                      {displayPhone(c.phoneE164)} · {c.stats.visits} visitas
                    </span>
                  </span>
                  <span className="shrink-0 text-[12px] text-[var(--color-neutral-400)]">
                    {formatRelativeVisit(c.stats.lastVisitAt)}
                  </span>
                </button>
              ))}
            </div>

            {/* Desktop table */}
            <Card padding="none" className="hidden overflow-hidden md:block">
              <div className="grid grid-cols-[2fr_1.4fr_1.6fr_0.8fr_1fr] border-b border-[var(--color-hairline)] px-5 py-3 text-[11px] font-semibold uppercase tracking-[0.04em] text-[var(--color-neutral-400)]">
                <span>Cliente</span>
                <span>Telefone</span>
                <span>Progresso</span>
                <span>Visitas</span>
                <span>Última visita</span>
              </div>
              <ul>
                {customers.map((c) => (
                  <li key={c.customerId}>
                    <button
                      type="button"
                      onClick={() => openCustomer(c.customerId)}
                      className="grid w-full grid-cols-[2fr_1.4fr_1.6fr_0.8fr_1fr] items-center border-b border-[var(--color-neutral-100)] px-5 py-3.5 text-left text-[14px] transition-colors last:border-b-0 hover:bg-[var(--color-bg)]"
                    >
                      <span className="flex min-w-0 items-center gap-3">
                        <span className="flex h-[34px] w-[34px] shrink-0 items-center justify-center rounded-full bg-[var(--color-primary-50)] text-[13px] font-bold text-[var(--color-primary-500)]">
                          {initials(c.displayName, c.phoneE164)}
                        </span>
                        <span className="truncate font-semibold text-[var(--color-ink)]">
                          {c.displayName?.trim() || 'Sem nome'}
                          {c.isVip ? (
                            <span className="ml-2 inline-flex rounded-full bg-[var(--color-primary-50)] px-2 py-0.5 text-[10px] font-semibold text-[var(--color-primary-500)]">
                              VIP
                            </span>
                          ) : null}
                        </span>
                      </span>
                      <span className="text-[var(--color-neutral-500)]">
                        {displayPhone(c.phoneE164)}
                      </span>
                      <span>
                        <ProgressCell progress={c.progress} />
                      </span>
                      <span className="tabular-nums text-[var(--color-neutral-500)]">
                        {c.stats.visits}
                      </span>
                      <span className="text-[var(--color-neutral-500)]">
                        {formatRelativeVisit(c.stats.lastVisitAt)}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            </Card>
          </>
        ) : null}
      </div>

      {/* Profile drawer */}
      {selectedId ? (
        <div className="fixed inset-0 z-50 flex justify-end">
          <button
            type="button"
            aria-label="Fechar"
            className="absolute inset-0 bg-[var(--color-ink)]/35 backdrop-blur-[2px]"
            onClick={closeProfile}
          />
          <aside className="relative flex h-full w-full max-w-[440px] flex-col bg-[var(--color-card)] shadow-[0_16px_40px_rgba(16,24,40,0.18)]">
            <div className="flex items-center justify-between border-b border-[var(--color-hairline)] px-5 py-4">
              <h2 className="text-[16px] font-semibold text-[var(--color-ink)]">
                Perfil
              </h2>
              <button
                type="button"
                onClick={closeProfile}
                className="flex h-9 w-9 items-center justify-center rounded-[10px] text-[var(--color-neutral-500)] hover:bg-[var(--color-bg)]"
                aria-label="Fechar perfil"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto">
              {profileLoading ? (
                <div className="space-y-4 p-5">
                  <Skeleton className="h-16 w-full" />
                  <Skeleton className="h-20 w-full" />
                  <Skeleton className="h-40 w-full" />
                </div>
              ) : null}

              {profileError ? (
                <div className="p-5">
                  <Alert tone="danger">{profileError}</Alert>
                </div>
              ) : null}

              {profile && !profileLoading ? (
                <>
                  <div className="border-b border-[var(--color-hairline)] px-5 py-6">
                    <div className="flex items-center gap-3.5">
                      <div className="flex h-[52px] w-[52px] shrink-0 items-center justify-center rounded-full bg-[var(--color-ink)] text-[18px] font-bold text-white">
                        {initials(
                          profile.customer.displayName,
                          profile.customer.phoneE164,
                        )}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-[18px] font-semibold text-[var(--color-ink)]">
                          {profile.customer.displayName?.trim() || 'Sem nome'}
                        </p>
                        <p className="text-[13px] text-[var(--color-neutral-500)]">
                          {displayPhone(profile.customer.phoneE164)}
                        </p>
                      </div>
                      {profile.membership.isVip ? (
                        <span className="rounded-full bg-[var(--color-primary-50)] px-2.5 py-1 text-[11px] font-semibold text-[var(--color-primary-500)]">
                          VIP
                        </span>
                      ) : null}
                    </div>

                    <div className="mt-4 grid grid-cols-3 gap-2">
                      <div className="rounded-[11px] bg-[var(--color-bg)] px-2 py-2.5 text-center">
                        <p className="text-[17px] font-semibold tabular-nums text-[var(--color-ink)]">
                          {profile.stats.visits}
                        </p>
                        <p className="text-[11px] text-[var(--color-neutral-400)]">
                          Visitas aqui
                        </p>
                      </div>
                      <div className="rounded-[11px] bg-[var(--color-bg)] px-2 py-2.5 text-center">
                        <p className="text-[17px] font-semibold text-[var(--color-ink)]">
                          {formatBirthday(profile.customer.birthday)}
                        </p>
                        <p className="text-[11px] text-[var(--color-neutral-400)]">
                          Aniversário
                        </p>
                      </div>
                      <div className="rounded-[11px] bg-[var(--color-bg)] px-2 py-2.5 text-center">
                        <p className="text-[17px] font-semibold tabular-nums text-[var(--color-ink)]">
                          {profile.stats.redeemableCampaigns}
                        </p>
                        <p className="text-[11px] text-[var(--color-neutral-400)]">
                          {profile.stats.redeemableCampaigns === 1
                            ? 'Prêmio pronto'
                            : 'Prêmios prontos'}
                        </p>
                      </div>
                    </div>

                    <div
                      className={`mt-3 grid gap-2 ${poolGridClass(business?.activeEarnKinds, profile.pools)}`}
                    >
                      {showPool(business?.activeEarnKinds, 'stamps', profile.pools.stamps) && (
                        <div className="flex items-center gap-2 rounded-[11px] bg-[var(--color-stamps-bg)] px-3 py-2.5">
                          <Stamp className="h-4 w-4 shrink-0 text-[var(--color-stamps)]" />
                          <div className="min-w-0">
                            <p className="text-[15px] font-semibold tabular-nums text-[var(--color-ink)]">
                              {profile.pools.stamps}
                            </p>
                            <p className="text-[11px] text-[var(--color-neutral-500)]">
                              Carimbos
                            </p>
                          </div>
                        </div>
                      )}
                      {showPool(business?.activeEarnKinds, 'points', profile.pools.points) && (
                        <div className="flex items-center gap-2 rounded-[11px] bg-[var(--color-points-bg)] px-3 py-2.5">
                          <Gift className="h-4 w-4 shrink-0 text-[var(--color-points)]" />
                          <div className="min-w-0">
                            <p className="text-[15px] font-semibold tabular-nums text-[var(--color-ink)]">
                              {profile.pools.points}
                            </p>
                            <p className="text-[11px] text-[var(--color-neutral-500)]">
                              Pontos
                            </p>
                          </div>
                        </div>
                      )}
                      {showPool(
                        business?.activeEarnKinds,
                        'cashback',
                        profile.pools.cashbackCents ?? 0,
                      ) && (
                        <div className="flex items-center gap-2 rounded-[11px] bg-[var(--color-cashback-bg)] px-3 py-2.5">
                          <Banknote className="h-4 w-4 shrink-0 text-[var(--color-cashback)]" />
                          <div className="min-w-0">
                            <p className="truncate text-[15px] font-semibold tabular-nums text-[var(--color-ink)]">
                              {formatMoney(profile.pools.cashbackCents ?? 0)}
                            </p>
                            <p className="text-[11px] text-[var(--color-neutral-500)]">
                              Cashback
                            </p>
                          </div>
                        </div>
                      )}
                    </div>

                    {(profile.stats.stampsEarned > 0 ||
                      profile.stats.pointsEarned > 0 ||
                      profile.stats.redeems > 0 ||
                      (profile.stats.cashbackEarnedCents ?? 0) > 0 ||
                      (profile.stats.cashbackSpentCents ?? 0) > 0) && (
                      <p className="mt-3 text-[12px] leading-relaxed text-[var(--color-neutral-500)]">
                        Histórico: {profile.stats.stampsEarned} carimbos ·{' '}
                        {profile.stats.pointsEarned} pontos
                        {(profile.stats.cashbackEarnedCents ?? 0) > 0
                          ? ` · ${formatMoney(profile.stats.cashbackEarnedCents ?? 0)} cashback`
                          : ''}
                        {(profile.stats.cashbackSpentCents ?? 0) > 0
                          ? ` · ${formatMoney(profile.stats.cashbackSpentCents ?? 0)} usados no caixa`
                          : ''}
                        {profile.stats.redeems > 0
                          ? ` · ${profile.stats.redeems} resgates`
                          : ''}
                        {profile.stats.spendCents > 0
                          ? ` · ${formatMoney(profile.stats.spendCents)}`
                          : ''}
                        {profile.stats.lastVisitAt
                          ? ` · última visita: ${formatRelativeVisit(profile.stats.lastVisitAt).toLowerCase()}`
                          : ''}
                      </p>
                    )}
                  </div>

                  <div className="border-b border-[var(--color-hairline)] bg-[var(--color-primary-50)]/60 px-5 py-4">
                    <div className="mb-3 flex items-center gap-2">
                      <Link2 className="h-3.5 w-3.5 text-[var(--color-primary-500)]" />
                      <span className="text-[11px] font-semibold uppercase tracking-[0.03em] text-[var(--color-primary-500)]">
                        Identidade Frego
                      </span>
                    </div>
                    <div className="space-y-2">
                      <div className="flex items-center gap-3 rounded-[11px] border border-[var(--color-hairline)] bg-[var(--color-card)] px-3 py-2.5">
                        <span className="flex h-[30px] w-[30px] items-center justify-center rounded-[9px] bg-[var(--color-primary-50)] text-[13px] font-bold text-[var(--color-primary-500)]">
                          {(business?.name ?? 'V').charAt(0).toUpperCase()}
                        </span>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-[13px] font-semibold text-[var(--color-ink)]">
                            {business?.name ?? 'Esta loja'}
                          </p>
                          <p className="text-[11px] text-[var(--color-neutral-400)]">
                            Esta loja · {profile.pools.stamps} carimbos ·{' '}
                            {profile.pools.points} pontos
                            {(profile.pools.cashbackCents ?? 0) > 0
                              ? ` · ${formatMoney(profile.pools.cashbackCents ?? 0)} cashback`
                              : ''}
                          </p>
                        </div>
                        <span className="rounded-full bg-[var(--color-success-bg)] px-2 py-0.5 text-[10px] font-semibold text-[var(--color-success)]">
                          Membro
                        </span>
                      </div>
                      {profile.otherShopsCount > 0 ? (
                        <div className="flex items-center gap-3 rounded-[11px] border border-[var(--color-hairline)] bg-[var(--color-card)] px-3 py-2.5 opacity-75">
                          <span className="flex h-[30px] w-[30px] items-center justify-center rounded-[9px] bg-[var(--color-neutral-100)] text-[13px]">
                            🔒
                          </span>
                          <div className="min-w-0 flex-1">
                            <p className="text-[13px] font-semibold text-[var(--color-ink)]">
                              {profile.otherShopsCount === 1
                                ? '1 outra loja'
                                : `${profile.otherShopsCount} outras lojas`}
                            </p>
                            <p className="text-[11px] text-[var(--color-neutral-400)]">
                              Saldo e visitas das outras lojas ficam ocultos.
                            </p>
                          </div>
                        </div>
                      ) : null}
                    </div>
                    <p className="mt-3 text-[11px] leading-relaxed text-[var(--color-neutral-500)]">
                      Nome e aniversário são compartilhados. Cada loja só vê
                      os próprios carimbos e visitas.
                    </p>
                  </div>

                  {profile.wallet.campaigns.length > 0 ? (
                    <div className="border-b border-[var(--color-hairline)] px-5 py-4">
                      <p className="mb-3 text-[11px] font-semibold uppercase tracking-[0.03em] text-[var(--color-neutral-400)]">
                        Campanhas
                      </p>
                      <ul className="space-y-2.5">
                        {profile.wallet.campaigns.map((camp) => {
                          if (camp.type === 'cashback') {
                            const bal = profile.pools.cashbackCents ?? 0;
                            return (
                              <li
                                key={camp.campaignId}
                                className="rounded-[12px] border border-[var(--color-cashback-ring)] bg-[var(--color-cashback-bg)] px-3 py-2.5"
                              >
                                <div className="flex items-baseline justify-between gap-2">
                                  <p className="truncate text-[13px] font-semibold text-[var(--color-ink)]">
                                    {camp.campaignName}
                                  </p>
                                  <span className="shrink-0 tabular-nums text-[12px] font-semibold text-[var(--color-cashback)]">
                                    {formatMoney(bal)}
                                  </span>
                                </div>
                                <p className="mt-0.5 text-[11px] text-[var(--color-cashback)]">
                                  Use no caixa — o atendente aplica na compra
                                </p>
                              </li>
                            );
                          }
                          const current =
                            camp.type === 'spend'
                              ? profile.pools.points
                              : profile.pools.stamps;
                          const inCycle = camp.canRedeem
                            ? camp.unitsNeeded
                            : current % camp.unitsNeeded;
                          const pct = Math.min(
                            100,
                            Math.round((inCycle / camp.unitsNeeded) * 100),
                          );
                          return (
                            <li
                              key={camp.campaignId}
                              className="rounded-[12px] border border-[var(--color-hairline)] px-3 py-2.5"
                            >
                              <div className="flex items-baseline justify-between gap-2">
                                <p className="truncate text-[13px] font-semibold text-[var(--color-ink)]">
                                  {camp.campaignName}
                                </p>
                                <span className="shrink-0 tabular-nums text-[12px] text-[var(--color-neutral-500)]">
                                  {camp.canRedeem
                                    ? 'Pronto'
                                    : `${inCycle}/${camp.unitsNeeded}`}
                                </span>
                              </div>
                              {camp.rewardTitle ? (
                                <p className="mt-0.5 text-[11px] text-[var(--color-neutral-400)]">
                                  {camp.rewardTitle}
                                </p>
                              ) : null}
                              <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-[var(--color-neutral-100)]">
                                <div
                                  className={`h-full rounded-full ${
                                    camp.canRedeem
                                      ? 'bg-[var(--color-success)]'
                                      : 'bg-[var(--color-primary-500)]'
                                  }`}
                                  style={{
                                    width: `${camp.canRedeem ? 100 : Math.max(pct > 0 ? 6 : 0, pct)}%`,
                                  }}
                                />
                              </div>
                            </li>
                          );
                        })}
                      </ul>
                    </div>
                  ) : null}

                  <div className="px-5 py-4">
                    <p className="mb-3 text-[11px] font-semibold uppercase tracking-[0.03em] text-[var(--color-neutral-400)]">
                      Atividade recente
                    </p>
                    {profile.recentTransactions.length === 0 ? (
                      <p className="text-[13px] text-[var(--color-neutral-500)]">
                        Nenhuma movimentação ainda.
                      </p>
                    ) : (
                      <ul className="space-y-3.5">
                        {profile.recentTransactions.map((tx) => {
                          const isCashback = tx.unitKind === 'cashback_cents';
                          const isRedeem = tx.type === 'redeem';
                          return (
                            <li
                              key={tx.id}
                              className="flex items-center gap-3"
                            >
                              <span
                                className={`flex h-[30px] w-[30px] shrink-0 items-center justify-center rounded-full text-[13px] ${
                                  isCashback
                                    ? 'bg-[var(--color-cashback-bg)] text-[var(--color-cashback)]'
                                    : isRedeem
                                      ? 'bg-[var(--color-success-bg)] text-[var(--color-success)]'
                                      : 'bg-[var(--color-primary-50)] text-[var(--color-primary-500)]'
                                }`}
                              >
                                {isCashback
                                  ? isRedeem
                                    ? '−'
                                    : '+'
                                  : isRedeem
                                    ? '🎁'
                                    : '+'}
                              </span>
                              <div className="min-w-0 flex-1">
                                <p className="truncate text-[13px] font-medium text-[var(--color-ink)]">
                                  {txLabel(tx)}
                                </p>
                                <p className="text-[11px] text-[var(--color-neutral-400)]">
                                  {formatWhen(tx.createdAt)}
                                  {tx.actorTeamMember?.displayName
                                    ? ` · por ${tx.actorTeamMember.displayName}`
                                    : ''}
                                  {tx.location?.name
                                    ? ` · ${tx.location.name}`
                                    : ''}
                                </p>
                                {isRedeem && tx.voucherDisplay ? (
                                  <p className="mt-1.5 inline-flex items-center rounded-[8px] bg-[var(--color-bg)] px-2 py-1 font-mono text-[12px] font-semibold tracking-[0.08em] text-[var(--color-ink)] ring-1 ring-[var(--color-hairline)]">
                                    {tx.voucherDisplay}
                                  </p>
                                ) : null}
                              </div>
                            </li>
                          );
                        })}
                      </ul>
                    )}
                  </div>

                  <div className="border-t border-[var(--color-hairline)] px-5 py-4">
                    <Link
                      href="/counter"
                      className="inline-flex w-full min-h-11 items-center justify-center gap-2 rounded-[12px] bg-[var(--color-primary-500)] px-4 text-[14px] font-semibold text-white shadow-[var(--shadow-cta)] hover:bg-[var(--color-primary-600)]"
                    >
                      Registrar no balcão
                    </Link>
                  </div>
                </>
              ) : null}
            </div>
          </aside>
        </div>
      ) : null}
    </AppShell>
  );
}
