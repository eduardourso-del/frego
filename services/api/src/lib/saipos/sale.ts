import { toE164 } from '../phone.js';

/** America/Sao_Paulo has been UTC−3 year-round since 2019. Saipos omits the offset. */
const SAO_PAULO_OFFSET = '-03:00';

export type SaiposPlan =
  | { action: 'ignore' }
  | { action: 'noop' }
  | { action: 'skip'; reason: string }
  | { action: 'reverse' }
  | {
      action: 'credit';
      saiposSaleId: string;
      phone: string;
      amountCents: number;
      displayName: string | null;
      birthday: string | null;
    };

export type SaiposImportStatus =
  | 'processing'
  | 'credited'
  | 'skipped'
  | 'reversed'
  | 'reverse_blocked';

type SaleRecord = Record<string, unknown>;

function asRecord(value: unknown): SaleRecord | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  return value as SaleRecord;
}

function asNumber(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string' && value.trim() && Number.isFinite(Number(value))) {
    return Number(value);
  }
  return null;
}

export function parseSaiposDate(value: unknown): Date | null {
  if (typeof value !== 'string' || !value.trim()) return null;
  const raw = value.trim();
  const dated = /[zZ]|[+-]\d{2}:\d{2}$/.test(raw) ? raw : `${raw}${SAO_PAULO_OFFSET}`;
  const date = new Date(dated);
  return Number.isNaN(date.getTime()) ? null : date;
}

export function formatSaiposDateTime(date: Date): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Sao_Paulo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(date);
  const get = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((part) => part.type === type)?.value ?? '00';
  return `${get('year')}-${get('month')}-${get('day')}T${get('hour')}:${get('minute')}:${get('second')}`;
}

function reais(value: unknown): number | null {
  return asNumber(value);
}

/** Compra in centavos, without the courier fee. Service charge stays in the total. */
export function saleAmountCents(sale: SaleRecord): number | null {
  const totals = asRecord(sale.totals);
  const total = reais(totals?.total_amount ?? sale.total_amount);
  if (total == null) return null;
  const delivery = asRecord(sale.delivery);
  const fee = Math.max(reais(delivery?.delivery_fee) ?? 0, 0);
  return Math.round((total - fee) * 100);
}

function phoneCandidates(sale: SaleRecord): string[] {
  const customer = asRecord(sale.customer);
  const phone = customer?.phone;
  if (Array.isArray(phone)) {
    return phone.filter((item): item is string => typeof item === 'string');
  }
  if (typeof phone === 'string') return [phone];
  return [];
}

function customerName(sale: SaleRecord): string {
  const customer = asRecord(sale.customer);
  return typeof customer?.name === 'string' ? customer.name.trim() : '';
}

function isUnidentified(name: string): boolean {
  return name.toLocaleLowerCase('pt-BR') === 'consumidor não identificado';
}

export function salePhone(sale: SaleRecord):
  | { ok: true; phone: string }
  | { ok: false; reason: 'unidentified' | 'no_phone' | 'invalid_phone' } {
  const candidates = phoneCandidates(sale)
    .map((phone) => phone.trim())
    .filter((phone) => phone.length > 0);
  if (candidates.length === 0) {
    return {
      ok: false,
      reason: isUnidentified(customerName(sale)) ? 'unidentified' : 'no_phone',
    };
  }
  for (const raw of candidates) {
    try {
      return { ok: true, phone: toE164(raw) };
    } catch {
      // A masked delivery number is not a Cliente.
    }
  }
  return { ok: false, reason: 'invalid_phone' };
}

function isCanceled(sale: SaleRecord): boolean {
  return sale.canceled === 'Y' || sale.canceled === 'y' || sale.canceled === true;
}

function hasPayment(sale: SaleRecord): boolean {
  if (!Array.isArray(sale.payments)) return false;
  return sale.payments.some((payment) => {
    const row = asRecord(payment);
    return (reais(row?.payment_amount) ?? 0) > 0;
  });
}

function tableOpen(sale: SaleRecord): boolean {
  if (asNumber(sale.id_sale_type) !== 3) return false;
  const table = asRecord(sale.table_order);
  return asNumber(table?.id_table_order_status) !== 1;
}

function displayName(sale: SaleRecord): string | null {
  const name = customerName(sale);
  if (!name || isUnidentified(name)) return null;
  return name.slice(0, 80);
}

function birthday(sale: SaleRecord): string | null {
  const customer = asRecord(sale.customer);
  const value = customer?.birth_date;
  if (typeof value !== 'string') return null;
  const match = value.trim().match(/^(\d{4}-\d{2}-\d{2})/);
  return match?.[1] ?? null;
}

export function saiposSaleId(sale: unknown): string | null {
  const row = asRecord(sale);
  if (!row) return null;
  const id = row.id_sale;
  if (typeof id === 'number' && Number.isFinite(id)) return String(id);
  if (typeof id === 'string' && id.trim()) return id.trim();
  return null;
}

export function planSaiposSale(input: {
  sale: unknown;
  connectedAt: Date;
  existing: { status: SaiposImportStatus } | null;
}): SaiposPlan {
  const sale = asRecord(input.sale);
  const id = saiposSaleId(input.sale);
  if (!sale || !id) return { action: 'skip', reason: 'malformed' };

  const createdAt = parseSaiposDate(sale.created_at);
  if (!createdAt) return { action: 'skip', reason: 'malformed' };

  const canceled = isCanceled(sale);
  const before = createdAt.getTime() < input.connectedAt.getTime();
  if (before) {
    if (canceled && input.existing?.status === 'credited') return { action: 'reverse' };
    return { action: 'ignore' };
  }

  if (input.existing?.status === 'credited') {
    return canceled ? { action: 'reverse' } : { action: 'noop' };
  }
  if (
    input.existing?.status === 'reversed' ||
    input.existing?.status === 'reverse_blocked'
  ) {
    return { action: 'noop' };
  }
  if (canceled) return { action: 'skip', reason: 'canceled' };

  const phone = salePhone(sale);
  if (!phone.ok) return { action: 'skip', reason: phone.reason };
  if (!hasPayment(sale)) return { action: 'skip', reason: 'unpaid' };
  if (tableOpen(sale)) return { action: 'skip', reason: 'table_open' };

  const amountCents = saleAmountCents(sale);
  if (amountCents == null || amountCents <= 0) {
    return { action: 'skip', reason: 'amount' };
  }

  return {
    action: 'credit',
    saiposSaleId: id,
    phone: phone.phone,
    amountCents,
    displayName: displayName(sale),
    birthday: birthday(sale),
  };
}

/** Readme wraps the array as a string. The live API may return the array itself. */
export function unwrapSaiposSales(body: unknown): unknown[] {
  if (Array.isArray(body)) return body;
  const record = asRecord(body);
  if (!record) return [];
  if (Array.isArray(record.data)) return record.data;
  if (Array.isArray(record.sales)) return record.sales;
  const result = asRecord(record.Result);
  const value = result?.value;
  if (Array.isArray(value)) return value;
  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value) as unknown;
      if (Array.isArray(parsed)) return parsed;
    } catch {
      return [];
    }
  }
  return [];
}
