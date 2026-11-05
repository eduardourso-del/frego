import { formatSaiposDateTime, unwrapSaiposSales } from './sale.js';

const DEFAULT_BASE = 'https://data.saipos.io/v1';
const PAGE_LIMIT = 1000;
const MAX_PAGES = 20;

export type SaiposFetchResult =
  | { ok: true; sales: unknown[] }
  | { ok: false; status: number; message: string };

function baseUrl(): string {
  return (process.env.SAIPOS_DATA_API_BASE?.trim() || DEFAULT_BASE).replace(
    /\/$/,
    '',
  );
}

function authorization(token: string): string {
  const trimmed = token.trim();
  return /^bearer\s+/i.test(trimmed) ? trimmed : `Bearer ${trimmed}`;
}

export async function fetchSaiposSales(
  token: string,
  start: Date,
  end: Date,
  fetchImpl: typeof fetch = fetch,
): Promise<SaiposFetchResult> {
  const sales: unknown[] = [];
  for (let page = 0; page < MAX_PAGES; page++) {
    const params = new URLSearchParams({
      p_date_column_filter: 'updated_at',
      p_filter_date_start: formatSaiposDateTime(start),
      p_filter_date_end: formatSaiposDateTime(end),
      p_limit: String(PAGE_LIMIT),
      p_offset: String(page * PAGE_LIMIT),
    });
    let response: Response;
    try {
      response = await fetchImpl(`${baseUrl()}/search_sales?${params}`, {
        headers: { Authorization: authorization(token) },
      });
    } catch {
      return { ok: false, status: 0, message: 'Não foi possível falar com a Saipos.' };
    }
    const body: unknown = await response.json().catch(() => null);
    if (!response.ok) {
      const message =
        body && typeof body === 'object' && 'message' in body &&
        typeof (body as { message?: unknown }).message === 'string'
          ? (body as { message: string }).message
          : `Saipos respondeu ${response.status}.`;
      return { ok: false, status: response.status, message };
    }
    const pageSales = unwrapSaiposSales(body);
    sales.push(...pageSales);
    if (pageSales.length < PAGE_LIMIT) break;
  }
  return { ok: true, sales };
}
