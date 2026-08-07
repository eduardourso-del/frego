'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { Download } from 'lucide-react';
import { AppShell } from '@/components/app-shell';
import { useAuth } from '@/lib/auth-context';
import { API_URL } from '@/lib/api';

type RangeKey = '7d' | '30d' | '90d';

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
    redeems: number;
    earners: number;
    redeemers: number;
    engagePct: number;
  }>;
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

function ActivityChart({ series }: { series: ReportsData['series'] }) {
  const max = useMemo(
    () => Math.max(1, ...series.map((d) => d.stamps + d.points + d.redeems)),
    [series],
  );
  // For 90d, sample every ~3 days for readability
  const points =
    series.length > 45
      ? series.filter((_, i) => i % 3 === 0 || i === series.length - 1)
      : series.length > 14
        ? series.filter((_, i) => i % 2 === 0 || i === series.length - 1)
        : series;

  return (
    <div className="rounded-[14px] border border-[var(--color-hairline)] bg-[var(--color-card)] p-5 shadow-[var(--shadow-card)]">
      <div className="mb-1 text-[15px] font-semibold text-[var(--color-ink)]">
        Atividade no período
      </div>
      <p className="mb-4 text-[12px] text-[var(--color-neutral-400)]">
        Carimbos, pontos e resgates por dia
      </p>
      <div className="flex h-[180px] items-end gap-1 sm:gap-1.5">
        {points.map((d) => {
          const total = d.stamps + d.points + d.redeems;
          const h = Math.max(4, Math.round((total / max) * 100));
          return (
            <div
              key={d.date}
              className="flex min-w-0 flex-1 flex-col items-center justify-end gap-1.5"
              title={`${d.date}: ${d.stamps} carimbos · ${d.points} pts · ${d.redeems} resgates`}
            >
              <div
                className="w-full max-w-[28px] rounded-[5px] bg-[var(--color-primary-500)]"
                style={{ height: `${h}%` }}
              />
              <span className="truncate text-[10px] text-[var(--color-neutral-400)]">
                {d.label}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function CohortChart({ cohorts }: { cohorts: ReportsData['cohorts'] }) {
  const maxRate = Math.max(1, ...cohorts.map((c) => c.rate));
  return (
    <div className="rounded-[14px] border border-[var(--color-hairline)] bg-[var(--color-card)] p-5 shadow-[var(--shadow-card)]">
      <div className="mb-1 text-[15px] font-semibold text-[var(--color-ink)]">
        Retenção por coorte
      </div>
      <p className="mb-4 text-[12px] text-[var(--color-neutral-400)]">
        % dos clientes associados em cada mês que voltaram no período
      </p>
      <div className="flex h-[200px] items-end gap-3">
        {cohorts.map((c) => {
          const h = c.size === 0 ? 8 : Math.max(8, Math.round((c.rate / maxRate) * 100));
          return (
            <div
              key={c.month}
              className="flex h-full flex-1 flex-col items-center justify-end gap-2"
              title={`${c.label}: ${c.retained}/${c.size} (${c.rate}%)`}
            >
              <span className="text-[11px] font-semibold text-[var(--color-neutral-500)]">
                {c.size === 0 ? '—' : `${c.rate}%`}
              </span>
              <div
                className="w-full max-w-[38px] rounded-[6px] bg-[var(--color-primary-500)]"
                style={{ height: `${h}%`, opacity: c.size === 0 ? 0.25 : 1 }}
              />
              <span className="text-[11px] text-[var(--color-neutral-400)]">
                {c.label}
              </span>
            </div>
          );
        })}
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
  lines.push('Campanha;Tipo;Resgates;Engajamento %');
  for (const c of data.campaigns) {
    lines.push(
      [c.name, c.type, c.redeems, c.engagePct].map(csvEscape).join(';'),
    );
  }

  const blob = new Blob([lines.join('\n')], {
    type: 'text/csv;charset=utf-8;',
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `frego-relatorios-${data.range}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

export default function ReportsPage() {
  const { getToken, user, loading: authLoading } = useAuth();
  const [range, setRange] = useState<RangeKey>('30d');
  const [data, setData] = useState<ReportsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    setError(null);
    try {
      const token = await getToken();
      if (!token) throw new Error('Sessão expirada');
      const res = await fetch(`${API_URL}/reports?range=${range}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(
          (body as { message?: string }).message ??
            `Falha ao carregar (${res.status})`,
        );
      }
      setData((await res.json()) as ReportsData);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erro ao carregar');
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [getToken, range, user]);

  useEffect(() => {
    if (!authLoading && user) void load();
  }, [authLoading, user, load]);

  const kpis = data?.kpis;

  return (
    <AppShell
      title="Relatórios"
      topbar={
        <header className="flex h-[60px] items-center gap-3 border-b border-[var(--color-hairline)] bg-[var(--color-card)]/90 px-4 backdrop-blur md:px-7">
          <h1 className="text-[17px] font-semibold text-[var(--color-ink)]">
            Relatórios
          </h1>
          <div className="ml-auto flex flex-wrap items-center gap-2">
            <div className="flex rounded-[10px] border border-[var(--color-neutral-200)] bg-[var(--color-card)] p-0.5">
              {RANGES.map((r) => (
                <button
                  key={r.key}
                  type="button"
                  onClick={() => setRange(r.key)}
                  className={`rounded-[8px] px-2.5 py-1.5 text-[12px] font-semibold transition-colors sm:px-3 sm:text-[13px] ${
                    range === r.key
                      ? 'bg-[var(--color-bg)] text-[var(--color-ink)]'
                      : 'text-[var(--color-neutral-500)] hover:text-[var(--color-ink)]'
                  }`}
                >
                  {r.label}
                </button>
              ))}
            </div>
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
      <div className="mx-auto max-w-6xl px-4 py-6 md:px-7 md:py-7">
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
              Tentar de novo
            </button>
          </div>
        ) : !data || !kpis ? null : (
          <div className="flex flex-col gap-4">
            <div className="grid grid-cols-2 gap-3 lg:grid-cols-4 lg:gap-4">
              <KpiCard
                label="Clientes ativos"
                value={kpis.activeCustomers.value.toLocaleString('pt-BR')}
                hint={`${kpis.activeCustomers.ofBasePct ?? 0}% da base`}
                deltaPct={kpis.activeCustomers.deltaPct}
              />
              <KpiCard
                label="Inativos (30d+)"
                value={kpis.inactive.value.toLocaleString('pt-BR')}
                hint={
                  kpis.inactive.value > 0
                    ? 'prontos para reativação'
                    : 'base aquecida'
                }
              />
              <KpiCard
                label="Média visitas / cliente"
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

            <div className="grid gap-4 lg:grid-cols-[1.4fr_1fr]">
              <ActivityChart series={data.series} />
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
                              ? `${m.points} pts`
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
                  Campanhas por resgate
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
                  <div className="hidden grid-cols-[minmax(0,2fr)_1fr_1fr_1.4fr] gap-3 text-[12px] font-medium text-[var(--color-neutral-400)] md:grid">
                    <span>Campanha</span>
                    <span>Resgates</span>
                    <span>Engajamento</span>
                    <span />
                  </div>
                  {data.campaigns.map((c) => (
                    <div
                      key={c.id}
                      className="grid grid-cols-1 gap-1.5 border-t border-[var(--color-hairline)] pt-3 first:border-0 first:pt-0 md:grid-cols-[minmax(0,2fr)_1fr_1fr_1.4fr] md:items-center md:gap-3"
                    >
                      <div className="min-w-0">
                        <div className="truncate text-[13px] font-medium text-[var(--color-ink)]">
                          {c.name}
                        </div>
                        <div className="text-[11px] text-[var(--color-neutral-400)]">
                          {TYPE_LABEL[c.type] ?? c.type}
                          {c.rewardTitle ? ` · ${c.rewardTitle}` : ''}
                        </div>
                      </div>
                      <span className="text-[13px] text-[var(--color-neutral-500)]">
                        {c.redeems.toLocaleString('pt-BR')} resgates
                      </span>
                      <span
                        className={`text-[13px] font-semibold ${
                          c.engagePct >= 50
                            ? 'text-[var(--color-success)]'
                            : 'text-[var(--color-neutral-500)]'
                        }`}
                      >
                        {c.engagePct}% engaj.
                      </span>
                      <div className="h-1.5 overflow-hidden rounded-full bg-[var(--color-neutral-100)]">
                        <div
                          className="h-full rounded-full bg-[var(--color-primary-500)]"
                          style={{ width: `${Math.min(100, c.engagePct)}%` }}
                        />
                      </div>
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
