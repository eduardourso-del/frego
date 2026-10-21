import type { WalletSnapshot } from '../wallet.js';
import { earnBurstLine, type EarnNotifyInput } from './earn-message.js';

/** Quiet window. A later earn of the same burst pushes the send out again. */
export const EARN_NOTIFY_QUIET_MS = 10_000;

/**
 * When the flush runs after the last earn.
 * Later than the quiet window so the row is already due, and inside the
 * 10–15s the customer should wait.
 */
export const EARN_NOTIFY_FLUSH_DELAY_MS = 13_000;

export type EarnHoldPart = {
  saleId: string | null;
  transactionId: string | null;
  unitKind: EarnNotifyInput['unitKind'];
  quantity: number;
  amountCents: number | null;
  cashbackCents: number | null;
  stampLabel: string | null;
  pesquisa: NonNullable<EarnNotifyInput['pesquisa']> | null;
};

/** What one WhatsApp and one push will say once the quiet window ends. */
export type EarnNotifyHoldPayload = {
  businessId: string;
  businessName: string;
  customerId: string;
  toE164: string;
  unitKind: EarnNotifyInput['unitKind'];
  wallet: WalletSnapshot;
  stampEarn: NonNullable<EarnNotifyInput['stampEarn']> | null;
  parts: EarnHoldPart[];
  /** Set once this hold has been handed to WhatsApp and push. */
  sentAt?: string;
};

function partFromInput(input: EarnNotifyInput): EarnHoldPart {
  return {
    saleId: input.saleId ?? null,
    transactionId: input.transactionId ?? null,
    unitKind: input.unitKind,
    quantity: input.quantity,
    amountCents: input.amountCents ?? null,
    cashbackCents: input.cashbackCents ?? null,
    stampLabel:
      input.unitKind === 'stamps' ? (input.stampEarn?.label ?? null) : null,
    pesquisa: input.pesquisa ?? null,
  };
}

/** A hold that already went out must not be folded into the next earn. */
export function activeHold(
  payload: EarnNotifyHoldPayload | null,
): EarnNotifyHoldPayload | null {
  if (!payload || payload.sentAt) return null;
  return payload;
}

export function payloadFromInput(input: EarnNotifyInput): EarnNotifyHoldPayload {
  return {
    businessId: input.businessId,
    businessName: input.businessName,
    customerId: input.customerId,
    toE164: input.toE164,
    unitKind: input.unitKind,
    wallet: input.wallet,
    stampEarn: input.stampEarn ?? null,
    parts: [partFromInput(input)],
  };
}

/**
 * Fold `incoming` into the open hold.
 * Carimbos, pontos, and cashback share one quiet window for this customer.
 */
export function mergeEarnHold(
  existing: EarnNotifyHoldPayload | null,
  incoming: EarnNotifyInput,
): { flushNow: EarnNotifyHoldPayload | null; next: EarnNotifyHoldPayload } {
  const next = payloadFromInput(incoming);
  if (!existing) return { flushNow: null, next };
  return {
    flushNow: null,
    next: {
      ...next,
      parts: [...existing.parts, ...next.parts],
    },
  };
}

function sumPresent(values: Array<number | null>): number | null {
  const nums = values.filter((value): value is number => value != null);
  if (nums.length === 0) return null;
  return nums.reduce((sum, value) => sum + value, 0);
}

function latestPesquisa(
  parts: EarnHoldPart[],
): EarnHoldPart['pesquisa'] {
  for (let i = parts.length - 1; i >= 0; i--) {
    const pesquisa = parts[i]?.pesquisa;
    if (pesquisa) return pesquisa;
  }
  return null;
}

function lastUnitKind(payload: EarnNotifyHoldPayload): EarnNotifyInput['unitKind'] {
  return payload.parts[payload.parts.length - 1]?.unitKind ?? payload.unitKind;
}

/** Name one Cartela only when the burst is carimbos on that Cartela alone. */
function displayStampEarn(
  payload: EarnNotifyHoldPayload,
): EarnNotifyHoldPayload['stampEarn'] {
  if (payload.parts.some((part) => part.unitKind !== 'stamps')) return null;
  const labels = new Set(payload.parts.map((part) => part.stampLabel ?? ''));
  if (labels.size !== 1) return null;
  return payload.stampEarn;
}

export function holdToNotifyInput(payload: EarnNotifyHoldPayload): EarnNotifyInput {
  const lastTx = [...payload.parts]
    .reverse()
    .find((part) => part.transactionId)?.transactionId;
  const unitKind = lastUnitKind(payload);
  const kindParts = payload.parts.filter((part) => part.unitKind === unitKind);
  return {
    businessId: payload.businessId,
    businessName: payload.businessName,
    customerId: payload.customerId,
    toE164: payload.toE164,
    unitKind,
    quantity: kindParts.reduce((sum, part) => sum + part.quantity, 0),
    amountCents: sumPresent(
      (unitKind === 'points' ? kindParts : payload.parts).map(
        (part) => part.amountCents,
      ),
    ),
    cashbackCents: sumPresent(payload.parts.map((part) => part.cashbackCents)),
    saleId: [...payload.parts].reverse().find((part) => part.saleId)?.saleId ?? null,
    transactionId: lastTx ?? null,
    wallet: payload.wallet,
    stampEarn: displayStampEarn(payload),
    summaryLine: earnBurstLine(payload.parts),
    pesquisa: latestPesquisa(payload.parts),
  };
}

function stampEarnFromParts(
  parts: EarnHoldPart[],
  previous: EarnNotifyHoldPayload['stampEarn'],
  wallet: WalletSnapshot,
): EarnNotifyHoldPayload['stampEarn'] {
  const stampParts = parts.filter((part) => part.unitKind === 'stamps');
  if (stampParts.length === 0) return null;
  const label =
    [...stampParts].reverse().find((part) => part.stampLabel)?.stampLabel ??
    previous?.label ??
    null;
  if (!label) return previous;
  const match = wallet.stampDestinations.find(
    (destination) => destination.label === label,
  );
  if (match) {
    return {
      cartela: match.cartela,
      label: match.label,
      balance: match.balance,
    };
  }
  if (previous && previous.label === label) return previous;
  return {
    cartela: previous?.cartela ?? true,
    label,
    balance: wallet.pools.stamps,
  };
}

/**
 * Take a reversed sale out of the burst.
 * Null means nothing left to send.
 * The wallet is the balance after the reverse.
 */
export function releaseEarnHold(
  payload: EarnNotifyHoldPayload,
  dropped: { saleId: string | null; transactionIds: string[] },
  wallet: WalletSnapshot,
): EarnNotifyHoldPayload | null {
  const ids = new Set(dropped.transactionIds);
  const parts = payload.parts.filter((part) => {
    if (dropped.saleId && part.saleId && part.saleId === dropped.saleId) {
      return false;
    }
    if (part.transactionId && ids.has(part.transactionId)) return false;
    return true;
  });
  if (parts.length === 0) return null;
  return {
    ...payload,
    unitKind: parts[parts.length - 1]!.unitKind,
    wallet,
    stampEarn: stampEarnFromParts(parts, payload.stampEarn, wallet),
    parts,
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function unwrapJson(value: unknown): unknown {
  if (typeof value !== 'string') return value;
  try {
    return JSON.parse(value) as unknown;
  } catch {
    return null;
  }
}

function readUnitKind(
  value: unknown,
): EarnNotifyInput['unitKind'] | null {
  if (value === 'stamps' || value === 'points' || value === 'cashback') {
    return value;
  }
  return null;
}

function readPart(
  value: unknown,
  fallback: {
    unitKind: EarnNotifyInput['unitKind'];
    stampLabel: string | null;
  },
): EarnHoldPart | null {
  if (!isRecord(value)) return null;
  if (typeof value.quantity !== 'number') return null;
  const pesquisa = value.pesquisa;
  let parsedPesquisa: EarnHoldPart['pesquisa'] = null;
  if (pesquisa != null) {
    if (
      !isRecord(pesquisa) ||
      typeof pesquisa.sentence !== 'string' ||
      typeof pesquisa.url !== 'string' ||
      typeof pesquisa.conviteId !== 'string'
    ) {
      return null;
    }
    parsedPesquisa = {
      sentence: pesquisa.sentence,
      url: pesquisa.url,
      conviteId: pesquisa.conviteId,
    };
  }
  const unitKind = readUnitKind(value.unitKind) ?? fallback.unitKind;
  return {
    saleId: typeof value.saleId === 'string' ? value.saleId : null,
    transactionId:
      typeof value.transactionId === 'string' ? value.transactionId : null,
    unitKind,
    quantity: value.quantity,
    amountCents: typeof value.amountCents === 'number' ? value.amountCents : null,
    cashbackCents:
      typeof value.cashbackCents === 'number' ? value.cashbackCents : null,
    stampLabel:
      typeof value.stampLabel === 'string'
        ? value.stampLabel
        : unitKind === 'stamps'
          ? fallback.stampLabel
          : null,
    pesquisa: parsedPesquisa,
  };
}

export function parseEarnHoldPayload(value: unknown): EarnNotifyHoldPayload | null {
  const raw = unwrapJson(value);
  if (!isRecord(raw)) return null;
  if (
    raw.unitKind !== 'stamps' &&
    raw.unitKind !== 'points' &&
    raw.unitKind !== 'cashback'
  ) {
    return null;
  }
  if (
    typeof raw.businessId !== 'string' ||
    typeof raw.businessName !== 'string' ||
    typeof raw.customerId !== 'string' ||
    typeof raw.toE164 !== 'string' ||
    !isRecord(raw.wallet) ||
    !Array.isArray(raw.parts) ||
    raw.parts.length === 0
  ) {
    return null;
  }
  const fallbackLabel =
    isRecord(raw.stampEarn) && typeof raw.stampEarn.label === 'string'
      ? raw.stampEarn.label
      : null;
  const parts: EarnHoldPart[] = [];
  for (const part of raw.parts) {
    const parsed = readPart(part, {
      unitKind: raw.unitKind,
      stampLabel: raw.unitKind === 'stamps' ? fallbackLabel : null,
    });
    if (!parsed) return null;
    parts.push(parsed);
  }
  let stampEarn: EarnNotifyHoldPayload['stampEarn'] = null;
  if (raw.stampEarn != null) {
    if (
      !isRecord(raw.stampEarn) ||
      typeof raw.stampEarn.cartela !== 'boolean' ||
      typeof raw.stampEarn.label !== 'string' ||
      typeof raw.stampEarn.balance !== 'number'
    ) {
      return null;
    }
    stampEarn = {
      cartela: raw.stampEarn.cartela,
      label: raw.stampEarn.label,
      balance: raw.stampEarn.balance,
    };
  }
  const parsed: EarnNotifyHoldPayload = {
    businessId: raw.businessId,
    businessName: raw.businessName,
    customerId: raw.customerId,
    toE164: raw.toE164,
    unitKind: raw.unitKind,
    wallet: raw.wallet as WalletSnapshot,
    stampEarn,
    parts,
  };
  if (typeof raw.sentAt === 'string') parsed.sentAt = raw.sentAt;
  return parsed;
}
