'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { Download } from 'lucide-react';
import { AppShell } from '@/components/app-shell';
import {
  AudiencePresetCards,
  campaignCreateHref,
  audienceRulesQuery,
} from '@/components/audience-preset-cards';
import { useAuth } from '@/lib/auth-context';
import { API_URL } from '@/lib/api';
import {
  PeriodPicker,
  periodSearchParams,
  type PeriodValue,
} from '@/components/period-picker';

type RangeKey = '7d' | '30d' | '90d' | 'custom';

type KpiNum = { value: number; deltaPct?: number | null; ofBasePct?: number; delta?: number };

type ReportsData = {
  range: RangeKey;
  from: string;
  to: string;
  kpis: {
    activeCustomers: KpiNum;
    inactive: KpiNum;
    avgVisits: KpiNum;
    redeems: KpiNum;
    stamps: KpiNum;
    points: KpiNum;
    revenueCents: KpiNum;
    repeatRate: KpiNum;
    base: number;
  };
  series: Array<{
    date: string;
    label: string;
    stamps: number;
    points: number;
    redeems: number;
    customers: number;
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
  }>;
  team: Array<{
    id: string;
    displayName: string;
    initials: string;
    stamps: number;
    points: number;
    redeems: number;
    activity: number;
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
    redeemers: number;
    eligible: number;
    engagePct: number;
    fulfillPct: number;
    openVouchers: number;
    usedVouchers: number;
    expiredVouchers: number;
    revenueFromRedeemersCents: number;
  }>;
  audiences?: {
    presets: Array<{
      key: string;
      name: string;
      description: string;
      rules: Record<string, unknown>;
      memberCount: number;
    }>;
    spendTiers: Array<{
      key: string;
      label: string;
      min: number;
      max: number | null;
      count: number;
    }>;
    saved: Array<{
      id: string;
      name: string;
      memberCount: number;
    }>;
    insight: {
      title: string;
      body: string;
      memberCount: number;
      rules: Record<string, unknown>;
    } | null;
  };
};

type AudienceRulesForm = {
  name: string;
  spendCentsMin: string;
  spendCentsMax: string;
  windowDays: string;
  inactiveDaysMin: string;
  showBadge: boolean;
  badgeTitle: string;
  badgeMessage: string;
};

const RANGES: { key: RangeKey; label: string }[] = [
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
};

function formatMoney(cents: number) {
  return (cents / 100).toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  });
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
}: {
  label: string;
  value: string | number;
  hint?: string;
  deltaPct?: number | null;
}) {
  return (
    <div className="rounded-[14px] border border-[var(--color-hairline)] bg-[var(--color-card)] p-[18px] shadow-[var(--shadow-card)]">
      <div className="text-[13px] font-medium text-[var(--color-neutral-500)]">
        {label}
      </div>
      <div className="mt-1.5 text-[28px] font-semibold tracking-[-0.02em] text-[var(--color-ink)]">
        {value}
      </div>
      <div className="mt-1 flex flex-wrap items-center gap-2">
        {deltaPct !== undefined && <Delta value={deltaPct} />}
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
      existing.to = d.date;
    } else {
      buckets.set(key, {
        key,
        stamps: d.stamps,
        points: d.points,
        redeems: d.redeems,
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

function ActivityChart({ series }: { series: SeriesRow[] }) {
  const auto = suggestedGrain(series.length);
  const [grain, setGrain] = useState<ChartGrain>(auto);

  useEffect(() => {
    setGrain(auto);
  }, [auto]);

  const points = useMemo(
    () => aggregateSeries(series, grain),
    [series, grain],
  );
  const max = useMemo(
    () => Math.max(1, ...points.map((d) => d.stamps + d.points + d.redeems)),
    [points],
  );

  const dense = grain === 'day' && points.length > 40;
  const sparseAxis = points.length > 8;
  const grainGap =
    grain === 'month' ? 'gap-3' : grain === 'week' ? 'gap-2' : 'gap-px';
  const subtitle =
    grain === 'month'
      ? 'Carimbos, pontos e resgates por mês'
      : grain === 'week'
        ? 'Carimbos, pontos e resgates por semana'
        : 'Carimbos, pontos e resgates por dia';

  return (
    <div className="min-w-0 overflow-x-hidden rounded-[14px] border border-[var(--color-hairline)] bg-[var(--color-card)] p-5 shadow-[var(--shadow-card)]">
      <div className="mb-1 flex flex-wrap items-start justify-between gap-3">
        <div className="text-[15px] font-semibold text-[var(--color-ink)]">
          Atividade no período
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
      </div>
      <p className="mb-4 text-[12px] text-[var(--color-neutral-400)]">
        {subtitle}
      </p>
      <div className="min-w-0">
        <div className={`flex h-[132px] min-w-0 items-end ${grainGap}`}>
          {points.map((d) => {
            const total = d.stamps + d.points + d.redeems;
            const h =
              total === 0
                ? 0
                : Math.max(dense ? 4 : 8, Math.round((total / max) * 124));
            const range =
              d.from === d.to
                ? d.from
                : `${formatDaySlash(d.from)}–${formatDaySlash(d.to)}`;
            return (
              <div
                key={d.key}
                className="flex h-full min-w-0 flex-1 items-end justify-center"
                title={`${range}: ${d.stamps} carimbos · ${d.points} pontos · ${d.redeems} resgates`}
              >
                <div
                  className={`w-full min-w-0 rounded-[3px] bg-[var(--color-primary-500)] ${
                    dense ? '' : 'max-w-[36px] rounded-[5px]'
                  }`}
                  style={{ height: h }}
                />
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
  lines.push('Indicador;Valor');
  lines.push(`Clientes ativos;${data.kpis.activeCustomers.value}`);
  lines.push(`Inativos 30d+;${data.kpis.inactive.value}`);
  lines.push(`Média visitas/cliente;${data.kpis.avgVisits.value}`);
  lines.push(`Resgates;${data.kpis.redeems.value}`);
  lines.push(`Carimbos;${data.kpis.stamps.value}`);
  lines.push(`Pontos;${data.kpis.points.value}`);
  lines.push(`Receita fidelidade (centavos);${data.kpis.revenueCents.value}`);
  lines.push(`Taxa de retorno (%);${data.kpis.repeatRate.value}`);
  lines.push(`Base total;${data.kpis.base}`);
  lines.push('');
  lines.push('Data;Carimbos;Pontos;Resgates;Clientes');
  for (const row of data.series) {
    lines.push(
      [row.date, row.stamps, row.points, row.redeems, row.customers]
        .map(csvEscape)
        .join(';'),
    );
  }
  lines.push('');
  lines.push('Unidade;Visitas;Carimbos;Pontos;Resgates');
  for (const loc of data.locations) {
    lines.push(
      [loc.name, loc.visits, loc.stamps, loc.points, loc.redeems]
        .map(csvEscape)
        .join(';'),
    );
  }
  lines.push('');
  lines.push('Colaborador;Carimbos;Pontos;Resgates');
  for (const m of data.team) {
    lines.push(
      [m.displayName, m.stamps, m.points, m.redeems].map(csvEscape).join(';'),
    );
  }
  lines.push('');
  lines.push('Campanha;Tipo;Resgates;Quem resgatou;Elegíveis;Engajamento %;Conclusão %;Receita de quem resgatou');
  for (const c of data.campaigns) {
    lines.push(
      [
        c.name,
        c.type,
        c.redeems,
        c.redeemers,
        c.eligible,
        c.engagePct,
        c.fulfillPct,
        c.revenueFromRedeemersCents,
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
  const [period, setPeriod] = useState<PeriodValue>({
    mode: 'preset',
    key: '30d',
  });
  const [data, setData] = useState<ReportsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [builder, setBuilder] = useState<AudienceRulesForm>({
    name: '',
    spendCentsMin: '200',
    spendCentsMax: '',
    windowDays: '90',
    inactiveDaysMin: '',
    showBadge: true,
    badgeTitle: 'Cliente da casa',
    badgeMessage:
      'A loja reconhece você — desbloqueamos condições especiais para quem volta e faz parte da casa.',
  });
  const [builderBusy, setBuilderBusy] = useState(false);
  const [builderMsg, setBuilderMsg] = useState<string | null>(null);
  const [previewCount, setPreviewCount] = useState<number | null>(null);

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

  const builderRules = useMemo(() => {
    const spendMin = Number.parseFloat(builder.spendCentsMin);
    const spendMax = Number.parseFloat(builder.spendCentsMax);
    const windowDays = Number.parseInt(builder.windowDays, 10);
    const inactive = Number.parseInt(builder.inactiveDaysMin, 10);
    return {
      version: 1 as const,
      spendCentsMin: Number.isFinite(spendMin)
        ? Math.round(spendMin * 100)
        : null,
      spendCentsMax: Number.isFinite(spendMax)
        ? Math.round(spendMax * 100)
        : null,
      windowDays: Number.isFinite(windowDays) ? windowDays : null,
      inactiveDaysMin: Number.isFinite(inactive) ? inactive : null,
    };
  }, [builder]);

  async function previewAudience() {
    setBuilderBusy(true);
    setBuilderMsg(null);
    try {
      const token = await getToken();
      if (!token) throw new Error('Sessão expirada.');
      const res = await fetch(`${API_URL}/audiences/preview`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ rules: builderRules }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? 'Não foi possível estimar.');
      setPreviewCount(json.memberCount as number);
    } catch (e) {
      setBuilderMsg(e instanceof Error ? e.message : 'Não foi possível estimar.');
    } finally {
      setBuilderBusy(false);
    }
  }

  async function saveAudience() {
    if (!builder.name.trim()) {
      setBuilderMsg('Informe um nome para a audiência.');
      return;
    }
    setBuilderBusy(true);
    setBuilderMsg(null);
    try {
      const token = await getToken();
      if (!token) throw new Error('Sessão expirada.');
      const res = await fetch(`${API_URL}/audiences`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: builder.name.trim(),
          rules: builderRules,
          showBadge: builder.showBadge,
          badgeTitle: builder.showBadge
            ? builder.badgeTitle.trim() || builder.name.trim()
            : null,
          badgeMessage: builder.showBadge
            ? builder.badgeMessage.trim() || null
            : null,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? 'Não foi possível salvar.');
      setBuilderMsg(
        `Audiência salva · ${json.audience?.memberCount ?? 0} clientes`,
      );
      setBuilder((b) => ({ ...b, name: '' }));
      await load();
    } catch (e) {
      setBuilderMsg(e instanceof Error ? e.message : 'Não foi possível salvar.');
    } finally {
      setBuilderBusy(false);
    }
  }

  const kpis = data?.kpis;
  const audiences = data?.audiences;

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
            <div className="grid grid-cols-2 gap-3 lg:grid-cols-4 lg:gap-4">
              <KpiCard
                label="Clientes ativos"
                value={kpis.activeCustomers.value.toLocaleString('pt-BR')}
                hint={`${kpis.activeCustomers.ofBasePct ?? 0}% dos cadastrados`}
                deltaPct={kpis.activeCustomers.deltaPct}
              />
              <KpiCard
                label="Inativos (30 dias ou mais)"
                value={kpis.inactive.value.toLocaleString('pt-BR')}
                hint={
                  kpis.inactive.value > 0
                    ? 'prontos para uma campanha de volta'
                    : 'todos ativos recentemente'
                }
              />
              <KpiCard
                label="Média de visitas por cliente"
                value={kpis.avgVisits.value.toLocaleString('pt-BR', {
                  minimumFractionDigits: 0,
                  maximumFractionDigits: 1,
                })}
                hint={
                  kpis.avgVisits.delta != null && kpis.avgVisits.delta !== 0
                    ? `${kpis.avgVisits.delta > 0 ? '▲' : '▼'} ${Math.abs(kpis.avgVisits.delta)}`
                    : undefined
                }
                deltaPct={undefined}
              />
              <KpiCard
                label="Resgates"
                value={kpis.redeems.value.toLocaleString('pt-BR')}
                deltaPct={kpis.redeems.deltaPct}
              />
            </div>

            <div className="grid grid-cols-2 gap-3 lg:grid-cols-4 lg:gap-4">
              <KpiCard
                label="Carimbos"
                value={kpis.stamps.value.toLocaleString('pt-BR')}
                deltaPct={kpis.stamps.deltaPct}
              />
              <KpiCard
                label="Pontos"
                value={kpis.points.value.toLocaleString('pt-BR')}
                deltaPct={kpis.points.deltaPct}
              />
              <KpiCard
                label="Gasto no programa"
                value={formatMoney(kpis.revenueCents.value)}
                deltaPct={kpis.revenueCents.deltaPct}
              />
              <KpiCard
                label="Taxa de retorno"
                value={`${kpis.repeatRate.value}%`}
                deltaPct={kpis.repeatRate.deltaPct}
              />
            </div>

            <div className="grid min-w-0 items-start gap-4 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
              <ActivityChart series={data.series} />
              <CohortChart cohorts={data.cohorts} />
            </div>

            <div
              id="audiencias"
              className="rounded-[14px] border border-[var(--color-hairline)] bg-[var(--color-card)] p-5 shadow-[var(--shadow-card)]"
            >
              <div className="mb-1 text-[15px] font-semibold text-[var(--color-ink)]">
                Audiências
              </div>
              <p className="mb-4 text-[12px] text-[var(--color-neutral-400)]">
                Agrupe por gasto e comportamento — depois crie campanhas só
                para esses clientes.
              </p>

              {audiences?.insight && (
                <div className="mb-4 rounded-[12px] border border-[var(--color-primary-200)] bg-[var(--color-primary-50)] px-4 py-3">
                  <p className="text-[14px] font-semibold text-[var(--color-ink)]">
                    {audiences.insight.title}
                  </p>
                  <p className="mt-1 text-[13px] text-[var(--color-neutral-600)]">
                    {audiences.insight.body}
                  </p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <Link
                      href={`/customers?${audienceRulesQuery(audiences.insight.rules)}`}
                      className="text-[13px] font-semibold text-[var(--color-primary-600)]"
                    >
                      Ver clientes →
                    </Link>
                    <Link
                      href={campaignCreateHref(
                        audiences.insight.rules,
                        'Alto valor em risco',
                      )}
                      className="text-[13px] font-semibold text-[var(--color-primary-600)]"
                    >
                      Criar campanha →
                    </Link>
                  </div>
                </div>
              )}

              <div className="mb-5">
                <AudiencePresetCards presets={audiences?.presets ?? []} />
              </div>

              <div className="mb-5">
                <div className="mb-2 text-[13px] font-semibold text-[var(--color-ink)]">
                  Faixas de gasto (90 dias)
                </div>
                <div className="flex flex-col gap-2">
                  {(audiences?.spendTiers ?? []).map((t) => {
                    const max = Math.max(
                      1,
                      ...(audiences?.spendTiers ?? []).map((x) => x.count),
                    );
                    const pct = Math.round((t.count / max) * 100);
                    return (
                      <div key={t.key} className="flex items-center gap-3">
                        <span className="w-28 shrink-0 text-[12px] text-[var(--color-neutral-500)]">
                          {t.label}
                        </span>
                        <div className="h-1.5 min-w-0 flex-1 overflow-hidden rounded-full bg-[var(--color-neutral-100)]">
                          <div
                            className="h-full rounded-full bg-[var(--color-primary-500)]"
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                        <span className="w-8 text-right text-[12px] font-semibold tabular-nums text-[var(--color-ink)]">
                          {t.count}
                        </span>
                        <Link
                          href={`/customers?spendCentsMin=${t.min}${t.max != null ? `&spendCentsMax=${t.max - 1}` : ''}&windowDays=90`}
                          className="text-[11px] font-semibold text-[var(--color-primary-500)]"
                        >
                          Ver
                        </Link>
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className="rounded-[12px] border border-[var(--color-hairline)] bg-[var(--color-bg)] p-4">
                <div className="text-[13px] font-semibold text-[var(--color-ink)]">
                  Criar audiência por gasto
                </div>
                <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
                  <label className="text-[12px] font-medium text-[var(--color-neutral-500)]">
                    Nome
                    <input
                      value={builder.name}
                      onChange={(e) =>
                        setBuilder((b) => ({ ...b, name: e.target.value }))
                      }
                      placeholder="Ex.: clientes a partir de R$ 200"
                      className="mt-1 min-h-10 w-full rounded-[8px] border border-[var(--color-neutral-200)] bg-[var(--color-card)] px-2.5 text-[14px]"
                    />
                  </label>
                  <label className="text-[12px] font-medium text-[var(--color-neutral-500)]">
                    Gasto mínimo (R$)
                    <input
                      type="number"
                      min={0}
                      value={builder.spendCentsMin}
                      onChange={(e) =>
                        setBuilder((b) => ({
                          ...b,
                          spendCentsMin: e.target.value,
                        }))
                      }
                      className="mt-1 min-h-10 w-full rounded-[8px] border border-[var(--color-neutral-200)] bg-[var(--color-card)] px-2.5 text-[14px]"
                    />
                  </label>
                  <label className="text-[12px] font-medium text-[var(--color-neutral-500)]">
                    Gasto máximo (R$)
                    <input
                      type="number"
                      min={0}
                      value={builder.spendCentsMax}
                      onChange={(e) =>
                        setBuilder((b) => ({
                          ...b,
                          spendCentsMax: e.target.value,
                        }))
                      }
                      placeholder="opcional"
                      className="mt-1 min-h-10 w-full rounded-[8px] border border-[var(--color-neutral-200)] bg-[var(--color-card)] px-2.5 text-[14px]"
                    />
                  </label>
                  <label className="text-[12px] font-medium text-[var(--color-neutral-500)]">
                    Janela (dias)
                    <input
                      type="number"
                      min={1}
                      value={builder.windowDays}
                      onChange={(e) =>
                        setBuilder((b) => ({
                          ...b,
                          windowDays: e.target.value,
                        }))
                      }
                      className="mt-1 min-h-10 w-full rounded-[8px] border border-[var(--color-neutral-200)] bg-[var(--color-card)] px-2.5 text-[14px]"
                    />
                  </label>
                  <label className="text-[12px] font-medium text-[var(--color-neutral-500)]">
                    Inativo há (dias)
                    <input
                      type="number"
                      min={0}
                      value={builder.inactiveDaysMin}
                      onChange={(e) =>
                        setBuilder((b) => ({
                          ...b,
                          inactiveDaysMin: e.target.value,
                        }))
                      }
                      placeholder="opcional"
                      className="mt-1 min-h-10 w-full rounded-[8px] border border-[var(--color-neutral-200)] bg-[var(--color-card)] px-2.5 text-[14px]"
                    />
                  </label>
                </div>
                <div className="mt-3 rounded-[10px] border border-[var(--color-hairline)] bg-[var(--color-card)] p-3">
                  <label className="flex items-center gap-2 text-[13px] font-semibold text-[var(--color-ink)]">
                    <input
                      type="checkbox"
                      checked={builder.showBadge}
                      onChange={(e) =>
                        setBuilder((b) => ({
                          ...b,
                          showBadge: e.target.checked,
                        }))
                      }
                    />
                    Mostrar selo no app do cliente
                  </label>
                  <p className="mt-1 text-[12px] text-[var(--color-neutral-500)]">
                    Quem entra nesta audiência vê, no aplicativo, um selo da
                    loja e a mensagem de que desbloqueou promoções exclusivas.
                  </p>
                  {builder.showBadge && (
                    <div className="mt-3 grid gap-3 sm:grid-cols-2">
                      <label className="text-[12px] font-medium text-[var(--color-neutral-500)]">
                        Título do selo
                        <input
                          value={builder.badgeTitle}
                          onChange={(e) =>
                            setBuilder((b) => ({
                              ...b,
                              badgeTitle: e.target.value,
                            }))
                          }
                          placeholder="Cliente da casa"
                          className="mt-1 min-h-10 w-full rounded-[8px] border border-[var(--color-neutral-200)] px-2.5 text-[14px]"
                        />
                      </label>
                      <label className="text-[12px] font-medium text-[var(--color-neutral-500)]">
                        Mensagem
                        <input
                          value={builder.badgeMessage}
                          onChange={(e) =>
                            setBuilder((b) => ({
                              ...b,
                              badgeMessage: e.target.value,
                            }))
                          }
                          placeholder="Você desbloqueou condições exclusivas."
                          className="mt-1 min-h-10 w-full rounded-[8px] border border-[var(--color-neutral-200)] px-2.5 text-[14px]"
                        />
                      </label>
                    </div>
                  )}
                </div>
                <div className="mt-3 flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    disabled={builderBusy}
                    onClick={() => void previewAudience()}
                    className="min-h-9 rounded-[10px] border border-[var(--color-hairline)] bg-[var(--color-card)] px-3 text-[13px] font-semibold disabled:opacity-50"
                  >
                    Estimar
                  </button>
                  <button
                    type="button"
                    disabled={builderBusy}
                    onClick={() => void saveAudience()}
                    className="min-h-9 rounded-[10px] bg-[var(--color-primary-500)] px-3 text-[13px] font-semibold text-white disabled:opacity-50"
                  >
                    Salvar audiência
                  </button>
                  <Link
                    href={`/customers?${audienceRulesQuery(builderRules)}`}
                    className="text-[13px] font-semibold text-[var(--color-primary-500)]"
                  >
                    Ver clientes
                  </Link>
                  {previewCount != null && (
                    <span className="text-[13px] text-[var(--color-neutral-500)]">
                      ≈ {previewCount} clientes
                    </span>
                  )}
                  {builderMsg && (
                    <span className="text-[13px] text-[var(--color-neutral-600)]">
                      {builderMsg}
                    </span>
                  )}
                </div>
                {(audiences?.saved?.length ?? 0) > 0 && (
                  <div className="mt-4 border-t border-[var(--color-hairline)] pt-3">
                    <p className="mb-2 text-[12px] font-medium text-[var(--color-neutral-400)]">
                      Audiências salvas
                    </p>
                    <ul className="flex flex-col gap-1.5">
                      {audiences!.saved.map((s) => (
                        <li
                          key={s.id}
                          className="flex items-center justify-between gap-2 text-[13px]"
                        >
                          <span className="font-medium text-[var(--color-ink)]">
                            {s.name}
                          </span>
                          <span className="text-[var(--color-neutral-500)]">
                            {s.memberCount}
                          </span>
                          <Link
                            href={`/customers?audienceId=${s.id}`}
                            className="font-semibold text-[var(--color-primary-500)]"
                          >
                            Ver
                          </Link>
                          <Link
                            href={`/campaigns?audienceId=${s.id}&audienceName=${encodeURIComponent(s.name)}`}
                            className="font-semibold text-[var(--color-primary-500)]"
                          >
                            Campanha
                          </Link>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
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
                        <span className="shrink-0 text-[12px] text-[var(--color-neutral-500)]">
                          {loc.visits.toLocaleString('pt-BR')}
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
                        <span className="shrink-0 text-[12px] text-[var(--color-neutral-500)]">
                          {m.stamps > 0
                            ? `${m.stamps} carimbos`
                            : m.points > 0
                              ? `${m.points} pontos`
                              : `${m.redeems} resgates`}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>

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
                <div className="flex flex-col gap-3">
                  <div className="hidden grid-cols-[minmax(0,2fr)_0.8fr_0.8fr_0.9fr_0.9fr_1fr] gap-3 text-[12px] font-medium text-[var(--color-neutral-400)] lg:grid">
                    <span>Campanha</span>
                    <span>Resgates</span>
                    <span>Resgatadores</span>
                    <span>Engajamento</span>
                    <span>Entrega</span>
                    <span>Receita</span>
                  </div>
                  {data.campaigns.map((c) => (
                    <div
                      key={c.id}
                      className="grid grid-cols-1 gap-1.5 border-t border-[var(--color-hairline)] pt-3 first:border-0 first:pt-0 lg:grid-cols-[minmax(0,2fr)_0.8fr_0.8fr_0.9fr_0.9fr_1fr] lg:items-center lg:gap-3"
                    >
                      <div className="min-w-0">
                        <Link
                          href={`/campaigns?highlight=${c.id}`}
                          className="truncate text-[13px] font-medium text-[var(--color-ink)] hover:text-[var(--color-primary-500)]"
                        >
                          {c.name}
                        </Link>
                        <div className="text-[11px] text-[var(--color-neutral-400)]">
                          {TYPE_LABEL[c.type] ?? c.type}
                          {c.audienceName ? ` · ${c.audienceName}` : ''}
                          {c.rewardTitle ? ` · ${c.rewardTitle}` : ''}
                        </div>
                      </div>
                      <span className="text-[13px] text-[var(--color-neutral-500)]">
                        {c.redeems.toLocaleString('pt-BR')}
                      </span>
                      <span className="text-[13px] text-[var(--color-neutral-500)]">
                        {c.redeemers.toLocaleString('pt-BR')}
                        <span className="text-[11px] text-[var(--color-neutral-400)]">
                          {' '}
                          / {c.eligible}
                        </span>
                      </span>
                      <span
                        className={`text-[13px] font-semibold ${
                          c.engagePct >= 20
                            ? 'text-[var(--color-success)]'
                            : 'text-[var(--color-neutral-500)]'
                        }`}
                      >
                        {c.engagePct}%
                      </span>
                      <span
                        className={`text-[13px] font-semibold ${
                          c.type !== 'cashback' && c.fulfillPct >= 70
                            ? 'text-[var(--color-success)]'
                            : 'text-[var(--color-neutral-500)]'
                        }`}
                      >
                        {c.type === 'cashback'
                          ? '— no caixa'
                          : `${c.fulfillPct}% entrega`}
                      </span>
                      <span className="text-[13px] text-[var(--color-neutral-500)]">
                        {formatMoney(c.revenueFromRedeemersCents)}
                      </span>
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
