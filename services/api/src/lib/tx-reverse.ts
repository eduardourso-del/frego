import { randomUUID } from 'node:crypto';
import { voucherFromMetadata } from './voucher.js';
import {
  isReversalMarker,
  isReversedTx,
  roleFromMeta,
  saleIdFromMeta,
  type LedgerRole,
} from './ledger-meta.js';

export type ReverseBlockReason = 'used' | 'expired' | 'not_staff' | 'voucher';

export type CounterSaleItem = {
  id: string;
  type: string;
  quantity: number;
  unitKind: string | null;
  amountCents: number | null;
  role: LedgerRole | 'unknown';
};

export type CounterSale = {
  saleId: string;
  /** POST /transactions/:anchorId/reverse */
  anchorId: string;
  createdAt: string;
  summary: string;
  items: CounterSaleItem[];
};

type StaffTx = {
  id: string;
  type: string;
  quantity: number;
  unitKind: string | null;
  amountCents: number | null;
  createdAt: Date | string;
  metadata?: unknown;
  actorTeamMemberId?: string | null;
};

export function newSaleId(): string {
  return randomUUID();
}

export function isStaffCounterTx(tx: StaffTx): boolean {
  if (!tx.actorTeamMemberId) return false;
  if (isReversalMarker(tx.metadata) || isReversedTx(tx.metadata)) return false;
  if (voucherFromMetadata(tx.metadata, { createdAt: tx.createdAt })) return false;
  if (tx.type === 'stamp') return true;
  return tx.type === 'redeem' && tx.unitKind === 'cashback_cents';
}

function money(cents: number): string {
  return (cents / 100).toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  });
}

export function inferItemRole(tx: {
  type: string;
  unitKind: string | null;
  metadata?: unknown;
}): LedgerRole | 'unknown' {
  const tagged = roleFromMeta(tx.metadata);
  if (tagged) return tagged;
  if (tx.type === 'redeem' && tx.unitKind === 'cashback_cents') return 'apply';
  if (tx.unitKind === 'cashback_cents') return 'cashback';
  return 'earn';
}

export function formatSaleSummary(items: CounterSaleItem[]): string {
  const parts: string[] = [];
  const amount = items.find((i) => i.amountCents != null && i.amountCents > 0)
    ?.amountCents;
  if (amount != null) parts.push(money(amount));

  for (const item of items) {
    if (item.role === 'apply') {
      parts.push(`−${money(item.quantity)} cashback`);
      continue;
    }
    if (item.unitKind === 'cashback_cents' || item.role === 'cashback') {
      parts.push(`+${money(item.quantity)} cashback`);
      continue;
    }
    if (item.unitKind === 'points') {
      parts.push(`+${item.quantity} pts`);
      continue;
    }
    parts.push(
      item.quantity === 1 ? '+1 carimbo' : `+${item.quantity} carimbos`,
    );
  }
  return parts.join(' · ');
}

function toItem(tx: StaffTx): CounterSaleItem {
  return {
    id: tx.id,
    type: tx.type,
    quantity: tx.quantity,
    unitKind: tx.unitKind,
    amountCents: tx.amountCents,
    role: inferItemRole(tx),
  };
}

function toSale(saleId: string, txs: StaffTx[]): CounterSale {
  const sorted = [...txs].sort((a, b) => {
    const ta = new Date(a.createdAt).getTime();
    const tb = new Date(b.createdAt).getTime();
    return ta - tb;
  });
  const items = sorted.map(toItem);
  const newest = sorted[sorted.length - 1] ?? sorted[0];
  return {
    saleId,
    anchorId: sorted[0]?.id ?? saleId,
    createdAt: new Date(newest.createdAt).toISOString(),
    summary: formatSaleSummary(items),
    items,
  };
}

/** Groups staff counter earns/applies. Newest sale first. */
export function groupCounterSales(
  txs: StaffTx[],
  take = 8,
): CounterSale[] {
  const eligible = txs.filter(isStaffCounterTx);
  const bySale = new Map<string, StaffTx[]>();
  const order: string[] = [];

  for (const tx of eligible) {
    const saleId = saleIdFromMeta(tx.metadata) ?? tx.id;
    if (!bySale.has(saleId)) {
      bySale.set(saleId, []);
      order.push(saleId);
    }
    bySale.get(saleId)!.push(tx);
  }

  const sales = order.map((id) => toSale(id, bySale.get(id)!));
  sales.sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
  );
  return sales.slice(0, take);
}

export type EarnLotState = {
  remaining: number;
  expired: boolean;
  originalQuantity: number;
};

/** Remaining unused units of a specific earn, after FIFO consumes. */
export function earnLotState(
  active: Array<{
    sourceId?: string;
    remaining: number;
    originalQuantity: number;
  }>,
  expired: Array<{
    sourceId?: string;
    remaining: number;
    originalQuantity: number;
  }>,
  earnId: string,
): EarnLotState | null {
  const fromActive = active.find((lot) => lot.sourceId === earnId);
  if (fromActive) {
    return {
      remaining: fromActive.remaining,
      expired: false,
      originalQuantity: fromActive.originalQuantity,
    };
  }
  const fromExpired = expired.find((lot) => lot.sourceId === earnId);
  if (fromExpired) {
    return {
      remaining: fromExpired.remaining,
      expired: true,
      originalQuantity: fromExpired.originalQuantity,
    };
  }
  return null;
}

type LotPool = {
  lots: Array<{
    sourceId?: string;
    remaining: number;
    originalQuantity: number;
  }>;
  expiredLots: Array<{
    sourceId?: string;
    remaining: number;
    originalQuantity: number;
  }>;
};

/** Finds an earn in stamps / points / cashback without assuming unitKind. */
export function earnLotStateFromPools(
  pools: LotPool[],
  earnId: string,
): EarnLotState | null {
  for (const pool of pools) {
    const state = earnLotState(pool.lots, pool.expiredLots, earnId);
    if (state) return state;
  }
  return null;
}

export function reverseBlockForEarn(
  state: EarnLotState | null,
  quantity: number,
): ReverseBlockReason | null {
  if (!state) return 'used';
  if (state.expired) return 'expired';
  if (state.remaining < quantity) return 'used';
  return null;
}

export function reverseBlockMessage(reason: ReverseBlockReason): string {
  switch (reason) {
    case 'used':
      return 'Parte desse benefício já foi usada. Não dá para desfazer.';
    case 'expired':
      return 'Esse benefício já expirou. Não dá para desfazer.';
    case 'voucher':
      return 'Resgate de prêmio não pode ser desfeito por aqui.';
    case 'not_staff':
      return 'Só é possível desfazer lançamentos feitos no caixa.';
    default:
      return 'Não foi possível desfazer.';
  }
}
