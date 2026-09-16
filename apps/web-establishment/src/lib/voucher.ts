/** Matches API display: K7M-2PQ */
export function normalizeVoucherCode(raw: string): string {
  return raw.replace(/[^0-9A-Za-z]/g, '').toUpperCase();
}

export function formatVoucherInput(raw: string): string {
  const clean = normalizeVoucherCode(raw).slice(0, 6);
  if (clean.length <= 3) return clean;
  return `${clean.slice(0, 3)}-${clean.slice(3)}`;
}

/** Whole-payload Código from a scan. Rejects PIX, URLs, and anything else. */
export function parseScannedVoucherCodigo(raw: string): string | null {
  const clean = normalizeVoucherCode(raw.trim());
  if (clean.length !== 6) return null;
  return clean;
}
