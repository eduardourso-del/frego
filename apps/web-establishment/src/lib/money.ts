/** Parse a BR money string ("42", "42,50", "R$ 1.234,56") to cents. */
export function parseMoneyToCents(raw: string): number | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  const hasComma = trimmed.includes(',');
  const cleaned = trimmed.replace(/[^\d,.-]/g, '');
  const normalized = hasComma
    ? cleaned.replace(/\./g, '').replace(',', '.')
    : cleaned.replace(/\./g, '');
  if (!normalized || normalized === '-' || normalized === '.') return null;
  const n = Number(normalized);
  if (!Number.isFinite(n) || n <= 0) return null;
  return Math.round(n * 100);
}

export function formatCentsAsInput(cents: number): string {
  return (cents / 100).toLocaleString('pt-BR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

export function formatBrl(cents: number): string {
  return (cents / 100).toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  });
}

/** Digit-as-cents mask as you type: 1 → 0,01 · 100 → 1,00 · 122222 → 1.222,22 */
export function maskMoneyInput(raw: string): string {
  const digits = raw.replace(/\D/g, '').replace(/^0+(?=\d)/, '').slice(0, 10);
  if (!digits) return '';
  const cents = Number.parseInt(digits, 10);
  if (!Number.isFinite(cents) || cents <= 0) return '';
  return formatCentsAsInput(cents);
}
