import { shouldOmitFromLedger } from './ledger-meta.js';
import type { AudienceRules } from './audience.js';

const TZ = 'America/Sao_Paulo';
const HOUR_START = 10;
const HOUR_END = 22;
const MIN_QUIET_EVENTS = 20;

/** Fixed windows — not the Painel date picker. Retention needs a long look. */
export const INTEL_LOOKBACK_DAYS = 90;
export const INTEL_INACTIVE_DAYS = 30;
export const INTEL_PERIOD_LABEL = 'nos últimos 90 dias';

const WEEKDAY_PT = [
  'Domingo',
  'Segunda',
  'Terça',
  'Quarta',
  'Quinta',
  'Sexta',
  'Sábado',
] as const;

const WEEKDAY_INDEX: Record<string, number> = {
  Sun: 0,
  Mon: 1,
  Tue: 2,
  Wed: 3,
  Thu: 4,
  Fri: 5,
  Sat: 6,
};

export type IntelligenceTone =
  | 'missing'
  | 'near_reward'
  | 'high_value'
  | 'quiet_hours'
  | 'celebrate';

export type IntelligenceMetric = {
  value: number;
  format: 'count' | 'money' | 'hour';
  /** When set, the UI shows this instead of formatting `value`. */
  label?: string;
};

export type IntelligenceAction = {
  key: string;
  tone: IntelligenceTone;
  title: string;
  body: string;
  metric: IntelligenceMetric;
  audience?: { name: string; rules: AudienceRules };
  campaign?: { suggestedName: string; suggestedRewardTitle?: string };
};

export type IntelligencePayload = {
  periodLabel: string;
  actions: IntelligenceAction[];
};

type PeriodSummary = {
  customers: number;
  returning: number;
  spenders: { spendCents: number }[];
};

type TxLite = {
  createdAt: Date;
  metadata?: unknown;
};

const weekdayFmt = new Intl.DateTimeFormat('en-US', {
  timeZone: TZ,
  weekday: 'short',
});

const hourFmt = new Intl.DateTimeFormat('en-US', {
  timeZone: TZ,
  hour: 'numeric',
  hourCycle: 'h23',
});

function zonedWeekday(d: Date): number {
  const raw = weekdayFmt.format(d).replace(/\./g, '').slice(0, 3);
  return WEEKDAY_INDEX[raw] ?? d.getDay();
}

function zonedHour(d: Date): number {
  const n = Number.parseInt(hourFmt.format(d), 10);
  return Number.isFinite(n) ? n : d.getHours();
}

export function periodLabelFor(): string {
  return INTEL_PERIOD_LABEL;
}

function partOfDay(hour: number): string {
  if (hour < 12) return 'manhã';
  if (hour < 15) return 'almoço';
  if (hour < 18) return 'tarde';
  return 'noite';
}

function campaignSlotName(weekday: number | null, hour: number | null): string {
  const day = weekday != null ? WEEKDAY_PT[weekday] : null;
  const part = hour != null ? partOfDay(hour) : null;
  if (day && part) return `${day} à ${part}`;
  if (day) return `${day} na casa`;
  if (part) return `${part[0]!.toUpperCase()}${part.slice(1)} na casa`;
  return 'Horário parado';
}

function analyzeQuietSlot(txs: TxLite[]) {
  const inWindow = txs.filter((tx) => {
    if (shouldOmitFromLedger(tx.metadata)) return false;
    const h = zonedHour(tx.createdAt);
    return h >= HOUR_START && h <= HOUR_END;
  });
  if (inWindow.length < MIN_QUIET_EVENTS) return null;

  let quietWeekday: number | null = null;
  const byDow = new Array<number>(7).fill(0);
  for (const tx of inWindow) {
    byDow[zonedWeekday(tx.createdAt)] += 1;
  }
  let min = Infinity;
  let max = 0;
  let idx: number | null = null;
  for (let i = 0; i < 7; i++) {
    if (byDow[i]! === 0) continue;
    max = Math.max(max, byDow[i]!);
    if (byDow[i]! < min) {
      min = byDow[i]!;
      idx = i;
    }
  }
  if (max > 0 && min < max * 0.85) quietWeekday = idx;

  const seenHours = new Set<number>();
  for (const tx of inWindow) {
    const h = zonedHour(tx.createdAt);
    if (h >= HOUR_START && h <= HOUR_END) seenHours.add(h);
  }

  const byHour = new Map<number, number>();
  for (const h of seenHours) byHour.set(h, 0);
  for (const tx of inWindow) {
    const h = zonedHour(tx.createdAt);
    if (byHour.has(h)) {
      byHour.set(h, (byHour.get(h) ?? 0) + 1);
    }
  }

  let quietHour: number | null = null;
  let minH = Infinity;
  let maxH = 0;
  for (const [h, n] of byHour) {
    maxH = Math.max(maxH, n);
    if (n < minH) {
      minH = n;
      quietHour = h;
    }
  }
  if (maxH === 0 || (quietHour != null && minH >= maxH * 0.85)) {
    quietHour = null;
  }

  if (quietWeekday == null && quietHour == null) return null;
  return { weekday: quietWeekday, hour: quietHour };
}

function highValueAction(
  spendersIn: { spendCents: number }[],
): IntelligenceAction | null {
  const spenders = [...spendersIn]
    .filter((a) => a.spendCents > 0)
    .sort((a, b) => b.spendCents - a.spendCents);
  if (spenders.length === 0) return null;

  const topN = spenders.slice(0, Math.min(10, spenders.length));
  const cutoffRaw = topN[topN.length - 1]!.spendCents;
  const rounded = Math.floor(cutoffRaw / 5_000) * 5_000;
  const spendCentsMin = Math.max(100, rounded || cutoffRaw);
  const matched = spenders.filter((s) => s.spendCents >= spendCentsMin);
  const spendSum = matched.reduce((s, a) => s + a.spendCents, 0);
  if (spendSum <= 0) return null;

  const count = matched.length;
  return {
    key: 'high_value',
    tone: 'high_value',
    title:
      count === 1
        ? 'O melhor cliente nos últimos 90 dias'
        : `Os ${count} que mais gastaram nos últimos 90 dias`,
    body:
      count === 1
        ? 'Reconheça quem segura a casa. Uma campanha só para essa pessoa rende carinho — e mais visitas.'
        : 'Reconheça quem segura a casa. Uma campanha só para eles rende carinho — e mais visitas.',
    metric: { value: spendSum, format: 'money' },
    audience: {
      name: 'Quem mais gastou',
      rules: {
        version: 1,
        spendCentsMin,
        windowDays: INTEL_LOOKBACK_DAYS,
      },
    },
    campaign: {
      suggestedName: 'Obrigado, casa',
      suggestedRewardTitle: 'Prêmio para quem mais gasta',
    },
  };
}

function quietHoursAction(txs: TxLite[]): IntelligenceAction | null {
  const slot = analyzeQuietSlot(txs);
  if (!slot) return null;

  const dayName = slot.weekday != null ? WEEKDAY_PT[slot.weekday] : null;
  const hour = slot.hour;
  let title: string;
  if (dayName && hour != null) {
    title = `${dayName} às ${hour}h é o buraco da casa`;
  } else if (dayName) {
    title = `${dayName} é o dia mais parado`;
  } else {
    title = `${hour}h é o buraco do dia`;
  }

  return {
    key: 'quiet_hours',
    tone: 'quiet_hours',
    title,
    body: 'A casa esvazia nesse horário. Uma campanha com convite combinado enche essa faixa.',
    metric: {
      value: hour ?? slot.weekday ?? 0,
      format: hour != null ? 'hour' : 'count',
      label: hour == null && dayName ? dayName : undefined,
    },
    campaign: {
      suggestedName: campaignSlotName(slot.weekday, hour),
      suggestedRewardTitle: dayName
        ? `Vem na ${dayName.toLowerCase()}`
        : 'Vem nesse horário',
    },
  };
}

export function buildIntelligence(input: {
  totalMembers: number;
  inactiveCount: number;
  current: PeriodSummary;
  nearRewardCount: number;
  hasRewardCampaign: boolean;
  vipQuietCount: number;
  txs: TxLite[];
}): IntelligencePayload {
  const { inactiveCount, current } = input;
  const periodLabel = INTEL_PERIOD_LABEL;
  const candidates: IntelligenceAction[] = [];

  if (inactiveCount > 0 && input.totalMembers > 0) {
    candidates.push({
      key: 'missing',
      tone: 'missing',
      title:
        inactiveCount === 1
          ? '1 cliente sumiu há 30 dias ou mais'
          : `${inactiveCount} clientes sumiram há 30 dias ou mais`,
      body: 'Eles já vieram na casa e não apareceram. Um convite agora traz de volta.',
      metric: { value: inactiveCount, format: 'count' },
      audience: {
        name: 'Quem sumiu',
        rules: {
          version: 1,
          inactiveDaysMin: INTEL_INACTIVE_DAYS,
        },
      },
      campaign: {
        suggestedName: 'Volta pra casa',
        suggestedRewardTitle: 'Prêmio para quem volta',
      },
    });
  }

  if (input.vipQuietCount > 0) {
    const n = input.vipQuietCount;
    candidates.push({
      key: 'vip_quiet',
      tone: 'missing',
      title:
        n === 1
          ? '1 VIP sumiu há 30 dias ou mais'
          : `${n} VIPs sumiram há 30 dias ou mais`,
      body: 'Quem você marcou como VIP merece um convite especial para voltar.',
      metric: { value: n, format: 'count' },
      audience: {
        name: 'VIPs quietos',
        rules: {
          version: 1,
          isVip: true,
          inactiveDaysMin: INTEL_INACTIVE_DAYS,
        },
      },
      campaign: {
        suggestedName: 'VIP de volta',
        suggestedRewardTitle: 'Prêmio VIP',
      },
    });
  }

  if (input.nearRewardCount > 0 && input.hasRewardCampaign) {
    const n = input.nearRewardCount;
    candidates.push({
      key: 'near_reward',
      tone: 'near_reward',
      title:
        n === 1
          ? '1 cliente está a um passo do prêmio'
          : `${n} clientes estão a um passo do prêmio`,
      body: 'Um empurrãozinho agora — eles voltam para fechar o ciclo.',
      metric: { value: n, format: 'count' },
      audience: {
        name: 'Quase prêmio',
        rules: { version: 1, nearReward: true },
      },
      campaign: {
        suggestedName: 'Quase lá',
        suggestedRewardTitle: 'Seu prêmio está perto',
      },
    });
  }

  const highValue = highValueAction(current.spenders);
  if (highValue) candidates.push(highValue);

  const quiet = quietHoursAction(input.txs);
  if (quiet) candidates.push(quiet);

  const celebrate: IntelligenceAction | null =
    current.returning > 0
      ? {
          key: 'celebrate',
          tone: 'celebrate',
          title:
            current.returning === 1
              ? '1 cliente voltou nos últimos 90 dias'
              : `${current.returning} clientes voltaram nos últimos 90 dias`,
          body: 'Vieram mais de uma vez. Uma campanha para eles reforça o hábito.',
          metric: { value: current.returning, format: 'count' },
          audience: {
            name: 'Quem voltou',
            rules: {
              version: 1,
              visitsMin: 2,
              windowDays: INTEL_LOOKBACK_DAYS,
            },
          },
          campaign: {
            suggestedName: 'Vem sempre',
            suggestedRewardTitle: 'Prêmio de quem volta',
          },
        }
      : null;

  const empty: IntelligenceAction = {
    key: 'empty',
    tone: 'celebrate',
    title: 'Ainda estamos conhecendo a casa',
    body: 'Cada visita no balcão vira dado. Em pouco tempo o Frego aponta quem chamar de volta.',
    metric: { value: 0, format: 'count' },
  };

  let actions = candidates.slice(0, 4);
  if (actions.length === 0) {
    actions = celebrate ? [celebrate, empty] : [empty];
  } else if (actions.length === 1) {
    if (celebrate && celebrate.key !== actions[0]!.key) {
      actions.push(celebrate);
    } else {
      actions.push(empty);
    }
  }

  return { periodLabel, actions: actions.slice(0, 4) };
}
