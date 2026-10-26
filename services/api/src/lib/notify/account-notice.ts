import { addCivilDays, ymdInSaoPaulo } from '../promo.js';
import type { WalletLot } from '../wallet.js';

/** Days before the date, inclusive of the date itself, that open a reminder. */
export const ACCOUNT_NOTICE_WINDOW_DAYS = 7;

export type ExpiryNotice = {
  keySuffix: string;
  unitKind: WalletLot['unitKind'];
  quantity: number;
  expiresAt: string;
  daysLeft: number;
  destinationLabel: string | null;
};

export type EndingCampaignNotice = {
  campaignId: string;
  campaignName: string;
  endsOn: string;
  daysLeft: number;
  /** She can Resgatar today. False means a later day in the Promoção still opens it. */
  ready: boolean;
};

export function civilDaysBetween(fromYmd: string, toYmd: string): number {
  const [y1, m1, d1] = fromYmd.split('-').map(Number);
  const [y2, m2, d2] = toYmd.split('-').map(Number);
  const a = Date.UTC(y1!, (m1 ?? 1) - 1, d1 ?? 1);
  const b = Date.UTC(y2!, (m2 ?? 1) - 1, d2 ?? 1);
  return Math.round((b - a) / 86_400_000);
}

export function expiryNoticeKey(membershipId: string, keySuffix: string): string {
  return `expiry:${membershipId}:${keySuffix}`;
}

export function campaignNoticeKey(
  membershipId: string,
  campaignId: string,
  endsOn: string,
): string {
  return `campaign_end:${membershipId}:${campaignId}:${endsOn}`;
}

/**
 * Lots whose remaining balance expires inside the window.
 * Same wallet, date, and Cartela collapse into one line.
 */
export function collectExpiryNotices(
  lots: WalletLot[],
  windowDays = ACCOUNT_NOTICE_WINDOW_DAYS,
): ExpiryNotice[] {
  const grouped = new Map<string, ExpiryNotice>();
  for (const lot of lots) {
    if (!lot.expiresAt || lot.daysLeft == null || lot.quantity <= 0) continue;
    if (lot.daysLeft < 0 || lot.daysLeft > windowDays) continue;
    const label = lot.destinationLabel?.trim() || null;
    const keySuffix = `${lot.unitKind}:${lot.expiresAt}:${label ?? ''}`;
    const existing = grouped.get(keySuffix);
    if (existing) {
      existing.quantity += lot.quantity;
      continue;
    }
    grouped.set(keySuffix, {
      keySuffix,
      unitKind: lot.unitKind,
      quantity: lot.quantity,
      expiresAt: lot.expiresAt,
      daysLeft: lot.daysLeft,
      destinationLabel: label,
    });
  }
  return [...grouped.values()].sort(
    (a, b) =>
      a.expiresAt.localeCompare(b.expiresAt) ||
      a.unitKind.localeCompare(b.unitKind) ||
      (a.destinationLabel ?? '').localeCompare(b.destinationLabel ?? ''),
  );
}

function canStillReach(
  unlocksAt: string | null | undefined,
  endsOn: string,
): boolean {
  return Boolean(unlocksAt && unlocksAt <= endsOn);
}

/**
 * Promoção ending inside the window that she can Resgatar now,
 * or can still reach before the last day.
 * A weekday or a quota that opens again in time counts as close.
 * An Audiência she is outside, an open voucher, or a quota that does not return does not.
 */
export function collectEndingCampaigns(
  campaigns: Array<{
    campaignId: string;
    campaignName: string;
    type: string;
    canRedeem: boolean;
    endsOn?: string | null;
    lockedReason?: string | null;
    unlocksAt?: string | null;
    audienceEligible?: boolean | null;
  }>,
  todayYmd: string,
  windowDays = ACCOUNT_NOTICE_WINDOW_DAYS,
): EndingCampaignNotice[] {
  const out: EndingCampaignNotice[] = [];
  for (const campaign of campaigns) {
    if (campaign.type !== 'promo' || !campaign.endsOn) continue;
    if (campaign.audienceEligible === false) continue;
    const daysLeft = civilDaysBetween(todayYmd, campaign.endsOn);
    if (daysLeft < 0 || daysLeft > windowDays) continue;
    const ready = campaign.canRedeem;
    const soon =
      !ready &&
      (campaign.lockedReason === 'wrong_weekday' ||
        campaign.lockedReason === 'quota_exhausted') &&
      canStillReach(campaign.unlocksAt, campaign.endsOn);
    if (!ready && !soon) continue;
    out.push({
      campaignId: campaign.campaignId,
      campaignName: campaign.campaignName.trim() || 'Campanha',
      endsOn: campaign.endsOn,
      daysLeft,
      ready,
    });
  }
  return out.sort(
    (a, b) =>
      a.endsOn.localeCompare(b.endsOn) ||
      a.campaignName.localeCompare(b.campaignName),
  );
}

function formatBrl(cents: number): string {
  const abs = Math.abs(Math.trunc(cents));
  const reais = Math.floor(abs / 100);
  const frac = String(abs % 100).padStart(2, '0');
  const grouped = reais.toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  return `R$ ${grouped},${frac}`;
}

function whenPhrase(daysLeft: number): string {
  if (daysLeft <= 0) return 'hoje';
  if (daysLeft === 1) return 'amanhã';
  return `em ${daysLeft} dias`;
}

function expiryClause(item: ExpiryNotice): string {
  const when = whenPhrase(item.daysLeft);
  if (item.unitKind === 'cashback_cents') {
    return `${formatBrl(item.quantity)} de cashback vence ${when}`;
  }
  if (item.unitKind === 'points') {
    const noun = item.quantity === 1 ? 'ponto' : 'pontos';
    const verb = item.quantity === 1 ? 'vence' : 'vencem';
    return `${item.quantity} ${noun} ${verb} ${when}`;
  }
  const noun = item.quantity === 1 ? 'carimbo' : 'carimbos';
  const verb = item.quantity === 1 ? 'vence' : 'vencem';
  const place =
    item.destinationLabel && item.destinationLabel !== 'Carimbos'
      ? ` de ${item.destinationLabel}`
      : '';
  return `${item.quantity} ${noun}${place} ${verb} ${when}`;
}

export function expiryDetail(items: ExpiryNotice[]): string {
  return `${items.map(expiryClause).join('. ')}.`;
}

export function campaignEndingDetail(items: EndingCampaignNotice[]): string {
  const ordered = [...items].sort(
    (a, b) =>
      a.endsOn.localeCompare(b.endsOn) ||
      a.campaignName.localeCompare(b.campaignName),
  );
  const lines = ordered.map(
    (item) => `${item.campaignName} encerra ${whenPhrase(item.daysLeft)}`,
  );
  const anyReady = ordered.some((item) => item.ready);
  const anySoon = ordered.some((item) => !item.ready);
  const tail = anyReady
    ? anySoon
      ? 'O resgate está disponível, e nas outras ainda dá tempo.'
      : 'O resgate está disponível.'
    : 'Ainda dá tempo de resgatar.';
  return `${lines.join('. ')}. ${tail}`;
}

export function accountNoticeCopy(businessName: string, detail: string) {
  const title = (businessName.trim() || 'Frego').slice(0, 60);
  const body = detail.trim().slice(0, 180);
  return { title, body };
}

export type ChannelAttempt = {
  sent: boolean;
  skipped?: string;
  error?: string;
};

const PUSH_SETTLED = new Set([
  'notifications_disabled',
  'no_device_tokens',
  'customer_not_found',
]);

const WHATSAPP_SETTLED = new Set([
  'not_connected',
  'no_phones',
  'invalid_phone',
]);

/** Next 10:00 in America/Sao_Paulo. Brazil has no daylight saving. */
export function msUntilNextReminder(now = new Date()): number {
  const ymd = ymdInSaoPaulo(now);
  const time = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'America/Sao_Paulo',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(now);
  const hour = Number(time.find((part) => part.type === 'hour')?.value ?? '0');
  const minute = Number(
    time.find((part) => part.type === 'minute')?.value ?? '0',
  );
  const second = Number(
    time.find((part) => part.type === 'second')?.value ?? '0',
  );
  const past = hour > 10 || (hour === 10 && (minute > 0 || second > 0));
  const targetYmd = past ? addCivilDays(ymd, 1) : ymd;
  const target = new Date(`${targetYmd}T10:00:00-03:00`);
  return Math.max(1_000, target.getTime() - now.getTime());
}

/** sent and permanent skips stay claimed. A template still in review can retry. */
export function channelSettled(
  channel: 'push' | 'whatsapp',
  attempt: ChannelAttempt,
): 'sent' | 'skipped' | 'retry' {
  if (attempt.sent) return 'sent';
  const done = channel === 'push' ? PUSH_SETTLED : WHATSAPP_SETTLED;
  if (attempt.skipped && done.has(attempt.skipped) && !attempt.error) {
    return 'skipped';
  }
  return 'retry';
}
