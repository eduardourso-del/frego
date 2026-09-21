'use client';

import Link from 'next/link';
import type { ReactNode } from 'react';
import { CampaignCompareChart } from '@/components/campaign-compare-chart';
import { TermInfo } from '@/components/term-info';
import { formatCoverage, type RevenueCoverage } from '@/lib/campaign-return';
import {
  campaignTypeLabel,
  redeemCountLabel,
} from '@/lib/campaign-type';
import { formatBrl } from '@/lib/money';
import { TERM } from '@/lib/term-copy';

export type DashboardCampaign = {
  id: string;
  name: string;
  type: string;
  rewardTitle: string | null;
  stampsNeeded: number | null;
  cashbackPercent?: number | null;
  redeems?: number;
  redeemers?: number;
  fulfillPct?: number;
  openVouchers?: number;
  usedVouchers?: number;
  expiredVouchers?: number;
  redeemRevenueCents?: number;
  revenueCoverage?: RevenueCoverage;
};

type Spotlight = {
  id: string;
  name: string;
  type?: string;
  redeems: number;
  fulfillPct: number;
  rewardTitle?: string | null;
  cashbackPercent?: number | null;
  redeemRevenueCents?: number;
  revenueCoverage?: RevenueCoverage;
  openVouchers?: number;
} | null;

function campaignReturnHint(
  type: string | undefined,
  cents: number | undefined,
  coverage?: RevenueCoverage,
) {
  if (cents == null) return '';
  if (cents === 0 && !(coverage && coverage.used > 0)) return '';
  const money = formatBrl(cents);
  const label = type === 'cashback' ? 'em vendas no caixa' : 'no resgate';
  const cov = formatCoverage(coverage);
  return ` · ${money} ${label}${cov ? ` · ${cov}` : ''}`;
}

function Metric({
  label,
  value,
  hint,
  info,
}: {
  label: string;
  value: string;
  hint?: string | null;
  info?: string;
}) {
  return (
    <div className="min-w-0">
      <div className="text-[11px] font-medium text-[var(--color-neutral-400)] sm:hidden">
        {info ? <TermInfo info={info}>{label}</TermInfo> : label}
      </div>
      <div className="mt-0.5 truncate text-[13px] font-semibold tabular-nums text-[var(--color-ink)] sm:mt-0 sm:font-medium sm:text-[var(--color-neutral-600)]">
        {value}
      </div>
      {hint ? (
        <div className="truncate text-[11px] text-[var(--color-neutral-400)]">
          {hint}
        </div>
      ) : null}
    </div>
  );
}

function KpiCard({
  label,
  value,
  deltaPct,
  hint,
}: {
  label: ReactNode;
  value: string;
  deltaPct?: number | null;
  hint?: string;
}) {
  return (
    <div className="rounded-[16px] border border-[var(--color-hairline)] bg-[var(--color-card)] p-4 shadow-[var(--shadow-card)] md:rounded-[14px] md:p-[18px]">
      <div className="text-[12px] font-medium leading-snug text-[var(--color-neutral-500)] md:text-[13px]">
        {label}
      </div>
      <div className="mt-1 text-[24px] font-semibold tracking-[-0.02em] text-[var(--color-ink)] md:mt-1.5 md:text-[30px]">
        {value}
      </div>
      <div className="mt-1 flex flex-col gap-1 sm:flex-row sm:flex-wrap sm:items-center sm:gap-2">
        {deltaPct !== undefined ? <Delta value={deltaPct} /> : null}
        {hint ? (
          <span className="text-[11px] text-[var(--color-neutral-400)]">
            {hint}
          </span>
        ) : null}
      </div>
    </div>
  );
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

export function CampaignPerformanceSection({
  campaigns,
  topCampaign,
  weakCampaign,
  returnCents,
  returnDeltaPct,
}: {
  campaigns: DashboardCampaign[];
  topCampaign: Spotlight;
  weakCampaign: Spotlight;
  returnCents: number;
  returnDeltaPct: number | null;
}) {
  const ranked = [...campaigns].sort(
    (a, b) => (b.redeems ?? 0) - (a.redeems ?? 0) || a.name.localeCompare(b.name, 'pt-BR'),
  );
  const totalRedeems = ranked.reduce((s, c) => s + (c.redeems ?? 0), 0);
  const openVouchers = ranked.reduce(
    (s, c) => s + (c.type === 'cashback' ? 0 : (c.openVouchers ?? 0)),
    0,
  );
  const usedVouchers = ranked.reduce(
    (s, c) => s + (c.type === 'cashback' ? 0 : (c.usedVouchers ?? 0)),
    0,
  );
  const expiredVouchers = ranked.reduce(
    (s, c) => s + (c.type === 'cashback' ? 0 : (c.expiredVouchers ?? 0)),
    0,
  );
  const voucherTotal = openVouchers + usedVouchers + expiredVouchers;
  const fulfillPct =
    voucherTotal === 0 ? null : Math.round((usedVouchers / voucherTotal) * 100);
  const idle = ranked.filter((c) => (c.redeems ?? 0) === 0).length;

  const showWeak =
    weakCampaign != null && weakCampaign.id !== topCampaign?.id;

  return (
    <>
      <div className="mb-3 grid grid-cols-2 gap-3 xl:grid-cols-4">
        <KpiCard
          label={
            <TermInfo info={TERM.retornoCampanhas}>Retorno das campanhas</TermInfo>
          }
          value={formatBrl(returnCents)}
          deltaPct={returnDeltaPct}
          hint="vendas no resgate e no caixa"
        />
        <KpiCard
          label={<TermInfo info={TERM.resgates}>Resgates</TermInfo>}
          value={totalRedeems.toLocaleString('pt-BR')}
          hint="inclui usos de cashback no caixa"
        />
        <KpiCard
          label={<TermInfo info={TERM.confirmados}>Confirmados</TermInfo>}
          value={fulfillPct == null ? '—' : `${fulfillPct}%`}
          hint={
            voucherTotal === 0
              ? 'nenhum voucher no período'
              : `${usedVouchers} de ${voucherTotal} no caixa`
          }
        />
        <KpiCard
          label={
            openVouchers > 0 ? (
              <TermInfo info={TERM.aEspera}>À espera</TermInfo>
            ) : (
              'Sem movimento'
            )
          }
          value={
            openVouchers > 0
              ? openVouchers.toLocaleString('pt-BR')
              : idle.toLocaleString('pt-BR')
          }
          hint={
            openVouchers > 0
              ? 'vouchers ainda não confirmados'
              : idle === 1
                ? 'campanha sem resgate no período'
                : 'campanhas sem resgate no período'
          }
        />
      </div>

      {(topCampaign || showWeak) && (
        <div className="mb-3 grid gap-3 sm:grid-cols-2">
          {topCampaign && (
            <Link
              href={`/campaigns?highlight=${topCampaign.id}`}
              className="rounded-[14px] border border-[var(--color-hairline)] bg-[var(--color-card)] p-4 shadow-[var(--shadow-card)] transition-colors hover:border-[var(--color-primary-200)]"
            >
              <p className="text-[12px] font-semibold uppercase tracking-[0.04em] text-[var(--color-neutral-400)]">
                Em destaque
              </p>
              <p className="mt-1 text-[15px] font-semibold text-[var(--color-ink)]">
                {topCampaign.name}
              </p>
              <p className="mt-1 text-[13px] text-[var(--color-neutral-500)]">
                {topCampaign.type === 'cashback'
                  ? redeemCountLabel('cashback', topCampaign.redeems)
                  : redeemCountLabel('stamps', topCampaign.redeems)}
                {topCampaign.type !== 'cashback'
                  ? ` · ${topCampaign.fulfillPct}% confirmados`
                  : topCampaign.cashbackPercent
                    ? ` · ${topCampaign.cashbackPercent}%`
                    : ''}
                {campaignReturnHint(
                  topCampaign.type,
                  topCampaign.redeemRevenueCents,
                  topCampaign.revenueCoverage,
                )}
                {topCampaign.rewardTitle
                  ? ` · ${topCampaign.rewardTitle}`
                  : ''}
              </p>
            </Link>
          )}
          {showWeak && weakCampaign && (
            <Link
              href={`/campaigns?highlight=${weakCampaign.id}`}
              className="rounded-[14px] border border-[var(--color-hairline)] bg-[var(--color-card)] p-4 shadow-[var(--shadow-card)] transition-colors hover:border-[var(--color-primary-200)]"
            >
              <p className="text-[12px] font-semibold uppercase tracking-[0.04em] text-[var(--color-neutral-400)]">
                Precisa de atenção
              </p>
              <p className="mt-1 text-[15px] font-semibold text-[var(--color-ink)]">
                {weakCampaign.name}
              </p>
              <p className="mt-1 text-[13px] text-[var(--color-neutral-500)]">
                {(weakCampaign.openVouchers ?? 0) > 0
                  ? `${weakCampaign.openVouchers} voucher${
                      (weakCampaign.openVouchers ?? 0) === 1 ? '' : 's'
                    } à espera no caixa`
                  : weakCampaign.redeems === 0
                    ? 'Nenhum resgate neste período'
                    : `${redeemCountLabel(
                        weakCampaign.type ?? 'stamps',
                        weakCampaign.redeems,
                      )} · ${weakCampaign.fulfillPct}% confirmados`}
                {campaignReturnHint(
                  weakCampaign.type,
                  weakCampaign.redeemRevenueCents,
                  weakCampaign.revenueCoverage,
                )}
              </p>
            </Link>
          )}
        </div>
      )}

      {campaigns.length === 0 ? (
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
        <div className="grid items-start gap-3 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,0.85fr)]">
          <CampaignCompareChart
            campaigns={campaigns.map((c) => ({
              id: c.id,
              name: c.name,
              type: c.type,
              redeems: c.redeems ?? 0,
              redeemers: c.redeemers ?? 0,
              revenueCents: c.redeemRevenueCents ?? 0,
            }))}
            hrefFor={(id) => `/campaigns?highlight=${id}`}
            periodHint="Resgates, pessoas e retorno no recorte do painel."
          />

          <div className="rounded-[14px] border border-[var(--color-hairline)] bg-[var(--color-card)] p-[18px] shadow-[var(--shadow-card)]">
            <div className="mb-3.5 flex items-center justify-between gap-2">
              <div className="text-[15px] font-semibold text-[var(--color-ink)]">
                Ativas
                <span className="ml-1.5 font-medium text-[var(--color-neutral-400)]">
                  ({campaigns.length})
                </span>
              </div>
              <Link
                href="/campaigns?status=active"
                className="text-[13px] font-semibold text-[var(--color-primary-500)] hover:underline"
              >
                Ver todas
              </Link>
            </div>
            <div className="mb-2 hidden grid-cols-[minmax(0,1.4fr)_0.6fr_0.7fr_0.9fr] gap-2 text-[11px] font-medium text-[var(--color-neutral-400)] sm:grid">
              <span>Campanha</span>
              <span>
                <TermInfo info={TERM.resgates}>Resgates</TermInfo>
              </span>
              <span>
                <TermInfo info={TERM.confirmados}>Confirmados</TermInfo>
              </span>
              <span>
                <TermInfo info={TERM.retorno} align="end">
                  Retorno
                </TermInfo>
              </span>
            </div>
            <ul className="flex flex-col">
              {ranked.map((c) => (
                <li
                  key={c.id}
                  className="border-t border-[var(--color-hairline)] first:border-0"
                >
                  <Link
                    href={`/campaigns?highlight=${c.id}`}
                    className="grid grid-cols-2 gap-x-3 gap-y-2 py-3 sm:grid-cols-[minmax(0,1.4fr)_0.6fr_0.7fr_0.9fr] sm:items-center sm:gap-2"
                  >
                    <div className="col-span-2 min-w-0 sm:col-span-1">
                      <div className="truncate text-[13px] font-semibold text-[var(--color-ink)]">
                        {c.name}
                      </div>
                      <div className="truncate text-[11px] text-[var(--color-neutral-400)]">
                        {campaignTypeLabel(c.type)}
                        {c.rewardTitle ? ` · ${c.rewardTitle}` : ''}
                      </div>
                    </div>
                    <Metric
                      label={c.type === 'cashback' ? 'Usos' : 'Resgates'}
                      info={TERM.resgates}
                      value={(c.redeems ?? 0).toLocaleString('pt-BR')}
                      hint={
                        (c.redeemers ?? 0) > 0
                          ? `${c.redeemers} pessoa${
                              (c.redeemers ?? 0) === 1 ? '' : 's'
                            }`
                          : null
                      }
                    />
                    <Metric
                      label="Confirmados"
                      info={TERM.confirmados}
                      value={
                        c.type === 'cashback'
                          ? 'Caixa'
                          : voucherTotalFor(c) === 0
                            ? '—'
                            : `${c.fulfillPct ?? 0}%`
                      }
                      hint={
                        (c.openVouchers ?? 0) > 0
                          ? `${c.openVouchers} à espera no caixa`
                          : null
                      }
                    />
                    <Metric
                      label="Retorno"
                      info={TERM.retorno}
                      value={formatBrl(c.redeemRevenueCents ?? 0)}
                      hint={formatCoverage(c.revenueCoverage) ?? avgTicket(c)}
                    />
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}
    </>
  );
}

function voucherTotalFor(c: DashboardCampaign) {
  return (
    (c.openVouchers ?? 0) +
    (c.usedVouchers ?? 0) +
    (c.expiredVouchers ?? 0)
  );
}

function avgTicket(c: DashboardCampaign) {
  const withAmount = c.revenueCoverage?.withAmount ?? 0;
  if (withAmount <= 0 || !(c.redeemRevenueCents && c.redeemRevenueCents > 0)) {
    return null;
  }
  return formatBrl(Math.round(c.redeemRevenueCents / withAmount));
}
