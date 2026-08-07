'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { AppShell } from '@/components/app-shell';
import { useAuth } from '@/lib/auth-context';
import { useBusiness } from '@/lib/business-context';
import { API_URL } from '@/lib/api';

type RangeKey = 'today' | '7d' | '30d';

type Kpi = { value: number; deltaPct: number | null };

type TopCustomer = {
  membershipId: string;
  displayName: string;
  phoneE164: string | null;
  phoneLast4: string | null;
  initials: string;
  visits: number;
  stamps: number;
  points: number;
  spendCents: number;
  redeems: number;
  lastVisitAt: string;
  score: number;
  tier: 'vip' | 'regular' | 'new';
  isVip: boolean;
};

type DashboardData = {
  range: RangeKey;
  business: { id: string; name: string };
  kpis: {
    customers: Kpi;
    stamps: Kpi;
    points?: Kpi;
    redeems: Kpi;
    repeatRate: Kpi;
    avgVisits?: Kpi;
    revenueCents?: Kpi;
    newCustomers?: Kpi;
  };
  funnel?: {
    base: number;
    active: number;
    returning: number;
    redeemed: number;
    inactive: number;
  };
  insight?: { title: string; body: string };
  topCustomers?: TopCustomer[];
  weekSeries: Array<{
    date: string;
    day: string;
    stamps: number;
    redeems: number;
  }>;
  live: Array<{
    id: string;
    type: 'stamp' | 'redeem';
    text: string;
    initials: string;
    locationName: string;
    createdAt: string;
  }>;
  activeCampaign: {
    id: string;
    name: string;
    rewardTitle: string | null;
    stampsNeeded: number | null;
  } | null;
  activeCampaigns?: Array<{
    id: string;
    name: string;
    type: string;
    rewardTitle: string | null;
    stampsNeeded: number | null;
  }>;
};

const RANGES: { key: RangeKey; label: string }[] = [
  { key: 'today', label: 'Hoje' },
  { key: '7d', label: '7d' },
  { key: '30d', label: '30d' },
];

const TIER_LABEL: Record<TopCustomer['tier'], string> = {
  vip: 'Valioso',
  regular: 'Recorrente',
  new: 'Novo',
};

function greeting(now = new Date()) {
  const h = now.getHours();
  if (h < 12) return 'Bom dia';
  if (h < 18) return 'Boa tarde';
  return 'Boa noite';
}

function formatRelative(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'agora';
  if (mins < 60) return `${mins} min atrás`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours} h atrás`;
  const days = Math.floor(hours / 24);
  return `${days} d atrás`;
}

function formatMoney(cents: number) {
  return (cents / 100).toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  });
}

function Delta({ value }: { value: number | null }) {
  if (value === null) {
    return (
      <span className="text-[12px] font-semibold text-[var(--color-neutral-400)]">
        — novo
      </span>
    );
  }
  if (value === 0) {
    return (
      <span className="text-[12px] font-semibold text-[var(--color-neutral-400)]">
        — estável
      </span>
    );
  }
  const up = value > 0;
  return (
    <span
      className={`text-[12px] font-semibold ${
        up ? 'text-[var(--color-success)]' : 'text-[var(--color-danger)]'
      }`}
    >
      {up ? '▲' : '▼'} {Math.abs(value)}%
    </span>
  );
}

function KpiCard({
  label,
  value,
  deltaPct,
  suffix = '',
  hint,
}: {
  label: string;
  value: number | string;
  deltaPct: number | null;
  suffix?: string;
  hint?: string;
}) {
  return (
    <div className="rounded-[16px] border border-[var(--color-hairline)] bg-[var(--color-card)] p-4 shadow-[var(--shadow-card)] md:rounded-[14px] md:p-[18px]">
      <div className="text-[12px] font-medium leading-snug text-[var(--color-neutral-500)] md:text-[13px]">
        {label}
      </div>
      <div className="mt-1 text-[24px] font-semibold tracking-[-0.02em] text-[var(--color-ink)] md:mt-1.5 md:text-[30px]">
        {value}
        {suffix}
      </div>
      <div className="mt-1 flex flex-col gap-1 sm:flex-row sm:flex-wrap sm:items-center sm:gap-2">
        <Delta value={deltaPct} />
        {hint && (
          <span className="text-[11px] text-[var(--color-neutral-400)]">
            {hint}
          </span>
        )}
      </div>
    </div>
  );
}

function WeekChart({ series }: { series: DashboardData['weekSeries'] }) {
  const max = useMemo(() => {
    const m = Math.max(1, ...series.map((d) => d.stamps + d.redeems));
    return m;
  }, [series]);

  return (
    <div className="rounded-[14px] border border-[var(--color-hairline)] bg-[var(--color-card)] p-5 shadow-[var(--shadow-card)]">
      <div className="mb-4 flex items-center justify-between">
        <div className="text-[15px] font-semibold text-[var(--color-ink)]">
          Visitas nesta semana
        </div>
        <div className="flex gap-3.5 text-[12px] text-[var(--color-neutral-500)]">
          <span className="flex items-center gap-1.5">
            <span
              className="inline-block h-2.5 w-2.5 rounded-[2px]"
              style={{ background: 'var(--color-primary-500)' }}
            />
            Visitas
          </span>
          <span className="flex items-center gap-1.5">
            <span
              className="inline-block h-2.5 w-2.5 rounded-[2px]"
              style={{ background: 'var(--color-primary-200)' }}
            />
            Resgates
          </span>
        </div>
      </div>
      <div className="flex h-[170px] items-end gap-3.5">
        {series.map((d) => {
          const total = d.stamps + d.redeems;
          const stampH = Math.round((d.stamps / max) * 140);
          const redeemH = Math.round((d.redeems / max) * 140);
          return (
            <div
              key={d.date}
              className="flex h-full flex-1 flex-col items-center justify-end gap-1.5"
              title={`${d.date}: ${d.stamps} visitas, ${d.redeems} resgates`}
            >
              <div className="flex w-full max-w-[32px] flex-col gap-0.5">
                {redeemH > 0 && (
                  <div
                    className="rounded-t-[4px]"
                    style={{
                      height: Math.max(redeemH, 4),
                      background: 'var(--color-primary-200)',
                    }}
                  />
                )}
                <div
                  className={redeemH > 0 ? 'rounded-b-[4px]' : 'rounded-[4px]'}
                  style={{
                    height: Math.max(stampH, total === 0 ? 4 : 6),
                    background:
                      total === 0
                        ? 'var(--color-neutral-100)'
                        : 'var(--color-primary-500)',
                    opacity: total === 0 ? 1 : undefined,
                  }}
                />
              </div>
              <span className="text-[11px] text-[var(--color-neutral-400)]">
                {d.day}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function FunnelBar({
  label,
  value,
  max,
  note,
}: {
  label: string;
  value: number;
  max: number;
  note?: string;
}) {
  const pct = max <= 0 ? 0 : Math.round((value / max) * 100);
  return (
    <div>
      <div className="mb-1 flex items-baseline justify-between gap-2">
        <span className="text-[13px] font-medium text-[var(--color-ink)]">
          {label}
        </span>
        <span className="text-[13px] font-semibold tabular-nums text-[var(--color-ink)]">
          {value}
          {note && (
            <span className="ml-1 font-normal text-[var(--color-neutral-400)]">
              {note}
            </span>
          )}
        </span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-[var(--color-neutral-100)]">
        <div
          className="h-full rounded-full bg-[var(--color-primary-500)] transition-all"
          style={{ width: `${Math.max(pct, value > 0 ? 4 : 0)}%` }}
        />
      </div>
    </div>
  );
}

export default function DashboardPage() {
  const { user, loading: authLoading } = useAuth();
  const {
    authHeaders,
    businessId,
    business,
    loading: businessLoading,
  } = useBusiness();
  const [range, setRange] = useState<RangeKey>('today');
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const firstName = useMemo(() => {
    const email = user?.email;
    if (!email) return 'equipe';
    const local = email.split('@')[0] ?? 'equipe';
    return local.charAt(0).toUpperCase() + local.slice(1);
  }, [user]);

  const load = useCallback(async () => {
    if (!businessId) return;
    setLoading(true);
    setError(null);
    try {
      const headers = await authHeaders();
      const res = await fetch(`${API_URL}/dashboard?range=${range}`, {
        headers,
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? 'Falha ao carregar painel');
      setData(json as DashboardData);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Falha ao carregar');
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [authHeaders, range, businessId]);

  useEffect(() => {
    if (authLoading || businessLoading) return;
    if (
      !businessId ||
      business?.status === 'pending' ||
      business?.status === 'suspended'
    ) {
      setLoading(false);
      setData(null);
      return;
    }
    void load();
  }, [authLoading, businessLoading, businessId, business?.status, load]);

  const topbar = (
    <header className="flex h-[60px] shrink-0 items-center gap-4 border-b border-[var(--color-hairline)] bg-[var(--color-card)] px-5 md:px-7">
      <h1 className="text-[17px] font-semibold text-[var(--color-ink)]">
        {greeting()}, {firstName}
      </h1>
      <div className="ml-auto flex gap-1 rounded-[12px] bg-[var(--color-neutral-100)] p-1" role="group" aria-label="Período">
        {RANGES.map((r) => {
          const active = range === r.key;
          return (
            <button
              key={r.key}
              type="button"
              onClick={() => setRange(r.key)}
              className={`min-h-9 rounded-[10px] px-3.5 text-[13px] font-semibold transition-all ${
                active
                  ? 'bg-[var(--color-card)] text-[var(--color-ink)] shadow-[0_1px_3px_rgba(16,24,40,0.08)]'
                  : 'text-[var(--color-neutral-500)] hover:text-[var(--color-ink)]'
              }`}
            >
              {r.label}
            </button>
          );
        })}
      </div>
    </header>
  );

  const activeList =
    data?.activeCampaigns && data.activeCampaigns.length > 0
      ? data.activeCampaigns
      : data?.activeCampaign
        ? [
            {
              id: data.activeCampaign.id,
              name: data.activeCampaign.name,
              type: 'stamps' as string,
              rewardTitle: data.activeCampaign.rewardTitle,
              stampsNeeded: data.activeCampaign.stampsNeeded,
            },
          ]
        : [];
  const activePreview = activeList.slice(0, 3);
  const activeExtra = activeList.length - activePreview.length;
  const funnel = data?.funnel;
  const funnelMax = Math.max(funnel?.base ?? 1, funnel?.active ?? 1, 1);

  return (
    <AppShell
      businessName={business?.name ?? data?.business.name}
      title="Painel"
      topbar={topbar}
    >
      <div className="px-4 py-5 md:px-7 md:py-6">
        <div className="mb-5 md:hidden">
          <h1 className="text-[26px] font-semibold tracking-[-0.03em] text-[var(--color-ink)]">
            {greeting()}, {firstName}
          </h1>
          <div className="mt-3">
            <div
              className="flex gap-1 overflow-x-auto rounded-[14px] bg-[var(--color-neutral-100)] p-1"
              role="group"
              aria-label="Período"
            >
              {RANGES.map((r) => {
                const active = range === r.key;
                return (
                  <button
                    key={r.key}
                    type="button"
                    onClick={() => setRange(r.key)}
                    className={`min-h-9 shrink-0 rounded-[11px] px-3.5 text-[13px] font-semibold transition-all ${
                      active
                        ? 'bg-[var(--color-card)] text-[var(--color-ink)] shadow-[0_1px_3px_rgba(16,24,40,0.08)]'
                        : 'text-[var(--color-neutral-500)]'
                    }`}
                  >
                    {r.label}
                  </button>
                );
              })}
            </div>
          </div>
        </div>        {error && (
          <div
            className="mb-4 rounded-[12px] border border-[var(--color-danger)] bg-[var(--color-danger-bg)] px-4 py-3 text-[14px] text-[var(--color-danger)]"
            role="alert"
          >
            {error}{' '}
            <button
              type="button"
              className="font-semibold underline"
              onClick={() => void load()}
            >
              Tentar de novo
            </button>
          </div>
        )}

        {loading && !data ? (
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <div
                key={i}
                className="h-[110px] animate-pulse rounded-[14px] bg-[var(--color-neutral-100)]"
              />
            ))}
          </div>
        ) : data ? (
          <>
            {data.insight && (
              <div className="mb-[18px] overflow-hidden rounded-[18px] border border-[var(--color-hairline)] bg-[var(--color-card)] p-5 shadow-[var(--shadow-card)]">
                <p className="text-[12px] font-semibold uppercase tracking-[0.04em] text-[var(--color-neutral-400)]">
                  Por que campanhas importam
                </p>
                <p className="mt-2 text-[18px] font-semibold tracking-[-0.02em] text-[var(--color-ink)] md:text-[20px]">
                  {data.insight.title}
                </p>
                <p className="mt-2 max-w-3xl text-[14px] leading-relaxed text-[var(--color-neutral-500)] md:text-[15px]">
                  {data.insight.body}
                </p>
                {activeList.length === 0 && (
                  <Link
                    href="/campaigns"
                    className="mt-3 inline-flex min-h-10 items-center text-[14px] font-semibold text-[var(--color-primary-500)]"
                  >
                    Criar campanha →
                  </Link>
                )}
              </div>
            )}

            <div className="mb-[18px] grid grid-cols-2 gap-3 xl:grid-cols-4">
              <KpiCard
                label="Clientes ativos"
                value={data.kpis.customers.value}
                deltaPct={data.kpis.customers.deltaPct}
                hint="com visita no período"
              />
              <KpiCard
                label="Taxa de retorno"
                value={data.kpis.repeatRate.value}
                deltaPct={data.kpis.repeatRate.deltaPct}
                suffix="%"
                hint="vieram 2+ vezes"
              />
              <KpiCard
                label="Visitas / cliente"
                value={data.kpis.avgVisits?.value ?? 0}
                deltaPct={data.kpis.avgVisits?.deltaPct ?? null}
                hint="média no período"
              />
              <KpiCard
                label="Resgates"
                value={data.kpis.redeems.value}
                deltaPct={data.kpis.redeems.deltaPct}
                hint="prêmios no app"
              />
            </div>

            <div className="mb-[18px] grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              <KpiCard
                label="Novos no período"
                value={data.kpis.newCustomers?.value ?? 0}
                deltaPct={data.kpis.newCustomers?.deltaPct ?? null}
              />
              <KpiCard
                label="Carimbos"
                value={data.kpis.stamps.value}
                deltaPct={data.kpis.stamps.deltaPct}
              />
              <KpiCard
                label="Pontos acumulados"
                value={data.kpis.points?.value ?? 0}
                deltaPct={data.kpis.points?.deltaPct ?? null}
              />
              <KpiCard
                label="Gasto registrado"
                value={formatMoney(data.kpis.revenueCents?.value ?? 0)}
                deltaPct={data.kpis.revenueCents?.deltaPct ?? null}
                hint="via pontos no balcão"
              />
            </div>

            <div className="mb-[18px] grid gap-4 lg:grid-cols-[1.2fr_1fr]">
              <div className="rounded-[14px] border border-[var(--color-hairline)] bg-[var(--color-card)] p-5 shadow-[var(--shadow-card)]">
                <div className="mb-1 text-[15px] font-semibold text-[var(--color-ink)]">
                  Funil de fidelidade
                </div>
                <p className="mb-5 text-[13px] text-[var(--color-neutral-500)]">
                  Do cadastro ao retorno e ao resgate — o prêmio da campanha é o
                  incentivo da próxima visita.
                </p>
                {funnel ? (
                  <div className="flex flex-col gap-4">
                    <FunnelBar
                      label="Base de clientes"
                      value={funnel.base}
                      max={funnelMax}
                    />
                    <FunnelBar
                      label="Ativos no período"
                      value={funnel.active}
                      max={funnelMax}
                    />
                    <FunnelBar
                      label="Voltaram (2+ visitas)"
                      value={funnel.returning}
                      max={funnelMax}
                    />
                    <FunnelBar
                      label="Resgataram prêmio"
                      value={funnel.redeemed}
                      max={funnelMax}
                    />
                    {funnel.inactive > 0 && (
                      <p className="text-[12px] text-[var(--color-neutral-400)]">
                        {funnel.inactive} cliente
                        {funnel.inactive > 1 ? 's' : ''} sem visita neste
                        período — oportunidade de reativar com campanha.
                      </p>
                    )}
                  </div>
                ) : (
                  <p className="text-[13px] text-[var(--color-neutral-500)]">
                    Sem dados ainda.
                  </p>
                )}
              </div>

              <div className="rounded-[14px] border border-[var(--color-hairline)] bg-[var(--color-card)] p-5 shadow-[var(--shadow-card)]">
                <div className="mb-1 text-[15px] font-semibold text-[var(--color-ink)]">
                  Clientes mais valiosos
                </div>
                <p className="mb-4 text-[13px] text-[var(--color-neutral-500)]">
                  Quem mais visita, gasta e engaja com a fidelidade neste
                  período.
                </p>
                {!data.topCustomers?.length ? (
                  <p className="text-[13px] text-[var(--color-neutral-500)]">
                    Ainda sem atividade.{' '}
                    <Link
                      href="/counter"
                      className="font-semibold text-[var(--color-primary-500)]"
                    >
                      Ir ao balcão
                    </Link>
                  </p>
                ) : (
                  <ul className="flex flex-col gap-3">
                    {data.topCustomers.map((c, i) => (
                      <li
                        key={c.membershipId}
                        className="flex items-center gap-3 border-b border-[var(--color-hairline)] pb-3 last:border-0 last:pb-0"
                      >
                        <span className="w-5 text-[12px] font-semibold tabular-nums text-[var(--color-neutral-400)]">
                          {i + 1}
                        </span>
                        <span
                          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-[12px] font-bold text-[var(--color-primary-500)]"
                          style={{ background: 'var(--color-primary-50)' }}
                          aria-hidden
                        >
                          {c.initials}
                        </span>
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="truncate text-[14px] font-semibold text-[var(--color-ink)]">
                              {c.displayName}
                            </span>
                            <span
                              className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${
                                c.tier === 'vip'
                                  ? 'bg-[var(--color-primary-50)] text-[var(--color-primary-600)]'
                                  : c.tier === 'new'
                                    ? 'bg-[var(--color-neutral-100)] text-[var(--color-neutral-500)]'
                                    : 'bg-teal-50 text-teal-800'
                              }`}
                            >
                              {TIER_LABEL[c.tier]}
                            </span>
                          </div>
                          <div className="mt-0.5 text-[12px] text-[var(--color-neutral-500)]">
                            {c.visits} visita{c.visits !== 1 ? 's' : ''}
                            {c.stamps > 0 ? ` · ${c.stamps} carimbos` : ''}
                            {c.points > 0 ? ` · ${c.points} pts` : ''}
                            {c.spendCents > 0
                              ? ` · ${formatMoney(c.spendCents)}`
                              : ''}
                            {c.redeems > 0
                              ? ` · ${c.redeems} resgate${c.redeems > 1 ? 's' : ''}`
                              : ''}
                          </div>
                        </div>
                        <span className="shrink-0 text-[11px] text-[var(--color-neutral-400)]">
                          {formatRelative(c.lastVisitAt)}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>

            <div className="grid gap-4 lg:grid-cols-[1.6fr_1fr]">
              <WeekChart series={data.weekSeries} />

              <div className="flex flex-col gap-4">
                <div className="rounded-[14px] border border-[var(--color-hairline)] bg-[var(--color-card)] p-[18px] shadow-[var(--shadow-card)]">
                  <div className="mb-3.5 text-[14px] font-semibold text-[var(--color-ink)]">
                    Ao vivo
                  </div>
                  {data.live.length === 0 ? (
                    <p className="text-[13px] text-[var(--color-neutral-500)]">
                      Nenhuma atividade ainda.{' '}
                      <Link
                        href="/counter"
                        className="font-semibold text-[var(--color-primary-500)]"
                      >
                        Ir ao balcão
                      </Link>
                    </p>
                  ) : (
                    <ul className="flex flex-col gap-3">
                      {data.live.map((item) => (
                        <li key={item.id} className="flex items-center gap-2.5">
                          <span
                            className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[11px] font-bold text-[var(--color-primary-500)]"
                            style={{ background: 'var(--color-primary-50)' }}
                            aria-hidden
                          >
                            {item.initials}
                          </span>
                          <div className="min-w-0 flex-1">
                            <div className="truncate text-[13px] font-medium text-[var(--color-ink)]">
                              {item.text}
                            </div>
                            <div className="text-[11px] text-[var(--color-neutral-400)]">
                              {formatRelative(item.createdAt)} ·{' '}
                              {item.locationName}
                            </div>
                          </div>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>

                {activePreview.length === 0 ? (
                  <div className="rounded-[14px] border border-dashed border-[var(--color-hairline)] p-[18px] text-[13px] text-[var(--color-neutral-500)]">
                    Nenhuma campanha ativa.{' '}
                    <Link
                      href="/campaigns"
                      className="font-semibold text-[var(--color-primary-500)]"
                    >
                      Criar campanha
                    </Link>
                  </div>
                ) : (
                  <div className="rounded-[14px] border border-[var(--color-hairline)] bg-[var(--color-card)] p-[18px] shadow-[var(--shadow-card)]">
                    <div className="mb-3.5 flex items-center justify-between gap-2">
                      <div className="text-[14px] font-semibold text-[var(--color-ink)]">
                        Campanhas ativas
                        <span className="ml-1.5 font-medium text-[var(--color-neutral-400)]">
                          ({activeList.length})
                        </span>
                      </div>
                      <Link
                        href="/campaigns?status=active"
                        className="text-[13px] font-semibold text-[var(--color-primary-500)] hover:underline"
                      >
                        Ver mais
                      </Link>
                    </div>
                    <ul className="flex flex-col gap-2.5">
                      {activePreview.map((c) => (
                        <li
                          key={c.id}
                          className="rounded-[12px] px-3.5 py-3 text-white"
                          style={{ background: 'var(--color-ink)' }}
                        >
                          <div className="text-[14px] font-semibold">
                            {c.name}
                          </div>
                          <div className="mt-0.5 text-[12px] leading-relaxed text-[var(--color-neutral-400)]">
                            {c.type === 'spend' ? 'Pontos' : 'Carimbos'}
                            {c.stampsNeeded
                              ? c.type === 'spend'
                                ? ` · meta ${c.stampsNeeded} pts`
                                : ` · ${c.stampsNeeded} carimbos`
                              : ''}
                            {c.rewardTitle ? ` → ${c.rewardTitle}` : ''}
                          </div>
                        </li>
                      ))}
                    </ul>
                    {activeExtra > 0 && (
                      <p className="mt-3 text-[12px] text-[var(--color-neutral-500)]">
                        +{activeExtra} ativa{activeExtra > 1 ? 's' : ''} —{' '}
                        <Link
                          href="/campaigns?status=active"
                          className="font-semibold text-[var(--color-primary-500)]"
                        >
                          ver todas
                        </Link>
                      </p>
                    )}
                  </div>
                )}
              </div>
            </div>
          </>
        ) : null}
      </div>
    </AppShell>
  );
}
