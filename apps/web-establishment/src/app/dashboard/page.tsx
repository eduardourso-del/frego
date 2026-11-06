'use client';

import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import Link from 'next/link';
import { AppShell } from '@/components/app-shell';
import { FregoIntelligence, type IntelligencePayload } from '@/components/frego-intelligence';
import { CampaignPerformanceSection } from '@/components/campaign-performance-section';
import { TermInfo } from '@/components/term-info';
import { useAuth } from '@/lib/auth-context';
import { memberDisplayName, useBusiness } from '@/lib/business-context';
import { API_URL } from '@/lib/api';
import { TERM } from '@/lib/term-copy';
import { WhatsAppAttentionBanner } from '@/components/whatsapp-settings-card';
import {
  PeriodPicker,
  periodSearchParams,
  type PeriodValue,
} from '@/components/period-picker';

type RangeKey = 'today' | '7d' | '30d' | '90d' | 'custom';

type Kpi = { value: number; previous?: number; deltaPct: number | null };

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
    cashbackEarnedCents?: Kpi;
    cashbackSpentCents?: Kpi;
    newCustomers?: Kpi;
    campaignRedeems?: Kpi;
    campaignReturnCents?: Kpi;
  };
  funnel?: {
    base: number;
    active: number;
    returning: number;
    redeemed: number;
    inactive: number;
  };
  insight?: { title: string; body: string; href?: string; cta?: string };
  intelligence?: IntelligencePayload;
  audienceInsight?: {
    key: string;
    name: string;
    memberCount: number;
    href: string;
  };
  audiencePresets?: Array<{
    key: string;
    name: string;
    description: string;
    rules: Record<string, unknown>;
    memberCount: number;
  }>;
  topCampaign?: {
    id: string;
    name: string;
    type?: string;
    redeems: number;
    fulfillPct: number;
    rewardTitle: string | null;
    cashbackPercent?: number | null;
    redeemRevenueCents?: number;
    revenueCoverage?: { withAmount: number; used: number };
    openVouchers?: number;
  } | null;
  weakCampaign?: {
    id: string;
    name: string;
    type?: string;
    redeems: number;
    fulfillPct: number;
    redeemRevenueCents?: number;
    revenueCoverage?: { withAmount: number; used: number };
    openVouchers?: number;
  } | null;
  topCustomers?: TopCustomer[];
  weekSeries: Array<{
    date: string;
    day: string;
    visits: number;
    redeems: number;
    prevDate?: string;
    prevVisits?: number;
    prevRedeems?: number;
  }>;
  weekDeltaPct?: number | null;
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
    redeems?: number;
    fulfillPct?: number;
  } | null;
  activeCampaigns?: Array<{
    id: string;
    name: string;
    type: string;
    rewardTitle: string | null;
    stampsNeeded: number | null;
    cashbackPercent?: number | null;
    redeems?: number;
    redeemsDeltaPct?: number | null;
    redeemers?: number;
    fulfillPct?: number;
    openVouchers?: number;
    usedVouchers?: number;
    expiredVouchers?: number;
    redeemRevenueCents?: number;
    revenueCoverage?: { withAmount: number; used: number };
  }>;
};

const RANGES: { key: RangeKey; label: string }[] = [
  { key: 'today', label: 'Hoje' },
  { key: '7d', label: '7 dias' },
  { key: '30d', label: '30 dias' },
  { key: '90d', label: '90 dias' },
];

const TIER_LABEL: Record<TopCustomer['tier'], string> = {
  vip: 'VIP',
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
  if (mins < 60) return mins === 1 ? 'há 1 min' : `há ${mins} min`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return hours === 1 ? 'há 1 h' : `há ${hours} h`;
  const days = Math.floor(hours / 24);
  return days === 1 ? 'há 1 dia' : `há ${days} dias`;
}

function formatMoney(cents: number) {
  return (cents / 100).toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  });
}

function formatCount(n: number) {
  return n.toLocaleString('pt-BR');
}

function formatAvg(n: number) {
  return n.toLocaleString('pt-BR', { maximumFractionDigits: 1 });
}

function Delta({ value }: { value: number | null }) {
  if (value === null) {
    return (
      <span className="text-[12px] font-semibold text-[var(--color-neutral-400)]">
        — sem comparação
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
  previous,
  suffix = '',
  hint,
}: {
  label: ReactNode;
  value: number | string;
  deltaPct: number | null;
  previous?: string;
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
      <div className="mt-1 flex flex-col gap-1">
        <div className="flex flex-wrap items-center gap-x-1.5">
          <Delta value={deltaPct} />
          {previous != null && (
            <span className="text-[12px] font-medium text-[var(--color-neutral-500)]">
              · antes {previous}
            </span>
          )}
        </div>
        {hint && (
          <span className="text-[11px] text-[var(--color-neutral-400)]">
            {hint}
          </span>
        )}
      </div>
    </div>
  );
}

function slashDay(ymd: string) {
  const [, month, day] = ymd.split('-');
  return `${Number(day)}/${Number(month)}`;
}

function visitBars(series: DashboardData['weekSeries']) {
  const point = (
    key: string,
    label: string,
    visits: number,
    prevVisits: number,
    title: string,
  ) => ({ key, label, visits, prevVisits, title });

  if (series.length <= 31) {
    return series.map((d) =>
      point(
        d.date,
        series.length <= 8 ? d.day : slashDay(d.date),
        d.visits,
        d.prevVisits ?? 0,
        `${slashDay(d.date)}: ${d.visits} visitas · período anterior ${d.prevVisits ?? 0}`,
      ),
    );
  }

  const size = series.length <= 92 ? 7 : 30;
  const buckets = [];
  for (let i = 0; i < series.length; i += size) {
    const slice = series.slice(i, i + size);
    const first = slice[0]!;
    const last = slice[slice.length - 1]!;
    const visits = slice.reduce((sum, d) => sum + d.visits, 0);
    const prevVisits = slice.reduce((sum, d) => sum + (d.prevVisits ?? 0), 0);
    const span =
      first.date === last.date
        ? slashDay(first.date)
        : `${slashDay(first.date)}–${slashDay(last.date)}`;
    buckets.push(
      point(
        first.date,
        slashDay(first.date),
        visits,
        prevVisits,
        `${span}: ${visits} visitas · período anterior ${prevVisits}`,
      ),
    );
  }
  return buckets;
}

function WeekChart({
  series,
  deltaPct,
  sameWeekday,
}: {
  series: DashboardData['weekSeries'];
  deltaPct: number | null;
  sameWeekday?: boolean;
}) {
  const bars = useMemo(() => visitBars(series), [series]);
  const prevTotal = series.reduce((sum, d) => sum + (d.prevVisits ?? 0), 0);
  const max = useMemo(
    () => Math.max(1, ...bars.map((d) => Math.max(d.visits, d.prevVisits))),
    [bars],
  );
  const dense = bars.length > 14;
  const sparseAxis = bars.length > 8;
  const plot = sparseAxis ? 120 : 104;
  const grouped =
    series.length > 92
      ? 'por mês'
      : series.length > 31
        ? 'por semana'
        : series.length === 1
          ? 'no dia'
          : 'por dia';

  return (
    <div className="rounded-[14px] border border-[var(--color-hairline)] bg-[var(--color-card)] p-5 shadow-[var(--shadow-card)]">
      <div className="mb-1 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
            <div className="text-[15px] font-semibold text-[var(--color-ink)]">
              Visitas no período
            </div>
            <Delta value={deltaPct} />
          </div>
          <p className="mt-0.5 text-[12px] text-[var(--color-neutral-500)]">
            {sameWeekday
              ? `${prevTotal.toLocaleString('pt-BR')} no mesmo dia da semana passada, até agora`
              : `${prevTotal.toLocaleString('pt-BR')} no período anterior · ${grouped}`}
          </p>
        </div>
        <div className="flex shrink-0 gap-3.5 text-[12px] text-[var(--color-neutral-500)]">
          <span className="flex items-center gap-1.5">
            <span
              className="inline-block h-2.5 w-2.5 rounded-[2px]"
              style={{ background: 'var(--color-neutral-200)' }}
            />
            Anterior
          </span>
          <span className="flex items-center gap-1.5">
            <span
              className="inline-block h-2.5 w-2.5 rounded-[2px]"
              style={{ background: 'var(--color-primary-500)' }}
            />
            Período
          </span>
        </div>
      </div>
      <div className={`mt-3 flex h-[132px] items-end ${dense ? 'gap-px' : 'gap-2'}`}>
        {bars.map((d) => {
          const currentH =
            d.visits === 0 ? 3 : Math.max(6, Math.round((d.visits / max) * plot));
          const prevH =
            d.prevVisits === 0
              ? 3
              : Math.max(6, Math.round((d.prevVisits / max) * plot));
          return (
            <div
              key={d.key}
              className="flex h-full min-w-0 flex-1 flex-col items-center justify-end gap-1.5"
              title={d.title}
            >
              <div
                className={`flex w-full items-end justify-center gap-0.5 ${
                  dense ? '' : 'max-w-[36px]'
                }`}
                style={{ height: plot }}
              >
                <div
                  className="w-1/2 rounded-[3px]"
                  style={{
                    height: prevH,
                    background:
                      d.prevVisits === 0
                        ? 'var(--color-neutral-100)'
                        : 'var(--color-neutral-200)',
                  }}
                />
                <div
                  className="w-1/2 rounded-[3px]"
                  style={{
                    height: currentH,
                    background:
                      d.visits === 0
                        ? 'var(--color-neutral-100)'
                        : 'var(--color-primary-500)',
                  }}
                />
              </div>
              {sparseAxis ? null : (
                <span className="text-[11px] text-[var(--color-neutral-400)]">
                  {d.label}
                </span>
              )}
            </div>
          );
        })}
      </div>
      {sparseAxis && bars.length > 0 ? (
        <div className="mt-2 flex items-end justify-between gap-2 text-[11px] leading-none text-[var(--color-neutral-400)]">
          <span>{bars[0]?.label}</span>
          <span>{bars[Math.floor((bars.length - 1) / 2)]?.label}</span>
          <span>{bars[bars.length - 1]?.label}</span>
        </div>
      ) : null}
    </div>
  );
}

function PainelSection({
  title,
  hint,
  children,
}: {
  title: string;
  hint?: string;
  children: ReactNode;
}) {
  return (
    <section className="mb-8 last:mb-0">
      <header className="mb-3">
        <h2 className="text-[12px] font-semibold uppercase tracking-[0.04em] text-[var(--color-neutral-400)]">
          {title}
        </h2>
        {hint ? (
          <p className="mt-1 text-[13px] leading-snug text-[var(--color-neutral-500)]">
            {hint}
          </p>
        ) : null}
      </header>
      {children}
    </section>
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
    businesses,
    loading: businessLoading,
  } = useBusiness();
  const kinds = business?.activeEarnKinds;
  const [period, setPeriod] = useState<PeriodValue>({
    mode: 'preset',
    key: 'today',
  });
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const firstName = useMemo(() => {
    const named = memberDisplayName(businesses, businessId);
    if (named) return named.split(/\s+/)[0] ?? named;
    const email = user?.email;
    if (!email) return 'equipe';
    const local = email.split('@')[0] ?? 'equipe';
    return local.charAt(0).toUpperCase() + local.slice(1);
  }, [businesses, businessId, user]);

  const load = useCallback(async () => {
    if (!businessId) return;
    setLoading(true);
    setError(null);
    try {
      const headers = await authHeaders();
      const res = await fetch(
        `${API_URL}/dashboard?${periodSearchParams(period)}`,
        {
          headers,
        },
      );
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? 'Não foi possível carregar o painel.');
      setData(json as DashboardData);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Não foi possível carregar.');
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [authHeaders, period, businessId]);

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
    <header className="flex min-h-[60px] shrink-0 flex-wrap items-center gap-3 border-b border-[var(--color-hairline)] bg-[var(--color-card)] px-5 py-2 md:px-7">
      <h1 className="text-[17px] font-semibold text-[var(--color-ink)]">
        {greeting()}, {firstName}
      </h1>
      <div className="ml-auto">
        <PeriodPicker presets={RANGES} value={period} onChange={setPeriod} />
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
            <PeriodPicker presets={RANGES} value={period} onChange={setPeriod} />
          </div>
        </div>
        <WhatsAppAttentionBanner />
        {business && !business.timeZone ? (
          <div className="mb-4 rounded-[12px] border border-[var(--color-primary-200)] bg-[var(--color-primary-50)] px-4 py-3 text-[14px] text-[var(--color-primary-800)]">
            Informe o endereço da unidade em{' '}
            <Link href="/settings" className="font-semibold underline">
              Configurações
            </Link>
            . O dia do painel segue o estado onde vocês operam.
          </div>
        ) : null}
        {error && (
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
              Tentar novamente
            </button>
          </div>
        )}

        {loading && !data ? (
          <div className="grid gap-4">
            <div className="h-[220px] animate-pulse rounded-[20px] bg-[linear-gradient(135deg,#9A3D62_0%,#D4537E_52%,#F4A0B8_100%)]" />
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              {Array.from({ length: 4 }).map((_, i) => (
                <div
                  key={i}
                  className="h-[110px] animate-pulse rounded-[14px] bg-[var(--color-neutral-100)]"
                />
              ))}
            </div>
          </div>
        ) : data ? (
          <>
            {data.intelligence && (
              <FregoIntelligence data={data.intelligence} />
            )}

            <PainelSection
              title="O estabelecimento"
              hint={
                data.range === 'today'
                  ? 'Hoje, até agora, contra o mesmo dia da semana passada.'
                  : 'Quem veio, quem voltou e como o clube se mexeu neste período.'
              }
            >
              <div className="mb-3 grid grid-cols-2 gap-3 xl:grid-cols-4">
                <KpiCard
                  label="Clientes ativos"
                  value={data.kpis.customers.value}
                  deltaPct={data.kpis.customers.deltaPct}
                  previous={formatCount(data.kpis.customers.previous ?? 0)}
                  hint="com visita neste período"
                />
                <KpiCard
                  label="Novos clientes"
                  value={data.kpis.newCustomers?.value ?? 0}
                  deltaPct={data.kpis.newCustomers?.deltaPct ?? null}
                  previous={formatCount(data.kpis.newCustomers?.previous ?? 0)}
                />
                <KpiCard
                  label={
                    <TermInfo info={TERM.taxaRetorno}>Taxa de retorno</TermInfo>
                  }
                  value={data.kpis.repeatRate.value}
                  deltaPct={data.kpis.repeatRate.deltaPct}
                  previous={`${data.kpis.repeatRate.previous ?? 0}%`}
                  suffix="%"
                  hint="vieram duas vezes ou mais"
                />
                <KpiCard
                  label="Visitas / cliente"
                  value={data.kpis.avgVisits?.value ?? 0}
                  deltaPct={data.kpis.avgVisits?.deltaPct ?? null}
                  previous={formatAvg(data.kpis.avgVisits?.previous ?? 0)}
                  hint="média no período"
                />
              </div>

              <div className="mb-3 grid grid-cols-2 gap-3 xl:grid-cols-4">
                  <KpiCard
                    label={<TermInfo info={TERM.resgates}>Resgates</TermInfo>}
                    value={data.kpis.redeems.value}
                    deltaPct={data.kpis.redeems.deltaPct}
                    previous={formatCount(data.kpis.redeems.previous ?? 0)}
                    hint="prêmios no app"
                  />
                  {(kinds == null || kinds.includes('stamps')) && (
                    <KpiCard
                      label="Carimbos"
                      value={data.kpis.stamps.value}
                      deltaPct={data.kpis.stamps.deltaPct}
                      previous={formatCount(data.kpis.stamps.previous ?? 0)}
                    />
                  )}
                  {(kinds == null || kinds.includes('points')) && (
                    <KpiCard
                      label="Pontos"
                      value={data.kpis.points?.value ?? 0}
                      deltaPct={data.kpis.points?.deltaPct ?? null}
                      previous={formatCount(data.kpis.points?.previous ?? 0)}
                    />
                  )}
                  {(kinds == null || kinds.includes('points')) && (
                    <KpiCard
                      label="Gasto registrado"
                      value={formatMoney(data.kpis.revenueCents?.value ?? 0)}
                      deltaPct={data.kpis.revenueCents?.deltaPct ?? null}
                      previous={formatMoney(data.kpis.revenueCents?.previous ?? 0)}
                      hint="via pontos no balcão"
                    />
                  )}
                  {(kinds == null || kinds.includes('cashback')) && (
                    <KpiCard
                      label="Cashback gerado"
                      value={formatMoney(data.kpis.cashbackEarnedCents?.value ?? 0)}
                      deltaPct={data.kpis.cashbackEarnedCents?.deltaPct ?? null}
                      previous={formatMoney(data.kpis.cashbackEarnedCents?.previous ?? 0)}
                    />
                  )}
                  {(kinds == null || kinds.includes('cashback')) && (
                    <KpiCard
                      label="Cashback usado"
                      value={formatMoney(data.kpis.cashbackSpentCents?.value ?? 0)}
                      deltaPct={data.kpis.cashbackSpentCents?.deltaPct ?? null}
                      previous={formatMoney(data.kpis.cashbackSpentCents?.previous ?? 0)}
                      hint="no caixa"
                    />
                  )}
                </div>

              <div className="grid items-start gap-4 lg:grid-cols-2">
                <WeekChart
                  series={data.weekSeries}
                  deltaPct={data.weekDeltaPct ?? null}
                  sameWeekday={data.range === 'today'}
                />

                <div className="rounded-[14px] border border-[var(--color-hairline)] bg-[var(--color-card)] p-5 shadow-[var(--shadow-card)]">
                  <div className="mb-1 text-[15px] font-semibold text-[var(--color-ink)]">
                    Funil do clube
                  </div>
                  <p className="mb-4 text-[13px] leading-snug text-[var(--color-neutral-500)]">
                    Do cadastro ao retorno e ao resgate.
                  </p>
                  {funnel ? (
                    <div className="flex flex-col gap-3">
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
                          período — dá para reativar com uma campanha.
                        </p>
                      )}
                    </div>
                  ) : (
                    <p className="text-[13px] text-[var(--color-neutral-500)]">
                      Sem dados ainda.
                    </p>
                  )}
                </div>
              </div>
            </PainelSection>

            <PainelSection
              title="Campanhas"
              hint="Desempenho no recorte: quem resgatou, o que o caixa confirmou e o retorno em vendas."
            >
              <CampaignPerformanceSection
                campaigns={activeList}
                topCampaign={data.topCampaign ?? null}
                weakCampaign={data.weakCampaign ?? null}
                returnCents={data.kpis.campaignReturnCents?.value ?? 0}
                returnDeltaPct={
                  data.kpis.campaignReturnCents?.deltaPct ?? null
                }
                redeemsDeltaPct={data.kpis.campaignRedeems?.deltaPct ?? null}
              />
            </PainelSection>

            <PainelSection
              title="Pessoas"
              hint="Quem mais vale o estabelecimento e o que acontece agora no balcão."
            >
              <div className="grid items-start gap-4 lg:grid-cols-2">
                <div className="rounded-[14px] border border-[var(--color-hairline)] bg-[var(--color-card)] p-5 shadow-[var(--shadow-card)]">
                  <div className="mb-1 text-[15px] font-semibold text-[var(--color-ink)]">
                    Mais valiosos
                  </div>
                  <p className="mb-4 text-[13px] text-[var(--color-neutral-500)]">
                    Quem mais visita, gasta e engaja neste período.
                  </p>
                  {!data.topCustomers?.length ? (
                    <p className="text-[13px] text-[var(--color-neutral-500)]">
                      Ainda sem atividade.{' '}
                      <Link
                        href="/counter"
                        className="font-semibold text-[var(--color-primary-500)]"
                      >
                        Ir para o balcão
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
                              {c.points > 0 ? ` · ${c.points} pontos` : ''}
                              {c.spendCents > 0
                                ? ` · ${formatMoney(c.spendCents)}`
                                : ''}
                              {c.redeems > 0
                                ? ` · ${c.redeems} resgate${c.redeems > 1 ? 's' : ''}`
                                : ''}
                            </div>
                            {c.spendCents >= 20000 && (
                              <Link
                                href={`/customers?spendCentsMin=${Math.floor(c.spendCents / 10000) * 10000}&windowDays=90`}
                                className="mt-1 inline-block text-[11px] font-semibold text-[var(--color-primary-500)]"
                                onClick={(e) => e.stopPropagation()}
                              >
                                Ver clientes parecidos →
                              </Link>
                            )}
                          </div>
                          <span className="shrink-0 text-[11px] text-[var(--color-neutral-400)]">
                            {formatRelative(c.lastVisitAt)}
                          </span>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>

                <div className="rounded-[14px] border border-[var(--color-hairline)] bg-[var(--color-card)] p-[18px] shadow-[var(--shadow-card)]">
                  <div className="mb-1 flex items-baseline justify-between gap-2">
                    <div className="text-[15px] font-semibold text-[var(--color-ink)]">
                      Ao vivo
                    </div>
                    <Link
                      href="/customers"
                      className="text-[13px] font-semibold text-[var(--color-primary-500)] hover:underline"
                    >
                      Ver clientes
                    </Link>
                  </div>
                  <p className="mb-4 text-[13px] text-[var(--color-neutral-500)]">
                    Últimas movimentações no balcão.
                  </p>
                  {data.live.length === 0 ? (
                    <p className="text-[13px] text-[var(--color-neutral-500)]">
                      Nenhuma atividade ainda.{' '}
                      <Link
                        href="/counter"
                        className="font-semibold text-[var(--color-primary-500)]"
                      >
                        Ir para o balcão
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
              </div>
            </PainelSection>
          </>
        ) : null}
      </div>
    </AppShell>
  );
}
