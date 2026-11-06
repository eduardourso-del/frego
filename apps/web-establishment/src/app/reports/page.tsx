'use client';

import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import Link from 'next/link';
import { Download } from 'lucide-react';
import { AppShell } from '@/components/app-shell';
import { useAuth } from '@/lib/auth-context';
import { useBusiness } from '@/lib/business-context';
import { API_URL } from '@/lib/api';
import { formatCoverage } from '@/lib/campaign-return';
import {
  PeriodPicker,
  periodSearchParams,
  type PeriodValue,
} from '@/components/period-picker';
import { CampaignCompareChart } from '@/components/campaign-compare-chart';
import { TermInfo } from '@/components/term-info';
import { TERM } from '@/lib/term-copy';

type RangeKey = 'today' | '7d' | '30d' | '90d' | 'custom';

type KpiNum = {
  value: number;
  previous?: number;
  deltaPct?: number | null;
  ofBasePct?: number;
  delta?: number;
};

type ReportsData = {
  range: RangeKey;
  from: string;
  to: string;
  kpis: {
    activeCustomers: KpiNum;
    inactive?: KpiNum;
    newCustomers?: KpiNum;
    avgVisits: KpiNum;
    redeems: KpiNum;
    stamps: KpiNum;
    points: KpiNum;
    revenueCents: KpiNum;
    cashbackEarnedCents?: KpiNum;
    cashbackSpentCents?: KpiNum;
    repeatRate: KpiNum;
    base: number;
  };
  seriesDeltaPct?: number | null;
  series: Array<{
    date: string;
    label: string;
    stamps: number;
    points: number;
    redeems: number;
    customers: number;
    prevCustomers?: number;
  }>;
  cohorts: Array<{
    month: string;
    label: string;
    size: number;
    retained: number;
    rate: number;
  }>;
  locations: Array<{
    id: string;
    name: string;
    visits: number;
    stamps: number;
    points: number;
    redeems: number;
    sharePct: number;
    previous?: number;
    deltaPct?: number | null;
  }>;
  team: Array<{
    id: string;
    displayName: string;
    initials: string;
    stamps: number;
    points: number;
    redeems: number;
    sales?: number;
    activity: number;
    previous?: number;
    deltaPct?: number | null;
  }>;
  campaigns: Array<{
    id: string;
    name: string;
    type: string;
    status: string;
    rewardTitle: string | null;
    audienceSegmentId: string | null;
    audienceName: string | null;
    redeems: number;
    previousRedeems?: number;
    redeemsDeltaPct?: number | null;
    redeemers: number;
    eligible: number;
    engagePct: number;
    fulfillPct: number;
    openVouchers: number;
    usedVouchers: number;
    expiredVouchers: number;
    revenueFromRedeemersCents: number;
    revenueCoverage?: { withAmount: number; used: number };
  }>;
};

const RANGES: { key: RangeKey; label: string }[] = [
  { key: 'today', label: 'Hoje' },
  { key: '7d', label: '7 dias' },
  { key: '30d', label: '30 dias' },
  { key: '90d', label: '90 dias' },
];

const TYPE_LABEL: Record<string, string> = {
  stamps: 'Carimbos',
  spend: 'Pontos',
  birthday: 'Aniversário',
  visits: 'Visitas',
  cashback: 'Cashback',
  promo: 'Promoção',
};

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

function teamActivityLabel(
  member: ReportsData['team'][number],
  kinds: string[] | null | undefined,
) {
  const show = (kind: string) => kinds == null || kinds.includes(kind);
  const parts: string[] = [];
  if (show('stamps') && member.stamps > 0) {
    parts.push(`${member.stamps.toLocaleString('pt-BR')} carimbos`);
  }
  if (show('points') && member.points > 0) {
    parts.push(`${member.points.toLocaleString('pt-BR')} pontos`);
  }
  if (show('cashback') && (member.sales ?? 0) > 0) {
    parts.push(`${(member.sales ?? 0).toLocaleString('pt-BR')} vendas`);
  }
  if (member.redeems > 0) {
    parts.push(`${member.redeems.toLocaleString('pt-BR')} resgates`);
  }
  if (parts.length > 0) return parts.join(' · ');
  return `${member.activity.toLocaleString('pt-BR')} movimentos`;
}

function peopleHint(redeemers: number, eligible: number) {
  const people = eligible === 1 ? 'pessoa' : 'pessoas';
  return `${redeemers.toLocaleString('pt-BR')} de ${eligible.toLocaleString('pt-BR')} ${people}`;
}

function CampaignMetric({
  label,
  value,
  hint,
  info,
  className,
}: {
  label: string;
  value: ReactNode;
  hint?: string | null;
  info?: string;
  className?: string;
}) {
  return (
    <div className={className}>
      <div className="text-[11px] font-medium text-[var(--color-neutral-400)] lg:hidden">
        {info ? <TermInfo info={info}>{label}</TermInfo> : label}
      </div>
      <div className="mt-0.5 text-[13px] text-[var(--color-neutral-600)] lg:mt-0">
        {value}
      </div>
      {hint ? (
        <div className="text-[11px] text-[var(--color-neutral-400)]">{hint}</div>
      ) : null}
    </div>
  );
}

function Delta({ value }: { value: number | null | undefined }) {
  if (value == null) {
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
  hint,
  deltaPct,
  previous,
}: {
  label: ReactNode;
  value: string | number;
  hint?: string;
  deltaPct?: number | null;
  previous?: string;
}) {
  return (
    <div className="rounded-[14px] border border-[var(--color-hairline)] bg-[var(--color-card)] p-[18px] shadow-[var(--shadow-card)]">
      <div className="text-[13px] font-medium text-[var(--color-neutral-500)]">
        {label}
      </div>
      <div className="mt-1.5 text-[28px] font-semibold tracking-[-0.02em] text-[var(--color-ink)]">
        {value}
      </div>
      <div className="mt-1 flex flex-col gap-1">
        {deltaPct !== undefined && (
          <div className="flex flex-wrap items-center gap-x-1.5">
            <Delta value={deltaPct} />
            {previous != null && (
              <span className="text-[12px] font-medium text-[var(--color-neutral-500)]">
                · antes {previous}
              </span>
            )}
          </div>
        )}
        {hint && (
          <span className="text-[12px] font-semibold text-[var(--color-neutral-500)]">
            {hint}
          </span>
        )}
      </div>
    </div>
  );
}

type SeriesRow = ReportsData['series'][number];
type ChartGrain = 'day' | 'week' | 'month';

const PT_MONTHS_SHORT = [
  'jan',
  'fev',
  'mar',
  'abr',
  'mai',
  'jun',
  'jul',
  'ago',
  'set',
  'out',
  'nov',
  'dez',
] as const;

function parseIsoDay(iso: string) {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, (m ?? 1) - 1, d ?? 1);
}

function formatIsoDay(d: Date) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function formatDaySlash(iso: string) {
  const d = parseIsoDay(iso);
  return `${d.getDate()}/${d.getMonth() + 1}`;
}

function mondayOf(iso: string) {
  const d = parseIsoDay(iso);
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7));
  return formatIsoDay(d);
}

function monthLabel(ym: string, showYear: boolean) {
  const [y, m] = ym.split('-').map(Number);
  const name = PT_MONTHS_SHORT[(m ?? 1) - 1] ?? ym;
  return showYear ? `${name}/${String(y).slice(2)}` : name;
}

function suggestedGrain(days: number): ChartGrain {
  if (days > 90) return 'month';
  if (days > 31) return 'week';
  return 'day';
}

function aggregateSeries(series: SeriesRow[], grain: ChartGrain) {
  if (grain === 'day') {
    return series.map((d) => ({
      key: d.date,
      label: d.label,
      stamps: d.stamps,
      points: d.points,
      redeems: d.redeems,
      customers: d.customers,
      prevCustomers: d.prevCustomers ?? 0,
      from: d.date,
      to: d.date,
    }));
  }

  const buckets = new Map<
    string,
    {
      key: string;
      stamps: number;
      points: number;
      redeems: number;
      customers: number;
      prevCustomers: number;
      from: string;
      to: string;
    }
  >();
  const years = new Set<number>();

  for (const d of series) {
    years.add(parseIsoDay(d.date).getFullYear());
    const key = grain === 'week' ? mondayOf(d.date) : d.date.slice(0, 7);
    const existing = buckets.get(key);
    if (existing) {
      existing.stamps += d.stamps;
      existing.points += d.points;
      existing.redeems += d.redeems;
      existing.customers += d.customers;
      existing.prevCustomers += d.prevCustomers ?? 0;
      existing.to = d.date;
    } else {
      buckets.set(key, {
        key,
        stamps: d.stamps,
        points: d.points,
        redeems: d.redeems,
        customers: d.customers,
        prevCustomers: d.prevCustomers ?? 0,
        from: d.date,
        to: d.date,
      });
    }
  }

  const showYear = years.size > 1;
  return Array.from(buckets.values()).map((p) => ({
    ...p,
    label:
      grain === 'week' ? formatDaySlash(p.key) : monthLabel(p.key, showYear),
  }));
}

function ActivityChart({
  series,
  deltaPct,
  sameWeekday,
}: {
  series: SeriesRow[];
  deltaPct: number | null;
  sameWeekday?: boolean;
}) {
  const auto = suggestedGrain(series.length);
  const [grain, setGrain] = useState<ChartGrain>(auto);

  useEffect(() => {
    setGrain(auto);
  }, [auto]);

  const points = useMemo(
    () => aggregateSeries(series, grain),
    [series, grain],
  );
  const prevTotal = series.reduce((sum, d) => sum + (d.prevCustomers ?? 0), 0);
  const max = useMemo(
    () =>
      Math.max(
        1,
        ...points.map((d) => Math.max(d.customers, d.prevCustomers ?? 0)),
      ),
    [points],
  );

  const dense = grain === 'day' && points.length > 40;
  const sparseAxis = points.length > 8;
  const grainGap =
    grain === 'month' ? 'gap-3' : grain === 'week' ? 'gap-2' : 'gap-px';
  const subtitle = sameWeekday
    ? `${prevTotal.toLocaleString('pt-BR')} no mesmo dia da semana passada, até agora`
    : `${prevTotal.toLocaleString('pt-BR')} no período anterior · ${
        grain === 'month' ? 'por mês' : grain === 'week' ? 'por semana' : 'por dia'
      }`;

  return (
    <div className="min-w-0 overflow-x-hidden rounded-[14px] border border-[var(--color-hairline)] bg-[var(--color-card)] p-5 shadow-[var(--shadow-card)]">
      <div className="mb-1 flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-baseline gap-2">
          <div className="text-[15px] font-semibold text-[var(--color-ink)]">
            Atividade no período
          </div>
          <Delta value={deltaPct} />
        </div>
        <div
          className="flex shrink-0 rounded-[10px] bg-[var(--color-neutral-100)] p-0.5"
          role="group"
          aria-label="Agrupar atividade"
        >
          {(
            [
              { key: 'day', label: 'Dia' },
              { key: 'week', label: 'Semana' },
              { key: 'month', label: 'Mês' },
            ] as const
          ).map((opt) => (
            <button
              key={opt.key}
              type="button"
              onClick={() => setGrain(opt.key)}
              className={`rounded-[8px] px-2.5 py-1 text-[12px] font-semibold transition-colors ${
                grain === opt.key
                  ? 'bg-[var(--color-card)] text-[var(--color-ink)] shadow-sm'
                  : 'text-[var(--color-neutral-500)] hover:text-[var(--color-ink)]'
              }`}
            >
              {opt.label}
            </button>
          ))}
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
      <p className="mb-4 text-[12px] text-[var(--color-neutral-400)]">
        {subtitle}
      </p>
      <div className="min-w-0">
        <div className={`flex h-[132px] min-w-0 items-end ${grainGap}`}>
          {points.map((d) => {
            const prev = d.prevCustomers ?? 0;
            const currentH =
              d.customers === 0
                ? 3
                : Math.max(dense ? 4 : 8, Math.round((d.customers / max) * 120));
            const prevH =
              prev === 0 ? 3 : Math.max(dense ? 4 : 8, Math.round((prev / max) * 120));
            const range =
              d.from === d.to
                ? formatDaySlash(d.from)
                : `${formatDaySlash(d.from)}–${formatDaySlash(d.to)}`;
            const detail = [
              `${d.customers} visitas`,
              `anterior ${prev}`,
              d.stamps > 0 ? `${d.stamps} carimbos` : null,
              d.points > 0 ? `${d.points} pontos` : null,
              d.redeems > 0 ? `${d.redeems} resgates` : null,
            ]
              .filter(Boolean)
              .join(' · ');
            return (
              <div
                key={d.key}
                className="flex h-full min-w-0 flex-1 items-end justify-center"
                title={`${range}: ${detail}`}
              >
                <div
                  className={`flex h-[120px] w-full items-end justify-center gap-0.5 ${
                    dense ? '' : 'max-w-[36px]'
                  }`}
                >
                  <div
                    className="w-1/2 rounded-[3px]"
                    style={{
                      height: prevH,
                      background:
                        prev === 0
                          ? 'var(--color-neutral-100)'
                          : 'var(--color-neutral-200)',
                    }}
                  />
                  <div
                    className="w-1/2 rounded-[3px]"
                    style={{
                      height: currentH,
                      background:
                        d.customers === 0
                          ? 'var(--color-neutral-100)'
                          : 'var(--color-primary-500)',
                    }}
                  />
                </div>
              </div>
            );
          })}
        </div>
        {sparseAxis ? (
          <div className="mt-2 flex min-h-5 items-end justify-between gap-2 text-[11px] leading-none text-[var(--color-neutral-400)]">
            <span className="shrink-0">{points[0]?.label}</span>
            <span className="shrink-0">
              {points[Math.floor((points.length - 1) / 2)]?.label}
            </span>
            <span className="shrink-0">{points[points.length - 1]?.label}</span>
          </div>
        ) : (
          <div className={`mt-2 flex min-h-5 min-w-0 items-end ${grainGap}`}>
            {points.map((d) => (
              <span
                key={d.key}
                className="min-w-0 flex-1 truncate text-center text-[11px] leading-none text-[var(--color-neutral-400)]"
              >
                {d.label}
              </span>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function CohortChart({ cohorts }: { cohorts: ReportsData['cohorts'] }) {
  const maxRate = Math.max(1, ...cohorts.map((c) => c.rate));
  return (
    <div className="min-w-0 overflow-hidden rounded-[14px] border border-[var(--color-hairline)] bg-[var(--color-card)] p-5 shadow-[var(--shadow-card)]">
      <div className="mb-1 text-[15px] font-semibold text-[var(--color-ink)]">
        Retenção por mês de cadastro
      </div>
      <p className="mb-4 text-[12px] text-[var(--color-neutral-400)]">
        Porcentagem dos clientes cadastrados em cada mês que voltaram no período
      </p>
      <div className="flex h-[168px] items-end gap-3">
        {cohorts.map((c) => {
          const h =
            c.size === 0 ? 8 : Math.max(12, Math.round((c.rate / maxRate) * 148));
          return (
            <div
              key={c.month}
              className="flex h-full min-w-0 flex-1 flex-col items-center justify-end gap-2"
              title={`${c.label}: ${c.retained}/${c.size} (${c.rate}%)`}
            >
              <span className="text-[11px] font-semibold text-[var(--color-neutral-500)]">
                {c.size === 0 ? '—' : `${c.rate}%`}
              </span>
              <div
                className="w-full max-w-[38px] rounded-[6px] bg-[var(--color-primary-500)]"
                style={{ height: h, opacity: c.size === 0 ? 0.25 : 1 }}
              />
            </div>
          );
        })}
      </div>
      <div className="mt-2 flex gap-3">
        {cohorts.map((c) => (
          <span
            key={c.month}
            className="min-w-0 flex-1 text-center text-[11px] text-[var(--color-neutral-400)]"
          >
            {c.label}
          </span>
        ))}
      </div>
    </div>
  );
}

function csvEscape(value: string | number) {
  const s = String(value);
  if (/[",\n;]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

function downloadCsv(data: ReportsData) {
  const lines: string[] = [];
  lines.push('Relatórios Frego');
  lines.push(`Período;${data.range};${data.from};${data.to}`);
  lines.push('');
  lines.push('Indicador;Valor;Variação % vs período anterior');
  lines.push(
    `Clientes ativos;${data.kpis.activeCustomers.value};${data.kpis.activeCustomers.deltaPct ?? ''}`,
  );
  lines.push(
    `Novos clientes;${data.kpis.newCustomers?.value ?? ''};${data.kpis.newCustomers?.deltaPct ?? ''}`,
  );
  lines.push(
    `Visitas/cliente;${data.kpis.avgVisits.value};${data.kpis.avgVisits.deltaPct ?? ''}`,
  );
  lines.push(
    `Resgates;${data.kpis.redeems.value};${data.kpis.redeems.deltaPct ?? ''}`,
  );
  lines.push(
    `Carimbos;${data.kpis.stamps.value};${data.kpis.stamps.deltaPct ?? ''}`,
  );
  lines.push(`Pontos;${data.kpis.points.value};${data.kpis.points.deltaPct ?? ''}`);
  lines.push(
    `Gasto registrado (centavos);${data.kpis.revenueCents.value};${data.kpis.revenueCents.deltaPct ?? ''}`,
  );
  lines.push(
    `Cashback gerado (centavos);${data.kpis.cashbackEarnedCents?.value ?? ''};${data.kpis.cashbackEarnedCents?.deltaPct ?? ''}`,
  );
  lines.push(
    `Cashback usado (centavos);${data.kpis.cashbackSpentCents?.value ?? ''};${data.kpis.cashbackSpentCents?.deltaPct ?? ''}`,
  );
  lines.push(
    `Taxa de retorno (%);${data.kpis.repeatRate.value};${data.kpis.repeatRate.deltaPct ?? ''}`,
  );
  lines.push(`Base total;${data.kpis.base}`);
  lines.push('');
  lines.push('Data;Carimbos;Pontos;Resgates;Clientes;Clientes período anterior');
  for (const row of data.series) {
    lines.push(
      [row.date, row.stamps, row.points, row.redeems, row.customers, row.prevCustomers ?? '']
        .map(csvEscape)
        .join(';'),
    );
  }
  lines.push('');
  lines.push('Unidade;Visitas;Variação %;Carimbos;Pontos;Resgates');
  for (const loc of data.locations) {
    lines.push(
      [loc.name, loc.visits, loc.deltaPct ?? '', loc.stamps, loc.points, loc.redeems]
        .map(csvEscape)
        .join(';'),
    );
  }
  lines.push('');
  lines.push('Colaborador;Carimbos;Pontos;Vendas;Resgates;Variação %');
  for (const m of data.team) {
    lines.push(
      [m.displayName, m.stamps, m.points, m.sales ?? '', m.redeems, m.deltaPct ?? '']
        .map(csvEscape)
        .join(';'),
    );
  }
  lines.push('');
  lines.push('Campanha;Tipo;Resgates;Variação %;Quem resgatou;Elegíveis;Engajamento %;Confirmados %;Receita no resgate;Com valor;Usados');
  for (const c of data.campaigns) {
    lines.push(
      [
        c.name,
        c.type,
        c.redeems,
        c.redeemsDeltaPct ?? '',
        c.redeemers,
        c.eligible,
        c.engagePct,
        c.fulfillPct,
        c.revenueFromRedeemersCents,
        c.revenueCoverage?.withAmount ?? '',
        c.revenueCoverage?.used ?? '',
      ]
        .map(csvEscape)
        .join(';'),
    );
  }

  const blob = new Blob([lines.join('\n')], {
    type: 'text/csv;charset=utf-8;',
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  const fromDay = data.from.slice(0, 10);
  const toDay = data.to.slice(0, 10);
  a.download =
    data.range === 'custom'
      ? `frego-relatorios-${fromDay}_${toDay}.csv`
      : `frego-relatorios-${data.range}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

export default function ReportsPage() {
  const { getToken, user, loading: authLoading } = useAuth();
  const { business } = useBusiness();
  const kinds = business?.activeEarnKinds;
  const [period, setPeriod] = useState<PeriodValue>({
    mode: 'preset',
    key: '30d',
  });
  const [data, setData] = useState<ReportsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    setError(null);
    try {
      const token = await getToken();
      if (!token) throw new Error('Sessão expirada.');
      const res = await fetch(
        `${API_URL}/reports?${periodSearchParams(period)}`,
        {
          headers: { Authorization: `Bearer ${token}` },
        },
      );
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(
          (body as { message?: string }).message ??
            `Não foi possível carregar (${res.status})`,
        );
      }
      setData((await res.json()) as ReportsData);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Não foi possível carregar.');
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [getToken, period, user]);

  useEffect(() => {
    if (!authLoading && user) void load();
  }, [authLoading, user, load]);

  const kpis = data?.kpis;

  return (
    <AppShell
      title="Relatórios"
      topbar={
        <header className="flex min-h-[60px] flex-wrap items-center gap-3 border-b border-[var(--color-hairline)] bg-[var(--color-card)]/90 px-4 py-2 backdrop-blur md:px-7">
          <h1 className="text-[17px] font-semibold text-[var(--color-ink)]">
            Relatórios
          </h1>
          <div className="ml-auto flex flex-wrap items-center justify-end gap-2">
            <PeriodPicker
              presets={RANGES}
              value={period}
              onChange={setPeriod}
              compact
            />
            <button
              type="button"
              disabled={!data}
              onClick={() => data && downloadCsv(data)}
              className="inline-flex min-h-9 items-center gap-1.5 rounded-[10px] border border-[var(--color-neutral-200)] bg-[var(--color-card)] px-3 text-[13px] font-semibold text-[var(--color-ink)] disabled:opacity-50"
            >
              <Download size={14} strokeWidth={2.25} aria-hidden />
              Exportar CSV
            </button>
          </div>
        </header>
      }
    >
      <div className="mx-auto min-w-0 max-w-6xl px-4 py-6 md:px-7 md:py-7">
        <div className="mb-4 md:hidden">
          <PeriodPicker
            presets={RANGES}
            value={period}
            onChange={setPeriod}
            compact
          />
        </div>
        {loading || authLoading ? (
          <p className="text-[15px] text-[var(--color-neutral-500)]">
            Carregando…
          </p>
        ) : error ? (
          <div className="rounded-[14px] border border-[var(--color-hairline)] bg-[var(--color-card)] p-6">
            <p className="text-[15px] text-[var(--color-danger)]">{error}</p>
            <button
              type="button"
              onClick={() => void load()}
              className="mt-3 text-[14px] font-semibold text-[var(--color-primary-500)]"
            >
              Tentar novamente
            </button>
          </div>
        ) : !data || !kpis ? null : (
          <div className="flex flex-col gap-4">
            {data.range === 'today' && (
              <p className="text-[13px] text-[var(--color-neutral-500)]">
                Hoje, até agora, contra o mesmo dia da semana passada.
              </p>
            )}
            <div className="grid grid-cols-2 gap-3 lg:grid-cols-4 lg:gap-4">
              <KpiCard
                label="Clientes ativos"
                value={formatCount(kpis.activeCustomers.value)}
                hint={`${kpis.activeCustomers.ofBasePct ?? 0}% dos cadastrados`}
                deltaPct={kpis.activeCustomers.deltaPct ?? null}
                previous={formatCount(kpis.activeCustomers.previous ?? 0)}
              />
              <KpiCard
                label="Novos clientes"
                value={formatCount(kpis.newCustomers?.value ?? 0)}
                deltaPct={kpis.newCustomers?.deltaPct ?? null}
                previous={formatCount(kpis.newCustomers?.previous ?? 0)}
              />
              <KpiCard
                label={
                  <TermInfo info={TERM.taxaRetorno}>Taxa de retorno</TermInfo>
                }
                value={`${kpis.repeatRate.value}%`}
                hint="vieram duas vezes ou mais"
                deltaPct={kpis.repeatRate.deltaPct ?? null}
                previous={`${kpis.repeatRate.previous ?? 0}%`}
              />
              <KpiCard
                label="Visitas / cliente"
                value={formatAvg(kpis.avgVisits.value)}
                hint="média no período"
                deltaPct={kpis.avgVisits.deltaPct ?? null}
                previous={formatAvg(kpis.avgVisits.previous ?? 0)}
              />
            </div>

            <div className="grid grid-cols-2 gap-3 lg:grid-cols-4 lg:gap-4">
              <KpiCard
                label={<TermInfo info={TERM.resgates}>Resgates</TermInfo>}
                value={formatCount(kpis.redeems.value)}
                hint="prêmios no app"
                deltaPct={kpis.redeems.deltaPct ?? null}
                previous={formatCount(kpis.redeems.previous ?? 0)}
              />
              {(kinds == null || kinds.includes('stamps')) && (
                <KpiCard
                  label="Carimbos"
                  value={formatCount(kpis.stamps.value)}
                  deltaPct={kpis.stamps.deltaPct ?? null}
                  previous={formatCount(kpis.stamps.previous ?? 0)}
                />
              )}
              {(kinds == null || kinds.includes('points')) && (
                <KpiCard
                  label="Pontos"
                  value={formatCount(kpis.points.value)}
                  deltaPct={kpis.points.deltaPct ?? null}
                  previous={formatCount(kpis.points.previous ?? 0)}
                />
              )}
              {(kinds == null || kinds.includes('points')) && (
                <KpiCard
                  label="Gasto registrado"
                  value={formatMoney(kpis.revenueCents.value)}
                  hint="via pontos no balcão"
                  deltaPct={kpis.revenueCents.deltaPct ?? null}
                  previous={formatMoney(kpis.revenueCents.previous ?? 0)}
                />
              )}
              {(kinds == null || kinds.includes('cashback')) && (
                <KpiCard
                  label="Cashback gerado"
                  value={formatMoney(kpis.cashbackEarnedCents?.value ?? 0)}
                  deltaPct={kpis.cashbackEarnedCents?.deltaPct ?? null}
                  previous={formatMoney(kpis.cashbackEarnedCents?.previous ?? 0)}
                />
              )}
              {(kinds == null || kinds.includes('cashback')) && (
                <KpiCard
                  label="Cashback usado"
                  value={formatMoney(kpis.cashbackSpentCents?.value ?? 0)}
                  hint="no caixa"
                  deltaPct={kpis.cashbackSpentCents?.deltaPct ?? null}
                  previous={formatMoney(kpis.cashbackSpentCents?.previous ?? 0)}
                />
              )}
            </div>

            <div className="grid min-w-0 items-start gap-4 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
              <ActivityChart
                series={data.series}
                deltaPct={data.seriesDeltaPct ?? null}
                sameWeekday={data.range === 'today'}
              />
              <CohortChart cohorts={data.cohorts} />
            </div>

            <div className="grid gap-4 lg:grid-cols-2">
              <div className="rounded-[14px] border border-[var(--color-hairline)] bg-[var(--color-card)] p-5 shadow-[var(--shadow-card)]">
                <div className="mb-4 text-[15px] font-semibold text-[var(--color-ink)]">
                  Ranking de unidades
                </div>
                {data.locations.length === 0 ? (
                  <p className="text-[13px] text-[var(--color-neutral-500)]">
                    Nenhuma unidade cadastrada.
                  </p>
                ) : (
                  <ul className="flex flex-col gap-3.5">
                    {data.locations.map((loc, i) => (
                      <li key={loc.id} className="flex items-center gap-3">
                        <span
                          className={`w-5 font-mono text-[13px] font-bold ${
                            i === 0
                              ? 'text-[var(--color-primary-500)]'
                              : 'text-[var(--color-neutral-400)]'
                          }`}
                        >
                          {i + 1}
                        </span>
                        <div className="min-w-0 flex-1">
                          <div className="truncate text-[13px] font-medium text-[var(--color-ink)]">
                            {loc.name}
                          </div>
                          <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-[var(--color-neutral-100)]">
                            <div
                              className="h-full rounded-full bg-[var(--color-primary-500)]"
                              style={{ width: `${loc.sharePct}%` }}
                            />
                          </div>
                        </div>
                        <span className="flex shrink-0 flex-wrap items-center justify-end gap-x-1.5 text-[12px] text-[var(--color-neutral-500)]">
                          {loc.visits.toLocaleString('pt-BR')} visitas
                          <Delta value={loc.deltaPct ?? null} />
                          <span className="font-medium">
                            · antes {formatCount(loc.previous ?? 0)}
                          </span>
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              <div className="rounded-[14px] border border-[var(--color-hairline)] bg-[var(--color-card)] p-5 shadow-[var(--shadow-card)]">
                <div className="mb-4 text-[15px] font-semibold text-[var(--color-ink)]">
                  Ranking da equipe
                </div>
                {data.team.length === 0 ? (
                  <p className="text-[13px] text-[var(--color-neutral-500)]">
                    Sem atividade de colaboradores no período.
                  </p>
                ) : (
                  <ul className="flex flex-col gap-3">
                    {data.team.map((m, i) => (
                      <li key={m.id} className="flex items-center gap-3">
                        <span
                          className={`flex h-7 w-7 items-center justify-center rounded-full text-[11px] font-semibold ${
                            i === 0
                              ? 'bg-[var(--color-ink)] text-white'
                              : 'bg-[var(--color-primary-50)] text-[var(--color-primary-500)]'
                          }`}
                        >
                          {m.initials}
                        </span>
                        <div className="min-w-0 flex-1 truncate text-[13px] font-medium text-[var(--color-ink)]">
                          {m.displayName}
                        </div>
                        <span className="flex shrink-0 flex-wrap items-center justify-end gap-x-1.5 text-[12px] text-[var(--color-neutral-500)]">
                          {teamActivityLabel(m, kinds)}
                          <Delta value={m.deltaPct ?? null} />
                          <span className="font-medium">
                            · antes {formatCount(m.previous ?? 0)}
                          </span>
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>

            {data.campaigns.length > 1 && (
              <CampaignCompareChart
                campaigns={data.campaigns.map((c) => ({
                  id: c.id,
                  name: c.name,
                  type: c.type,
                  redeems: c.redeems,
                  redeemers: c.redeemers,
                  revenueCents: c.revenueFromRedeemersCents,
                }))}
                hrefFor={(id) => `/campaigns?highlight=${id}`}
                periodHint="Resgates, pessoas e retorno no recorte deste relatório."
              />
            )}

            <div className="rounded-[14px] border border-[var(--color-hairline)] bg-[var(--color-card)] p-5 shadow-[var(--shadow-card)]">
              <div className="mb-4 flex items-center justify-between gap-3">
                <div className="text-[15px] font-semibold text-[var(--color-ink)]">
                  Desempenho das campanhas
                </div>
                <Link
                  href="/campaigns"
                  className="text-[13px] font-semibold text-[var(--color-primary-500)]"
                >
                  Ver todas →
                </Link>
              </div>
              {data.campaigns.length === 0 ? (
                <p className="text-[13px] text-[var(--color-neutral-500)]">
                  Nenhuma atividade de campanha no período.
                </p>
              ) : (
                <div className="flex flex-col gap-0">
                  <div className="mb-1 hidden grid-cols-[minmax(0,2fr)_0.9fr_0.8fr_0.9fr_1.1fr] gap-3 text-[12px] font-medium text-[var(--color-neutral-400)] lg:grid">
                    <span>Campanha</span>
                    <span>
                      <TermInfo info={TERM.resgates}>Resgates</TermInfo>
                    </span>
                    <span>
                      <TermInfo info={TERM.engajamento}>Engajamento</TermInfo>
                    </span>
                    <span>
                      <TermInfo info={TERM.confirmados}>Confirmados</TermInfo>
                    </span>
                    <span>
                      <TermInfo info={TERM.retorno} align="end">
                        Receita no resgate
                      </TermInfo>
                    </span>
                  </div>
                  {data.campaigns.map((c) => (
                    <div
                      key={c.id}
                      className="grid grid-cols-2 gap-x-3 gap-y-2.5 border-t border-[var(--color-hairline)] py-3.5 first:border-0 first:pt-0 lg:grid-cols-[minmax(0,2fr)_0.9fr_0.8fr_0.9fr_1.1fr] lg:items-center lg:gap-3 lg:py-3"
                    >
                      <div className="col-span-2 min-w-0 lg:col-span-1">
                        <Link
                          href={`/campaigns?highlight=${c.id}`}
                          className="truncate text-[14px] font-semibold text-[var(--color-ink)] hover:text-[var(--color-primary-500)] lg:text-[13px] lg:font-medium"
                        >
                          {c.name}
                        </Link>
                        <div className="text-[12px] text-[var(--color-neutral-400)] lg:text-[11px]">
                          {TYPE_LABEL[c.type] ?? c.type}
                          {c.audienceName ? ` · ${c.audienceName}` : ''}
                          {c.rewardTitle ? ` · ${c.rewardTitle}` : ''}
                        </div>
                      </div>
                      <CampaignMetric
                        label="Resgates"
                        info={TERM.resgates}
                        value={
                          <span className="inline-flex flex-wrap items-baseline gap-x-1.5">
                            {c.redeems.toLocaleString('pt-BR')}
                            <Delta value={c.redeemsDeltaPct ?? null} />
                            <span className="text-[12px] font-medium text-[var(--color-neutral-500)]">
                              · antes {formatCount(c.previousRedeems ?? 0)}
                            </span>
                          </span>
                        }
                        hint={peopleHint(c.redeemers, c.eligible)}
                      />
                      <CampaignMetric
                        label="Engajamento"
                        info={TERM.engajamento}
                        value={
                          <span
                            className={`font-semibold ${
                              c.engagePct >= 20
                                ? 'text-[var(--color-success)]'
                                : 'text-[var(--color-neutral-500)]'
                            }`}
                          >
                            {c.engagePct}%
                          </span>
                        }
                      />
                      <CampaignMetric
                        label="Confirmados"
                        info={TERM.confirmados}
                        value={
                          <span
                            className={`font-semibold ${
                              c.type !== 'cashback' && c.fulfillPct >= 70
                                ? 'text-[var(--color-success)]'
                                : 'text-[var(--color-neutral-500)]'
                            }`}
                          >
                            {c.type === 'cashback'
                              ? 'No caixa'
                              : `${c.fulfillPct}%`}
                          </span>
                        }
                      />
                      <CampaignMetric
                        label="Receita no resgate"
                        info={TERM.retorno}
                        value={formatMoney(c.revenueFromRedeemersCents)}
                        hint={formatCoverage(c.revenueCoverage)}
                      />
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </AppShell>
  );
}
