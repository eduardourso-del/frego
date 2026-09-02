/** Ledger JSON on Transaction.metadata — vouchers, sale grouping, reversals. */

export type LedgerRole = 'earn' | 'apply' | 'cashback';

export function asMetaRecord(
  metadata: unknown,
): Record<string, unknown> {
  if (!metadata || typeof metadata !== 'object' || Array.isArray(metadata)) {
    return {};
  }
  return metadata as Record<string, unknown>;
}

export function metaString(
  metadata: unknown,
  key: string,
): string | null {
  const value = asMetaRecord(metadata)[key];
  return typeof value === 'string' && value.length > 0 ? value : null;
}

export function saleIdFromMeta(metadata: unknown): string | null {
  return metaString(metadata, 'saleId');
}

export function roleFromMeta(metadata: unknown): LedgerRole | null {
  const role = metaString(metadata, 'role');
  if (role === 'earn' || role === 'apply' || role === 'cashback') return role;
  return null;
}

export function isReversedTx(metadata: unknown): boolean {
  return metaString(metadata, 'reversedAt') != null;
}

export function isReversalMarker(metadata: unknown): boolean {
  const meta = asMetaRecord(metadata);
  const reversalOf = meta.reversalOf;
  if (typeof reversalOf === 'string' && reversalOf.length > 0) return true;
  return Array.isArray(reversalOf) && reversalOf.length > 0;
}

/** Skip in wallet + stats: undone originals and audit rows for the undo. */
export function shouldOmitFromLedger(metadata: unknown): boolean {
  return isReversedTx(metadata) || isReversalMarker(metadata);
}

export function mergeLedgerMeta(
  metadata: unknown,
  patch: Record<string, unknown>,
): Record<string, unknown> {
  return { ...asMetaRecord(metadata), ...patch };
}
