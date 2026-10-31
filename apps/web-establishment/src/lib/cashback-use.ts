import { formatBrl } from '@/lib/money';

/** Same ceiling as the API. A Múltiplo below 2 is off. */
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

export function cashbackMultipleBinds(
  compraCents: number | null,
  balanceCents: number,
  maxApplyCents: number,
  multiple: number | null | undefined,
): boolean {
  return (
    compraCents != null &&
    multiple != null &&
    multiple >= 2 &&
    balanceCents > 0 &&
    maxApplyCents < balanceCents
  );
}

export function cashbackUseAllLabel(
  maxApplyCents: number,
  binds: boolean,
): string {
  if (binds && maxApplyCents > 0) return `Usar até ${formatBrl(maxApplyCents)}`;
  return 'Usar todo o saldo';
}

export function cashbackUseSlip(input: {
  applyCents: number;
  paidCents: number;
  previewCashback: number;
  compraTyped: boolean;
  maxApplyCents: number;
  multiple: number | null | undefined;
  binds: boolean;
}): string {
  const { applyCents, paidCents, previewCashback, compraTyped, maxApplyCents, multiple, binds } =
    input;
  if (applyCents <= 0) {
    if (binds && maxApplyCents <= 0 && multiple != null) {
      return `A compra cobre até ${multiple}×`;
    }
    return 'Marque para usar o saldo todo, ou informe um valor.';
  }
  if (!compraTyped) return `− ${formatBrl(applyCents)} do saldo`;
  const atCap = binds && applyCents === maxApplyCents;
  let base = `− ${formatBrl(applyCents)} · a pagar ${formatBrl(paidCents)}`;
  if (atCap && multiple != null) base += ` · a compra cobre até ${multiple}×`;
  if (previewCashback > 0) base += ` · entra + ${formatBrl(previewCashback)}`;
  return base;
}
