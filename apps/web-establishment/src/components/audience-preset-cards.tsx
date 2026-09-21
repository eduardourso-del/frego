'use client';

import Link from 'next/link';
import {
  AlertTriangle,
  Crown,
  Gift,
  TrendingUp,
  Users,
  type LucideIcon,
} from 'lucide-react';

export type AudiencePreset = {
  key: string;
  name: string;
  description: string;
  rules: Record<string, unknown>;
  memberCount: number;
};

type AudiencePresetTheme = {
  Icon: LucideIcon;
  card: string;
  iconWrap: string;
  title: string;
  count: string;
  body: string;
  link: string;
};

const FALLBACK: AudiencePresetTheme = {
  Icon: Users,
  card: 'border-[var(--color-hairline)] bg-[var(--color-bg)]',
  iconWrap: 'bg-[var(--color-neutral-200)] text-[var(--color-neutral-700)]',
  title: 'text-[var(--color-ink)]',
  count: 'text-[var(--color-ink)]',
  body: 'text-[var(--color-neutral-500)]',
  link: 'text-[var(--color-primary-500)]',
};

const THEME: Record<string, AudiencePresetTheme> = {
  high_value: {
    Icon: TrendingUp,
    card: 'border-[var(--color-success)]/20 bg-[var(--color-success-bg)]',
    iconWrap: 'bg-[var(--color-success-fill)] text-white',
    title: 'text-[var(--color-success)]',
    count: 'text-[var(--color-success)]',
    body: 'text-[var(--color-neutral-600)]',
    link: 'text-[var(--color-success)]',
  },
  at_risk: {
    Icon: AlertTriangle,
    card: 'border-[var(--color-danger)]/25 bg-[var(--color-danger-bg)]',
    iconWrap: 'bg-[var(--color-danger-fill)] text-white',
    title: 'text-[var(--color-danger)]',
    count: 'text-[var(--color-danger)]',
    body: 'text-[var(--color-neutral-600)]',
    link: 'text-[var(--color-danger)]',
  },
  near_reward: {
    Icon: Gift,
    card: 'border-[var(--color-primary-200)] bg-[var(--color-primary-50)]',
    iconWrap: 'bg-[var(--color-primary-500)] text-white',
    title: 'text-[var(--color-primary-600)]',
    count: 'text-[var(--color-primary-800)]',
    body: 'text-[var(--color-neutral-600)]',
    link: 'text-[var(--color-primary-600)]',
  },
  vip: {
    Icon: Crown,
    card: 'border-transparent bg-[var(--color-primary-800)]',
    iconWrap: 'bg-white/15 text-white',
    title: 'text-white',
    count: 'text-white',
    body: 'text-white/70',
    link: 'text-[var(--color-primary-200)]',
  },
};

export function audienceRulesQuery(rules: Record<string, unknown>) {
  const params = new URLSearchParams();
  for (const [k, v] of Object.entries(rules)) {
    if (k === 'version' || v == null) continue;
    if (Array.isArray(v)) {
      if (v.length === 0) continue;
      params.set(k, v.join(','));
      continue;
    }
    params.set(k, String(v));
  }
  return params.toString();
}

export function campaignCreateHref(
  rules?: Record<string, unknown> | null,
  name?: string,
  extras?: {
    campaignName?: string;
    rewardTitle?: string;
  },
) {
  const params = new URLSearchParams();
  params.set('compose', '1');
  const hasRules =
    !!rules &&
    Object.entries(rules).some(([k, v]) => k !== 'version' && v != null);
  if (hasRules && rules) {
    params.set('fromAudience', '1');
    if (name) params.set('audienceName', name);
    for (const [k, v] of Object.entries(rules)) {
      if (k === 'version' || v == null) continue;
      if (Array.isArray(v)) {
        if (v.length === 0) continue;
        params.set(k, v.join(','));
        continue;
      }
      params.set(k, String(v));
    }
  }
  if (extras?.campaignName) params.set('campaignName', extras.campaignName);
  if (extras?.rewardTitle) params.set('rewardTitle', extras.rewardTitle);
  return `/campaigns?${params.toString()}`;
}

export function AudiencePresetCards({
  presets,
  compact = false,
}: {
  presets: AudiencePreset[];
  compact?: boolean;
}) {
  if (presets.length === 0) return null;

  return (
    <div
      className={`grid min-w-0 gap-2.5 ${
        compact
          ? 'grid-cols-2 md:grid-cols-4'
          : 'sm:grid-cols-2 lg:grid-cols-4'
      }`}
    >
      {presets.map((p) => {
        const theme = THEME[p.key] ?? FALLBACK;
        const Icon = theme.Icon;
        return (
          <div
            key={p.key}
            className={`min-w-0 rounded-[14px] border ${
              compact ? 'p-3' : 'p-3.5'
            } ${theme.card}`}
          >
            <div className="flex items-center justify-between gap-2">
              <span
                className={`inline-flex items-center justify-center rounded-[10px] ${
                  compact ? 'h-8 w-8' : 'h-9 w-9'
                } ${theme.iconWrap}`}
              >
                <Icon
                  size={compact ? 16 : 18}
                  strokeWidth={2.25}
                  aria-hidden
                />
              </span>
              <div
                className={`font-semibold tabular-nums leading-none ${
                  compact ? 'text-[22px]' : 'text-[26px]'
                } ${theme.count}`}
              >
                {p.memberCount}
              </div>
            </div>
            <div
              className={`mt-2.5 font-semibold ${
                compact ? 'text-[12px]' : 'text-[13px]'
              } ${theme.title}`}
            >
              {p.name}
            </div>
            <p className={`mt-1 text-[11px] leading-snug ${theme.body}`}>
              {p.description}
            </p>
            <div className="mt-2.5 flex flex-wrap gap-x-3 gap-y-1">
              <Link
                href={`/customers?${audienceRulesQuery(p.rules)}`}
                className={`font-semibold ${compact ? 'text-[11px]' : 'text-[12px]'} ${theme.link}`}
              >
                {compact ? 'Ver' : 'Ver clientes'}
              </Link>
              <Link
                href={campaignCreateHref(p.rules, p.name)}
                className={`font-semibold ${compact ? 'text-[11px]' : 'text-[12px]'} ${theme.link}`}
              >
                Criar campanha
              </Link>
            </div>
          </div>
        );
      })}
    </div>
  );
}
