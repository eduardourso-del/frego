import { randomInt } from 'node:crypto';

/** Crockford Base32 sem I/L/O/U — fácil de ler no balcão. */
const ALPHABET = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';

/** Gera código bruto de 6 caracteres (ex. K7M2PQ). */
export function generateVoucherCode(length = 6): string {
  let out = '';
  for (let i = 0; i < length; i += 1) {
    out += ALPHABET[randomInt(ALPHABET.length)]!;
  }
  return out;
}

/** Formata para exibição: K7M-2PQ */
export function formatVoucherDisplay(code: string): string {
  const clean = code.replace(/[^0-9A-Z]/gi, '').toUpperCase();
  if (clean.length <= 3) return clean;
  return `${clean.slice(0, 3)}-${clean.slice(3)}`;
}

export type VoucherMeta = {
  voucherCode: string;
  voucherDisplay: string;
};

export function createVoucherMeta(): VoucherMeta {
  const voucherCode = generateVoucherCode(6);
  return {
    voucherCode,
    voucherDisplay: formatVoucherDisplay(voucherCode),
  };
}

export function voucherFromMetadata(
  metadata: unknown,
): VoucherMeta | null {
  if (!metadata || typeof metadata !== 'object') return null;
  const m = metadata as Record<string, unknown>;
  const code = typeof m.voucherCode === 'string' ? m.voucherCode : null;
  if (!code) return null;
  const display =
    typeof m.voucherDisplay === 'string'
      ? m.voucherDisplay
      : formatVoucherDisplay(code);
  return { voucherCode: code, voucherDisplay: display };
}
