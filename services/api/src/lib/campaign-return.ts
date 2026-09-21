import { isCashbackUnit } from './customer-stats.js';
import { voucherFromMetadata } from './voucher.js';

/** Staff can accept an expired voucher days after it was issued. */
export const VOUCHER_FULFILL_LOOKBACK_DAYS = 90;

export type CampaignReturnCoverage = {
  withAmount: number;
  used: number;
};

export type CampaignReturnFold = {
  revenueCents: number;
  coverage: CampaignReturnCoverage;
};

export type CampaignReturnTx = {
  type: string;
  amountCents: number | null;
  metadata?: unknown;
  createdAt: Date;
  unitKind?: string | null;
};

export type PeriodRange = { from: Date; to: Date };

export function voucherLookbackStart(from: Date) {
  const d = new Date(from);
  d.setDate(d.getDate() - VOUCHER_FULFILL_LOOKBACK_DAYS);
  return d;
}

export function dateInRange(d: Date, from: Date, to: Date) {
  return d >= from && d < to;
}

export function voucherUsedAt(
  metadata: unknown,
  createdAt?: Date,
): Date | null {
  const voucher = voucherFromMetadata(metadata, { createdAt });
  if (!voucher?.usedAt) return null;
  const at = new Date(voucher.usedAt);
  return Number.isNaN(at.getTime()) ? null : at;
}

/** Fulfillment date if used, otherwise issuance. */
export function voucherEventAt(tx: CampaignReturnTx): Date {
  return voucherUsedAt(tx.metadata, tx.createdAt) ?? tx.createdAt;
}

/**
 * Used vouchers belong to the period they were confirmed (even if issued
 * earlier — e.g. expired + accepted the next morning).
 * Open/expired vouchers belong to the period they were issued.
 */
export function voucherBelongsToPeriod(
  tx: CampaignReturnTx,
  range: PeriodRange,
): boolean {
  const usedAt = voucherUsedAt(tx.metadata, tx.createdAt);
  if (usedAt) return dateInRange(usedAt, range.from, range.to);
  return dateInRange(tx.createdAt, range.from, range.to);
}

/**
 * First fulfill stores the ticket. Already-used with no amount can backfill once.
 * Already-used with an amount is left unchanged.
 * `undefined` means do not write amountCents.
 */
export function nextFulfillAmountCents(opts: {
  alreadyUsed: boolean;
  existingAmountCents: number | null;
  incomingAmountCents: number | undefined;
}): number | undefined {
  if (opts.incomingAmountCents === undefined) return undefined;
  if (opts.alreadyUsed && opts.existingAmountCents != null) return undefined;
  return opts.incomingAmountCents;
}

export function foldCampaignReturn(
  txs: CampaignReturnTx[],
  opts: { isCashback: boolean; range?: PeriodRange },
): CampaignReturnFold {
  let revenueCents = 0;
  let used = 0;
  let withAmount = 0;

  if (opts.isCashback) {
    for (const tx of txs) {
      if (tx.type !== 'redeem') continue;
      if (
        opts.range &&
        !dateInRange(tx.createdAt, opts.range.from, opts.range.to)
      ) {
        continue;
      }
      used += 1;
      if (tx.amountCents != null) {
        withAmount += 1;
        revenueCents += tx.amountCents;
      }
    }
    return { revenueCents, coverage: { withAmount, used } };
  }

  for (const tx of txs) {
    if (opts.range && !voucherBelongsToPeriod(tx, opts.range)) continue;
    const voucher = voucherFromMetadata(tx.metadata, {
      createdAt: tx.createdAt,
    });
    if (voucher?.status !== 'used') continue;
    used += 1;
    if (tx.amountCents != null) {
      withAmount += 1;
      revenueCents += tx.amountCents;
    }
  }
  return { revenueCents, coverage: { withAmount, used } };
}

/** Store-level: used voucher tickets + cashback apply amounts. */
export function foldStoreCampaignReturn(
  txs: CampaignReturnTx[],
  range?: PeriodRange,
): CampaignReturnFold {
  const voucher = foldCampaignReturn(txs, { isCashback: false, range });
  const cashbackTxs = txs.filter((tx) => isCashbackUnit(tx.unitKind));
  const cashback = foldCampaignReturn(cashbackTxs, {
    isCashback: true,
    range,
  });
  return {
    revenueCents: voucher.revenueCents + cashback.revenueCents,
    coverage: {
      withAmount: voucher.coverage.withAmount + cashback.coverage.withAmount,
      used: voucher.coverage.used + cashback.coverage.used,
    },
  };
}
