/**
 * Ceiling for Usar, in centavos.
 * With no compra yet, the ceiling is the saldo.
 * A Múltiplo from 2 up caps it at the compra divided by that number, rounded down.
 */
export function maxCashbackUseCents(
  compraCents: number | null,
  balanceCents: number,
  multiple: number | null | undefined,
): number {
  if (balanceCents <= 0) return 0;
  if (compraCents == null) return balanceCents;
  const compra = Math.max(0, Math.floor(compraCents));
  const byCompra = Math.min(balanceCents, compra);
  if (multiple == null || !Number.isInteger(multiple) || multiple < 2) {
    return byCompra;
  }
  return Math.min(byCompra, Math.floor(compra / multiple));
}
