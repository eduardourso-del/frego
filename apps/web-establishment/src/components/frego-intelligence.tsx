'use client';

import Link from 'next/link';
import {
  Clock,
  Gift,
  Heart,
  Sparkles,
  TrendingUp,
  UserMinus,
  UserPlus,
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
  aim?: string;
  title: string;
  body: string;
  metric: {
    value: number;
    format: 'count' | 'money' | 'hour';
    label?: string;
  };
  audience?: { name: string; rules: Record<string, unknown> };
  campaign?: {
    suggestedName: string;
    suggestedRewardTitle?: string;
    suggestedType?: 'stamps' | 'spend' | 'birthday' | 'cashback' | 'promo';
  };
};

export type IntelligencePayload = {
  periodLabel: string;
  intro?: string;
  actions: IntelligenceAction[];
};

const TONE: Record<
  IntelligenceTone,
  { Icon: LucideIcon; iconWrap: string }
> = {
  missing: {
    Icon: UserMinus,
    iconWrap: 'bg-[#9A3D62] text-white',
  },
  near_reward: {
    Icon: Gift,
    iconWrap: 'bg-[var(--color-mostarda)] text-[var(--color-grafite)]',
  },
  high_value: {
    Icon: TrendingUp,
    iconWrap: 'bg-[var(--color-mostarda)] text-[var(--color-grafite)]',
  },
  quiet_hours: {
    Icon: Clock,
    iconWrap: 'bg-[#D4537E] text-white',
  },
  celebrate: {
    Icon: Heart,
    iconWrap: 'bg-[#F4A0B8] text-[#9A3D62]',
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
    campaignType: action.campaign?.suggestedType,
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
            title: 'Ainda estamos conhecendo o estabelecimento',
            body: 'Cada visita no balcão vira dado. Em pouco tempo o Frego aponta quem chamar de volta.',
            metric: { value: 0, format: 'count' as const },
          },
        ];

  return (
    <section
      className="relative mb-8 overflow-hidden rounded-[20px] border border-[#F6C2DE] bg-[linear-gradient(135deg,#9A3D62_0%,#D4537E_52%,#F4A0B8_100%)]"
      aria-labelledby="frego-intelligence-heading"
    >
      <span
        aria-hidden
        className="pointer-events-none absolute -right-10 -top-16 h-44 w-44 rounded-full bg-[var(--color-mostarda)] opacity-50 blur-3xl"
      />
      <header className="relative flex items-center gap-3 px-5 py-4 text-white">
        <span
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[12px] bg-[var(--color-mostarda)] text-[var(--color-grafite)]"
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
          <p className="mt-0.5 text-[12px] leading-snug text-white/85 md:text-[13px]">
            {data.intro ??
              'O que criar agora para subir o ticket e gerar a próxima visita.'}
          </p>
        </div>
      </header>

      <div
        className={`relative grid gap-3 px-4 pb-4 ${
          actions.length === 1 ? '' : 'sm:grid-cols-2'
        }`}
      >
        {actions.map((action) => {
          const theme = TONE[action.tone] ?? TONE.celebrate;
          const Icon =
            action.key === 'empty'
              ? Sparkles
              : action.key === 'one_visit'
                ? UserPlus
                : theme.Icon;
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
              {action.aim ? (
                <p className="mt-3 text-[11px] font-semibold uppercase tracking-[0.06em] text-[#A33B62]">
                  {action.aim}
                </p>
              ) : null}
              <h3
                className={`${action.aim ? 'mt-1' : 'mt-3'} text-[15px] font-semibold leading-snug tracking-[-0.02em] text-[var(--color-ink)]`}
              >
                {action.title}
              </h3>
              <p className="mt-1.5 flex-1 text-[13px] leading-relaxed text-[var(--color-neutral-500)]">
                {action.body}
              </p>
              <div className="mt-3.5 flex flex-wrap items-center gap-x-4 gap-y-2">
                <Link
                  href={primaryHref}
                  className="inline-flex min-h-10 items-center justify-center rounded-[12px] bg-[var(--color-mostarda)] px-3.5 text-[13px] font-semibold text-[var(--color-grafite)]"
                >
                  {primaryLabel}
                </Link>
                {canPeek && (
                  <Link
                    href={`/customers?${audienceRulesQuery(action.audience!.rules)}`}
                    className="text-[13px] font-semibold text-[#A33B62] hover:underline"
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
