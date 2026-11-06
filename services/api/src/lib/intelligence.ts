import { saleIdFromMeta, shouldOmitFromLedger } from './ledger-meta.js';
import type { AudienceRules } from './audience.js';

const TZ = 'America/Sao_Paulo';
const HOUR_START = 10;
const HOUR_END = 22;
const MIN_QUIET_EVENTS = 20;
const MIN_PURCHASES = 8;
const MIN_BELOW_TICKET = 3;
const MIN_ONE_VISIT = 5;
const MIN_VISITORS_FOR_HABIT = 8;

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

export type IntelligenceCampaignType =
  | 'stamps'
  | 'spend'
  | 'birthday'
  | 'cashback'
  | 'promo';

export type IntelligenceAction = {
  key: string;
  tone: IntelligenceTone;
  /** What the Campanha is for: raise the ticket, or create the next visit. */
  aim?: string;
  title: string;
  body: string;
  metric: IntelligenceMetric;
  audience?: { name: string; rules: AudienceRules };
  campaign?: {
    suggestedName: string;
    suggestedRewardTitle?: string;
    suggestedType?: IntelligenceCampaignType;
  };
};

export type IntelMember = {
  membershipId: string;
  visitDays: number;
};

export type IntelPurchase = {
  membershipId: string;
  amountCents: number;
};

/** How the Estabelecimento earns today. Promo and aniversário do not record a compra. */
export type IntelEarnKind = 'stamps' | 'points' | 'cashback';

export type IntelligencePayload = {
  periodLabel: string;
  /** What this Estabelecimento can act on. A carimbo house does not get a ticket pitch. */
  intro: string;
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

function zonedWeekday(d: Date, timeZone = TZ): number {
  const raw = new Intl.DateTimeFormat('en-US', {
    timeZone,
    weekday: 'short',
  })
    .format(d)
    .replace(/\./g, '')
    .slice(0, 3);
  return WEEKDAY_INDEX[raw] ?? d.getDay();
}

function zonedHour(d: Date, timeZone = TZ): number {
  const raw = new Intl.DateTimeFormat('en-US', {
    timeZone,
    hour: 'numeric',
    hourCycle: 'h23',
  }).format(d);
  const n = Number.parseInt(raw, 10);
  return Number.isFinite(n) ? n % 24 : d.getHours();
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
  if (day) return `${day} no estabelecimento`;
  if (part) return `${part[0]!.toUpperCase()}${part.slice(1)} no estabelecimento`;
  return 'Horário parado';
}

function formatBrl(cents: number) {
  return (cents / 100).toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    maximumFractionDigits: 0,
  });
}

function visitas(n: number) {
  return n === 1 ? '1 visita' : `${n} visitas`;
}

function clientes(n: number) {
  return n === 1 ? '1 cliente' : `${n} clientes`;
}

function emDia(day: string) {
  const lower = day.toLowerCase();
  if (lower === 'sábado' || lower === 'domingo') return `no ${lower}`;
  return `na ${lower}`;
}

function slotPhrase(
  weekday: number | null,
  hour: number | null,
  start = false,
) {
  const raw = weekday != null ? WEEKDAY_PT[weekday] : null;
  const day = raw ? (start ? raw : raw.toLowerCase()) : null;
  if (day && hour != null) return `${day} às ${hour}h`;
  if (day) return day;
  if (hour != null) return `${start ? 'Às' : 'às'} ${hour}h`;
  return start ? 'Esse horário' : 'esse horário';
}

const INTRO_AMOUNT =
  'O que criar agora para subir o ticket e gerar a próxima visita.';
const INTRO_VISITS = 'O que criar agora para gerar a próxima visita.';

/** Pontos and cashback record the compra. Carimbo records the visit. */
export function earnsAmount(kinds?: IntelEarnKind[]): boolean {
  if (!kinds) return true;
  return kinds.includes('points') || kinds.includes('cashback');
}

type PurchaseTx = {
  membershipId: string;
  type: string;
  unitKind?: string | null;
  amountCents?: number | null;
  metadata?: unknown;
};

/** One compra per sale. The bill on the earn wins over the cashback line of the same sale. */
export function collectPurchases(txs: PurchaseTx[]): IntelPurchase[] {
  const groups = new Map<string, PurchaseTx[]>();
  let lone = 0;
  for (const tx of txs) {
    if (shouldOmitFromLedger(tx.metadata)) continue;
    if (tx.type === 'redeem') continue;
    if (!tx.amountCents || tx.amountCents <= 0) continue;
    const saleId = saleIdFromMeta(tx.metadata);
    const key = saleId ?? `lone-${lone++}`;
    const list = groups.get(key) ?? [];
    list.push(tx);
    groups.set(key, list);
  }

  const purchases: IntelPurchase[] = [];
  for (const rows of groups.values()) {
    const bill = rows.find((tx) => tx.unitKind !== 'cashback_cents');
    const chosen = bill ?? rows.find((tx) => tx.unitKind === 'cashback_cents');
    if (!chosen?.amountCents) continue;
    purchases.push({
      membershipId: chosen.membershipId,
      amountCents: chosen.amountCents,
    });
  }
  return purchases;
}

/** Next R$ 5 step above the current average, so the prize asks for a bigger compra. */
function nextTicketTarget(avgCents: number) {
  const step = 500;
  const up = Math.ceil(avgCents / step) * step;
  return up > avgCents ? up : up + step;
}

type QuietSlot = {
  weekday: number | null;
  hour: number | null;
  visits: number;
  peakVisits: number;
  peakWeekday: number | null;
  peakHour: number | null;
};

function analyzeQuietSlot(txs: TxLite[], timeZone: string): QuietSlot | null {
  const inWindow = txs.filter((tx) => {
    if (shouldOmitFromLedger(tx.metadata)) return false;
    const h = zonedHour(tx.createdAt, timeZone);
    return h >= HOUR_START && h <= HOUR_END;
  });
  if (inWindow.length < MIN_QUIET_EVENTS) return null;

  const cells = new Map<string, { weekday: number; hour: number; n: number }>();
  for (const tx of inWindow) {
    const weekday = zonedWeekday(tx.createdAt, timeZone);
    const hour = zonedHour(tx.createdAt, timeZone);
    const key = `${weekday}:${hour}`;
    const row = cells.get(key) ?? { weekday, hour, n: 0 };
    row.n += 1;
    cells.set(key, row);
  }
  let minCell: { weekday: number; hour: number; n: number } | null = null;
  let maxCell: { weekday: number; hour: number; n: number } | null = null;
  for (const cell of cells.values()) {
    if (!minCell || cell.n < minCell.n) minCell = cell;
    if (!maxCell || cell.n > maxCell.n) maxCell = cell;
  }
  if (
    minCell &&
    maxCell &&
    maxCell.n >= 8 &&
    minCell.n < maxCell.n &&
    minCell.n <= maxCell.n * 0.5
  ) {
    return {
      weekday: minCell.weekday,
      hour: minCell.hour,
      visits: minCell.n,
      peakVisits: maxCell.n,
      peakWeekday: maxCell.weekday,
      peakHour: maxCell.hour,
    };
  }

  const byDow = new Array<number>(7).fill(0);
  for (const tx of inWindow) {
    byDow[zonedWeekday(tx.createdAt, timeZone)] += 1;
  }
  let quietWeekday: number | null = null;
  let min = Infinity;
  let max = 0;
  let peakWeekday = 0;
  for (let i = 0; i < 7; i++) {
    if (byDow[i]! === 0) continue;
    if (byDow[i]! > max) {
      max = byDow[i]!;
      peakWeekday = i;
    }
    if (byDow[i]! < min) {
      min = byDow[i]!;
      quietWeekday = i;
    }
  }
  const weekdaySlot: QuietSlot | null =
    quietWeekday != null && max > 0 && min < max * 0.85
      ? {
          weekday: quietWeekday,
          hour: null,
          visits: byDow[quietWeekday]!,
          peakVisits: max,
          peakWeekday,
          peakHour: null,
        }
      : null;

  const byHour = new Map<number, number>();
  for (const tx of inWindow) {
    const h = zonedHour(tx.createdAt, timeZone);
    byHour.set(h, (byHour.get(h) ?? 0) + 1);
  }
  let quietHour: number | null = null;
  let minH = Infinity;
  let maxH = 0;
  let peakHour = 0;
  for (const [h, n] of byHour) {
    if (n > maxH) {
      maxH = n;
      peakHour = h;
    }
    if (n < minH) {
      minH = n;
      quietHour = h;
    }
  }
  const hourSlot: QuietSlot | null =
    quietHour != null && maxH > 0 && minH < maxH * 0.85
      ? {
          weekday: null,
          hour: quietHour,
          visits: minH,
          peakVisits: maxH,
          peakWeekday: null,
          peakHour,
        }
      : null;

  if (weekdaySlot && hourSlot) {
    const dayRatio = weekdaySlot.visits / weekdaySlot.peakVisits;
    const hourRatio = hourSlot.visits / hourSlot.peakVisits;
    return dayRatio <= hourRatio ? weekdaySlot : hourSlot;
  }
  return weekdaySlot ?? hourSlot;
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
  const allSpend = spenders.reduce((s, a) => s + a.spendCents, 0);
  const share = allSpend > 0 ? Math.round((spendSum / allSpend) * 100) : 0;
  const shareLine =
    share >= 40 && share < 100
      ? `Eles concentram ${share}% do gasto com valor. `
      : '';
  return {
    key: 'high_value',
    tone: 'high_value',
    aim: 'Segura o ticket',
    title:
      count === 1
        ? 'O melhor cliente nos últimos 90 dias'
        : `Os ${count} que mais gastaram nos últimos 90 dias`,
    body: `${shareLine}Uma campanha só para ${count === 1 ? 'essa pessoa' : 'eles'} traz de novo a visita que segura o gasto do estabelecimento.`,
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
      suggestedName: 'Obrigado, estabelecimento',
      suggestedRewardTitle: 'Prêmio para quem mais gasta',
      suggestedType: 'promo',
    },
  };
}

function ticketAction(
  members: IntelMember[],
  purchases: IntelPurchase[],
): IntelligenceAction | null {
  const priced = purchases.filter((p) => p.amountCents > 0);
  if (priced.length < MIN_PURCHASES) return null;

  const total = priced.reduce((s, p) => s + p.amountCents, 0);
  const avg = Math.round(total / priced.length);
  const visits = new Map(members.map((m) => [m.membershipId, m.visitDays]));
  const byMember = new Map<string, { cents: number; n: number }>();
  for (const purchase of priced) {
    const row = byMember.get(purchase.membershipId) ?? { cents: 0, n: 0 };
    row.cents += purchase.amountCents;
    row.n += 1;
    byMember.set(purchase.membershipId, row);
  }

  let belowCents = 0;
  let belowN = 0;
  let belowPeople = 0;
  for (const [id, row] of byMember) {
    if (row.n < 2) continue;
    if ((visits.get(id) ?? 0) < 2) continue;
    if (row.cents / row.n > avg * 0.8) continue;
    belowCents += row.cents;
    belowN += row.n;
    belowPeople += 1;
  }
  if (belowPeople < MIN_BELOW_TICKET || belowN === 0) return null;
  const belowAvg = Math.round(belowCents / belowN);
  if (avg - belowAvg < 500) return null;

  const target = nextTicketTarget(avg);
  const targetLabel = formatBrl(target);
  return {
    key: 'ticket',
    tone: 'high_value',
    aim: 'Sobe o ticket',
    title: `Ticket médio de ${formatBrl(avg)}`,
    body: `${clientes(belowPeople)} que já voltam gastam cerca de ${formatBrl(belowAvg)} por compra, em ${priced.length} compras. Uma promoção na compra acima de ${targetLabel} dá motivo para acrescentar um item.`,
    metric: { value: avg, format: 'money' },
    campaign: {
      suggestedName: `Compra acima de ${targetLabel}`,
      suggestedRewardTitle: `Prêmio na compra acima de ${targetLabel}`,
      suggestedType: 'promo',
    },
  };
}

function oneVisitAction(members: IntelMember[]): IntelligenceAction | null {
  if (members.length < MIN_VISITORS_FOR_HABIT) return null;
  const n = members.filter((m) => m.visitDays === 1).length;
  if (n < MIN_ONE_VISIT || n / members.length < 0.4) return null;

  return {
    key: 'one_visit',
    tone: 'missing',
    aim: 'Nova visita',
    title:
      n === 1
        ? '1 cliente veio só uma vez'
        : `${n} clientes vieram só uma vez`,
    body: 'Uma única visita nos últimos 90 dias. Um prêmio na segunda visita cria a próxima ida, antes de virar sumiço.',
    metric: { value: n, format: 'count' },
    audience: {
      name: 'Veio uma vez',
      rules: {
        version: 1,
        visitsMax: 1,
        windowDays: INTEL_LOOKBACK_DAYS,
      },
    },
    campaign: {
      suggestedName: 'Segunda visita',
      suggestedRewardTitle: 'Prêmio da segunda visita',
      suggestedType: 'promo',
    },
  };
}

/** Carimbo house: the useful "best clientes" signal is how often they come back. */
function regularsAction(members: IntelMember[]): IntelligenceAction | null {
  const ranked = members
    .filter((member) => member.visitDays >= 4)
    .sort((a, b) => b.visitDays - a.visitDays);
  if (ranked.length < 3) return null;

  const top = ranked.slice(0, Math.min(10, ranked.length));
  const visitsMin = top[top.length - 1]!.visitDays;
  const matched = ranked.filter((member) => member.visitDays >= visitsMin);
  if (members.length > 0 && matched.length / members.length > 0.85) return null;

  const n = matched.length;
  return {
    key: 'regulars',
    tone: 'high_value',
    aim: 'Nova visita',
    title:
      n === 1
        ? 'Quem mais voltou nos últimos 90 dias'
        : `Os ${n} que mais voltaram nos últimos 90 dias`,
    body: 'Aqui o carimbo mede a visita. Uma campanha só para quem já volta com frequência segura a próxima ida.',
    metric: { value: n, format: 'count' },
    audience: {
      name: 'Quem mais volta',
      rules: {
        version: 1,
        visitsMin,
        windowDays: INTEL_LOOKBACK_DAYS,
      },
    },
    campaign: {
      suggestedName: 'Quem sempre volta',
      suggestedRewardTitle: 'Prêmio de quem volta sempre',
      suggestedType: 'promo',
    },
  };
}

function quietHoursAction(txs: TxLite[], timeZone: string): IntelligenceAction | null {
  const slot = analyzeQuietSlot(txs, timeZone);
  if (!slot) return null;

  const dayName = slot.weekday != null ? WEEKDAY_PT[slot.weekday] : null;
  const hour = slot.hour;
  let title: string;
  if (dayName && hour != null) {
    title = `${dayName} às ${hour}h é o buraco do estabelecimento`;
  } else if (dayName) {
    title = `${dayName} é o dia mais parado`;
  } else {
    title = `${hour}h é o buraco do dia`;
  }

  const here = slotPhrase(slot.weekday, hour, true);
  const peak = slotPhrase(slot.peakWeekday, slot.peakHour);
  return {
    key: 'quiet_hours',
    tone: 'quiet_hours',
    aim: 'Nova visita',
    title,
    body: `${here} teve ${visitas(slot.visits)}. No pico, ${peak} teve ${visitas(slot.peakVisits)}. Uma campanha nesse horário puxa visita para onde o estabelecimento esvazia.`,
    metric: { value: slot.visits, format: 'count' },
    campaign: {
      suggestedName: campaignSlotName(slot.weekday, hour),
      suggestedRewardTitle: dayName
        ? `Vem ${emDia(dayName)}`
        : hour != null
          ? `Vem às ${hour}h`
          : 'Vem nesse horário',
      suggestedType: 'promo',
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
  members?: IntelMember[];
  purchases?: IntelPurchase[];
  earnKinds?: IntelEarnKind[];
  timeZone?: string;
}): IntelligencePayload {
  const { inactiveCount, current } = input;
  const timeZone = input.timeZone ?? TZ;
  const periodLabel = INTEL_PERIOD_LABEL;
  const amountRelevant = earnsAmount(input.earnKinds);
  const candidates: IntelligenceAction[] = [];

  const ticket = amountRelevant
    ? ticketAction(input.members ?? [], input.purchases ?? [])
    : null;
  if (ticket) candidates.push(ticket);

  const once = oneVisitAction(input.members ?? []);
  if (once) candidates.push(once);

  if (inactiveCount > 0 && input.totalMembers > 0) {
    candidates.push({
      key: 'missing',
      tone: 'missing',
      aim: 'Nova visita',
      title:
        inactiveCount === 1
          ? '1 cliente sumiu há 30 dias ou mais'
          : `${inactiveCount} clientes sumiram há 30 dias ou mais`,
      body: 'Cada um já visitou o estabelecimento. Uma campanha de volta transforma esse sumiço na próxima ida.',
      metric: { value: inactiveCount, format: 'count' },
      audience: {
        name: 'Quem sumiu',
        rules: {
          version: 1,
          inactiveDaysMin: INTEL_INACTIVE_DAYS,
        },
      },
      campaign: {
        suggestedName: 'Volta ao estabelecimento',
        suggestedRewardTitle: 'Prêmio para quem volta',
        suggestedType: 'promo',
      },
    });
  }

  const quiet = quietHoursAction(input.txs, timeZone);
  if (quiet) candidates.push(quiet);

  if (input.nearRewardCount > 0 && input.hasRewardCampaign) {
    const n = input.nearRewardCount;
    candidates.push({
      key: 'near_reward',
      tone: 'near_reward',
      aim: 'Nova visita',
      title:
        n === 1
          ? '1 cliente está a um passo do prêmio'
          : `${n} clientes estão a um passo do prêmio`,
      body: 'Falta pouco para o prêmio. Uma campanha agora é o motivo da visita que fecha o ciclo.',
      metric: { value: n, format: 'count' },
      audience: {
        name: 'Quase prêmio',
        rules: { version: 1, nearReward: true },
      },
      campaign: {
        suggestedName: 'Quase lá',
        suggestedRewardTitle: 'Seu prêmio está perto',
        suggestedType: 'promo',
      },
    });
  }

  if (input.vipQuietCount > 0) {
    const n = input.vipQuietCount;
    candidates.push({
      key: 'vip_quiet',
      tone: 'missing',
      aim: 'Nova visita',
      title:
        n === 1
          ? '1 VIP sumiu há 30 dias ou mais'
          : `${n} VIPs sumiram há 30 dias ou mais`,
      body: 'Quem você marcou como VIP já sustentou o estabelecimento. Um convite só para eles traz essa visita de volta.',
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
        suggestedType: 'promo',
      },
    });
  }

  const highValue = amountRelevant ? highValueAction(current.spenders) : null;
  if (highValue) candidates.push(highValue);

  const regulars = amountRelevant ? null : regularsAction(input.members ?? []);
  if (regulars) candidates.push(regulars);

  const celebrate: IntelligenceAction | null =
    current.returning > 0
      ? {
          key: 'celebrate',
          tone: 'celebrate',
          aim: 'Nova visita',
          title:
            current.returning === 1
              ? '1 cliente voltou nos últimos 90 dias'
              : `${current.returning} clientes voltaram nos últimos 90 dias`,
          body: 'Já voltaram nos últimos 90 dias. Uma campanha para eles transforma o hábito em mais uma visita.',
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
            suggestedType: 'promo',
          },
        }
      : null;

  const empty: IntelligenceAction = {
    key: 'empty',
    tone: 'celebrate',
    title: 'Ainda estamos conhecendo o estabelecimento',
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

  return {
    periodLabel,
    intro: amountRelevant ? INTRO_AMOUNT : INTRO_VISITS,
    actions: actions.slice(0, 4),
  };
}
