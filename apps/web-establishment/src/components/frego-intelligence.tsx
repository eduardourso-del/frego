'use client';

import Link from 'next/link';
import {
  Clock,
  Gift,
  Heart,
  Sparkles,
  TrendingUp,
  UserMinus,
  type LucideIcon,
} from 'lucide-react';
import {
  audienceRulesQuery,
  campaignCreateHref,
} from '@/components/audience-preset-cards';

export type IntelligenceTone =
  | 'missing'
  | 'near_reward'
  | 'high_value'
  | 'quiet_hours'
  | 'celebrate';

export type IntelligenceAction = {
  key: string;
  tone: IntelligenceTone;
  title: string;
  body: string;
  metric: {
    value: number;
    format: 'count' | 'money' | 'hour';
    label?: string;
  };
  audience?: { name: string; rules: Record<string, unknown> };
  campaign?: { suggestedName: string; suggestedRewardTitle?: string };
};

export type IntelligencePayload = {
  periodLabel: string;
  actions: IntelligenceAction[];
};

const TONE: Record<
  IntelligenceTone,
  { Icon: LucideIcon; iconWrap: string }
> = {
  missing: {
    Icon: UserMinus,
    iconWrap: 'bg-[var(--color-danger-fill)] text-white',
  },
  near_reward: {
    Icon: Gift,
    iconWrap: 'bg-[var(--color-primary-500)] text-white',
  },
  high_value: {
    Icon: TrendingUp,
    iconWrap: 'bg-[var(--color-success-fill)] text-white',
  },
  quiet_hours: {
    Icon: Clock,
    iconWrap: 'bg-[var(--color-intel-fill)] text-white',
  },
  celebrate: {
    Icon: Heart,
    iconWrap: 'bg-[var(--color-intel-fill)] text-white',
  },
};

function formatMoney(cents: number) {
  return (cents / 100).toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    maximumFractionDigits: 0,
  });
}

function metricText(metric: IntelligenceAction['metric']) {
  if (metric.label) return metric.label;
  if (metric.format === 'money') return formatMoney(metric.value);
  if (metric.format === 'hour') return `${metric.value}h`;
  return String(metric.value);
}

function actionHref(action: IntelligenceAction) {
  return campaignCreateHref(action.audience?.rules, action.audience?.name, {
    campaignName: action.campaign?.suggestedName,
    rewardTitle: action.campaign?.suggestedRewardTitle,
  });
}

export function FregoIntelligence({
  data,
}: {
  data: IntelligencePayload;
}) {
  const actions =
    data.actions.length > 0
      ? data.actions
      : [
          {
            key: 'empty',
            tone: 'celebrate' as const,
            title: 'Ainda estamos conhecendo a casa',
            body: 'Cada visita no balcão vira dado. Em pouco tempo o Frego aponta quem chamar de volta.',
            metric: { value: 0, format: 'count' as const },
          },
        ];

  return (
    <section
      className="mb-8 overflow-hidden rounded-[20px] border border-[var(--color-intel)]/30 bg-[var(--color-intel-bg)]"
      aria-labelledby="frego-intelligence-heading"
    >
      <header className="flex items-center gap-3 bg-[var(--color-intel-fill)] px-5 py-4 text-white">
        <span
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[12px] bg-white/15"
          aria-hidden
        >
          <Sparkles size={20} strokeWidth={2.25} />
        </span>
        <div className="min-w-0">
          <h2
            id="frego-intelligence-heading"
            className="text-[16px] font-semibold tracking-[-0.02em] md:text-[18px]"
          >
            Frego Inteligência
          </h2>
          <p className="mt-0.5 text-[12px] leading-snug text-white/80 md:text-[13px]">
            Ações para reter quem já veio e trazer de volta quem sumiu.
          </p>
        </div>
      </header>

      <div
        className={`grid gap-3 p-4 ${
          actions.length === 1 ? '' : 'sm:grid-cols-2'
        }`}
      >
        {actions.map((action) => {
          const theme = TONE[action.tone] ?? TONE.celebrate;
          const Icon = action.key === 'empty' ? Sparkles : theme.Icon;
          const showMetric = action.key !== 'empty';
          const canCampaign = Boolean(action.campaign);
          const canPeek = Boolean(action.audience?.rules);
          const primaryHref = canCampaign ? actionHref(action) : '/counter';
          const primaryLabel = canCampaign
            ? 'Criar campanha'
            : 'Ir para o balcão';

          return (
            <article
              key={action.key}
              className="flex flex-col rounded-[16px] border border-[var(--color-hairline)] bg-[var(--color-card)] p-4"
            >
              <div className="flex items-start justify-between gap-3">
                <span
                  className={`inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-[10px] ${theme.iconWrap}`}
                >
                  <Icon size={18} strokeWidth={2.25} aria-hidden />
                </span>
                {showMetric && (
                  <span className="text-[22px] font-semibold tabular-nums leading-none tracking-[-0.03em] text-[var(--color-ink)] md:text-[26px]">
                    {metricText(action.metric)}
                  </span>
                )}
              </div>
              <h3 className="mt-3 text-[15px] font-semibold leading-snug tracking-[-0.02em] text-[var(--color-ink)]">
                {action.title}
              </h3>
              <p className="mt-1.5 flex-1 text-[13px] leading-relaxed text-[var(--color-neutral-500)]">
                {action.body}
              </p>
              <div className="mt-3.5 flex flex-wrap items-center gap-x-4 gap-y-2">
                <Link
                  href={primaryHref}
                  className="inline-flex min-h-10 items-center justify-center rounded-[12px] bg-[var(--color-intel-fill)] px-3.5 text-[13px] font-semibold text-white"
                >
                  {primaryLabel}
                </Link>
                {canPeek && (
                  <Link
                    href={`/customers?${audienceRulesQuery(action.audience!.rules)}`}
                    className="text-[13px] font-semibold text-[var(--color-intel)] hover:underline"
                  >
                    Ver quem são
                  </Link>
                )}
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}
