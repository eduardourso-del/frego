import { randomInt } from 'node:crypto';

/** Crockford Base32 sem I/L/O/U — fácil de ler no balcão. */
const ALPHABET = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';

/** Voucher must be shown at the counter within this window. */
export const VOUCHER_TTL_MS = 24 * 60 * 60 * 1000;

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

/** Normaliza código digitado no balcão (aceita com ou sem hífen). */
export function normalizeVoucherCode(raw: string): string {
  return raw.replace(/[^0-9A-Za-z]/g, '').toUpperCase();
}

export type VoucherMeta = {
  voucherCode: string;
  voucherDisplay: string;
  /** ISO datetime — voucher inválido após isto se ainda não usado. */
  expiresAt: string;
  /** ISO datetime when staff marked the prize as delivered. */
  usedAt?: string | null;
  usedByTeamMemberId?: string | null;
};

export type VoucherStatus = 'open' | 'used' | 'expired';

export function createVoucherMeta(now = new Date()): VoucherMeta {
  const voucherCode = generateVoucherCode(6);
  return {
    voucherCode,
    voucherDisplay: formatVoucherDisplay(voucherCode),
    expiresAt: new Date(now.getTime() + VOUCHER_TTL_MS).toISOString(),
  };
}

/**
 * Resolve voucher from metadata.
 * `createdAt` is used as fallback for older vouchers without expiresAt.
 */
export function voucherFromMetadata(
  metadata: unknown,
  opts?: { createdAt?: Date | string | null; now?: Date },
): (VoucherMeta & { status: VoucherStatus }) | null {
  if (!metadata || typeof metadata !== 'object') return null;
  const m = metadata as Record<string, unknown>;
  const code = typeof m.voucherCode === 'string' ? m.voucherCode : null;
  if (!code) return null;
  const display =
    typeof m.voucherDisplay === 'string'
      ? m.voucherDisplay
      : formatVoucherDisplay(code);
  const usedAt = typeof m.usedAt === 'string' ? m.usedAt : null;
  const usedByTeamMemberId =
    typeof m.usedByTeamMemberId === 'string' ? m.usedByTeamMemberId : null;

  let expiresAt =
    typeof m.expiresAt === 'string' ? m.expiresAt : null;
  if (!expiresAt && opts?.createdAt) {
    const created =
      opts.createdAt instanceof Date
        ? opts.createdAt
        : new Date(opts.createdAt);
    if (!Number.isNaN(created.getTime())) {
      expiresAt = new Date(created.getTime() + VOUCHER_TTL_MS).toISOString();
    }
  }
  if (!expiresAt) {
    // Last resort: treat as already expired if we can't resolve a window.
    expiresAt = new Date(0).toISOString();
  }

  const now = opts?.now ?? new Date();
  let status: VoucherStatus = 'open';
  if (usedAt) status = 'used';
  else if (now.getTime() > new Date(expiresAt).getTime()) status = 'expired';

  return {
    voucherCode: code,
    voucherDisplay: display,
    expiresAt,
    usedAt,
    usedByTeamMemberId,
    status,
  };
}

export function markVoucherUsed(
  metadata: unknown,
  teamMemberId: string,
  at = new Date(),
  createdAt?: Date | null,
  opts?: { acceptExpired?: boolean },
): VoucherMeta {
  const existing = voucherFromMetadata(metadata, { createdAt, now: at });
  if (!existing) {
    throw new Error('INVALID_VOUCHER_METADATA');
  }
  if (existing.usedAt) {
    return {
      voucherCode: existing.voucherCode,
      voucherDisplay: existing.voucherDisplay,
      expiresAt: existing.expiresAt,
      usedAt: existing.usedAt,
      usedByTeamMemberId: existing.usedByTeamMemberId,
    };
  }
  if (existing.status === 'expired' && !opts?.acceptExpired) {
    throw new Error('VOUCHER_EXPIRED');
  }
  return {
    voucherCode: existing.voucherCode,
    voucherDisplay: existing.voucherDisplay,
    expiresAt: existing.expiresAt,
    usedAt: at.toISOString(),
    usedByTeamMemberId: teamMemberId,
  };
}
