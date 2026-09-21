'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { SegmentedControl } from '@/components/ui';
import { TermInfo } from '@/components/term-info';
import { formatBrl } from '@/lib/money';
import {
  campaignTypeColor,
  campaignTypeLabel,
} from '@/lib/campaign-type';
import { TERM } from '@/lib/term-copy';

export type CampaignCompareRow = {
  id: string;
  name: string;
  type: string;
  redeems: number;
  redeemers?: number;
  revenueCents: number;
};

type CompareMetric = 'redeems' | 'redeemers' | 'revenue';

const METRIC_INFO: Record<CompareMetric, string> = {
  redeems: TERM.resgates,
  redeemers: TERM.pessoas,
  revenue: TERM.retorno,
};

const METRICS: { value: CompareMetric; label: string }[] = [
  { value: 'redeems', label: 'Resgates' },
  { value: 'redeemers', label: 'Pessoas' },
  { value: 'revenue', label: 'Retorno' },
];

function metricValue(row: CampaignCompareRow, metric: CompareMetric) {
  if (metric === 'redeemers') return row.redeemers ?? 0;
  if (metric === 'revenue') return row.revenueCents;
  return row.redeems;
}

function formatMetric(row: CampaignCompareRow, metric: CompareMetric) {
  const value = metricValue(row, metric);
  if (metric === 'revenue') return formatBrl(value);
  return value.toLocaleString('pt-BR');
}

function emptyCopy(metric: CompareMetric) {
  if (metric === 'revenue') {
    return 'Nenhuma venda no resgate ou no caixa neste período.';
  }
  if (metric === 'redeemers') {
    return 'Ninguém resgatou neste período.';
  }
  return 'Nenhum resgate neste período.';
}

const COMPACT_LIMIT = 5;

export function CampaignCompareChart({
  campaigns,
  hrefFor,
  periodHint,
  compact = false,
}: {
  campaigns: CampaignCompareRow[];
  hrefFor?: (id: string) => string;
  periodHint?: string;
  compact?: boolean;
}) {
  const [metric, setMetric] = useState<CompareMetric>('redeems');
  const [expanded, setExpanded] = useState(false);
  const ranked = useMemo(
    () =>
      [...campaigns].sort(
        (a, b) =>
          metricValue(b, metric) - metricValue(a, metric) ||
          a.name.localeCompare(b.name, 'pt-BR'),
      ),
    [campaigns, metric],
  );
  const visible =
    compact && !expanded ? ranked.slice(0, COMPACT_LIMIT) : ranked;
  const hiddenCount = ranked.length - visible.length;
  const max = Math.max(1, ...ranked.map((c) => metricValue(c, metric)));
  const hasSignal = ranked.some((c) => metricValue(c, metric) > 0);
  const types = useMemo(() => {
    const seen = new Set<string>();
    const list: string[] = [];
    for (const c of campaigns) {
      if (seen.has(c.type)) continue;
      seen.add(c.type);
      list.push(c.type);
    }
    return list;
  }, [campaigns]);

  return (
    <div
      className={`rounded-[14px] border border-[var(--color-hairline)] bg-[var(--color-card)] shadow-[var(--shadow-card)] ${
        compact ? 'p-3.5' : 'p-5'
      }`}
    >
      <div
        className={`flex flex-col sm:flex-row sm:items-start sm:justify-between ${
          compact ? 'mb-2.5 gap-2' : 'mb-3 gap-3'
        }`}
      >
        <div>
          <div
            className={`font-semibold text-[var(--color-ink)] ${
              compact ? 'text-[13px]' : 'text-[15px]'
            }`}
          >
            Comparar campanhas
          </div>
          <p
            className={`leading-snug text-[var(--color-neutral-400)] ${
              compact ? 'mt-0.5 text-[11px]' : 'mt-1 text-[12px]'
            }`}
          >
            {periodHint ?? 'Quem puxou resgate, pessoas e retorno no período.'}
          </p>
        </div>
        <div className="flex items-center gap-1">
          <SegmentedControl
            value={metric}
            options={METRICS}
            onChange={setMetric}
            ariaLabel="Métrica de comparação"
            className="shrink-0"
            size={compact ? 'sm' : 'md'}
          />
          <TermInfo info={METRIC_INFO[metric]} />
        </div>
      </div>

      {campaigns.length === 0 ? (
        <p className="text-[13px] text-[var(--color-neutral-500)]">
          Nenhuma campanha para comparar.
        </p>
      ) : !hasSignal ? (
        <p className="text-[13px] text-[var(--color-neutral-500)]">
          {emptyCopy(metric)}
        </p>
      ) : (
        <ul className={`flex flex-col ${compact ? 'gap-1.5' : 'gap-3'}`}>
          {visible.map((c) => {
            const value = metricValue(c, metric);
            const pct = Math.round((value / max) * 100);
            const href = hrefFor?.(c.id);
            const bar = (
              <>
                <div
                  className={`flex items-baseline justify-between gap-3 ${
                    compact ? 'mb-0.5' : 'mb-1'
                  }`}
                >
                  <span
                    className={`min-w-0 truncate font-medium text-[var(--color-ink)] ${
                      compact ? 'text-[12px]' : 'text-[13px]'
                    }`}
                  >
                    {c.name}
                    <span className="ml-1.5 font-normal text-[var(--color-neutral-400)]">
                      {campaignTypeLabel(c.type)}
                    </span>
                  </span>
                  <span
                    className={`shrink-0 font-semibold tabular-nums text-[var(--color-ink)] ${
                      compact ? 'text-[12px]' : 'text-[13px]'
                    }`}
                  >
                    {formatMetric(c, metric)}
                  </span>
                </div>
                <div
                  className={`overflow-hidden rounded-full bg-[var(--color-neutral-100)] ${
                    compact ? 'h-1.5' : 'h-2'
                  }`}
                >
                  <div
                    className="h-full rounded-full transition-all"
                    style={{
                      width: `${Math.max(pct, value > 0 ? 4 : 0)}%`,
                      background: campaignTypeColor(c.type),
                      opacity: value > 0 ? 1 : 0.35,
                    }}
                  />
                </div>
              </>
            );
            return (
              <li key={c.id}>
                {href ? (
                  <Link
                    href={href}
                    className="block rounded-[8px] outline-none transition-opacity hover:opacity-80 focus-visible:ring-2 focus-visible:ring-[var(--color-primary-500)]"
                    title={`${c.name}: ${formatMetric(c, metric)}`}
                  >
                    {bar}
                  </Link>
                ) : (
                  <div title={`${c.name}: ${formatMetric(c, metric)}`}>
                    {bar}
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}

      {hiddenCount > 0 ? (
        <button
          type="button"
          onClick={() => setExpanded(true)}
          className="mt-2 text-[12px] font-semibold text-[var(--color-primary-500)]"
        >
          Mais {hiddenCount} campanha{hiddenCount === 1 ? '' : 's'}
        </button>
      ) : null}

      {types.length > 1 && hasSignal && (
        <div
          className={`flex flex-wrap text-[var(--color-neutral-500)] ${
            compact ? 'mt-2.5 gap-2 text-[10px]' : 'mt-4 gap-3 text-[11px]'
          }`}
        >
          {types.map((type) => (
            <span key={type} className="inline-flex items-center gap-1.5">
              <span
                className={`inline-block rounded-full ${
                  compact ? 'h-1.5 w-1.5' : 'h-2 w-2'
                }`}
                style={{ background: campaignTypeColor(type) }}
                aria-hidden
              />
              {campaignTypeLabel(type)}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
