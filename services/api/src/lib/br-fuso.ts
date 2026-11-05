/** Civil timezone of an Estabelecimento, derived from the UF where it operates. */

export const DEFAULT_FUSO = 'America/Sao_Paulo';

/**
 * Capital zone of each UF. Offsets match since Brazil ended daylight saving in 2019.
 * Fernando de Noronha (PE) and western Amazonas are not separate UFs.
 */
const UF_TIME_ZONE: Record<string, string> = {
  AC: 'America/Rio_Branco',
  AL: 'America/Maceio',
  AP: 'America/Belem',
  AM: 'America/Manaus',
  BA: 'America/Bahia',
  CE: 'America/Fortaleza',
  DF: 'America/Sao_Paulo',
  ES: 'America/Sao_Paulo',
  GO: 'America/Sao_Paulo',
  MA: 'America/Fortaleza',
  MT: 'America/Cuiaba',
  MS: 'America/Campo_Grande',
  MG: 'America/Sao_Paulo',
  PA: 'America/Belem',
  PB: 'America/Fortaleza',
  PR: 'America/Sao_Paulo',
  PE: 'America/Recife',
  PI: 'America/Fortaleza',
  RJ: 'America/Sao_Paulo',
  RN: 'America/Fortaleza',
  RS: 'America/Sao_Paulo',
  RO: 'America/Porto_Velho',
  RR: 'America/Boa_Vista',
  SC: 'America/Sao_Paulo',
  SP: 'America/Sao_Paulo',
  SE: 'America/Maceio',
  TO: 'America/Araguaina',
};

export function timeZoneForUf(uf: string | null | undefined): string | null {
  if (!uf) return null;
  return UF_TIME_ZONE[uf.trim().toUpperCase()] ?? null;
}

export function isUf(uf: string): boolean {
  return timeZoneForUf(uf) != null;
}

export type OperatingAddressInput = {
  postalCode: string;
  street: string;
  streetNumber: string;
  complement?: string | null;
  neighborhood: string;
  city: string;
  state: string;
};

export function normalizePostalCode(raw: string): string | null {
  const digits = raw.replace(/\D/g, '');
  return digits.length === 8 ? digits : null;
}

export function formatOperatingAddress(parts: OperatingAddressInput): string {
  const streetLine = [parts.street.trim(), parts.streetNumber.trim()]
    .filter(Boolean)
    .join(', ');
  const complement = parts.complement?.trim();
  const place = [parts.neighborhood.trim(), parts.city.trim()]
    .filter(Boolean)
    .join(', ');
  const tail = parts.state ? `${place} - ${parts.state.trim().toUpperCase()}` : place;
  return [streetLine, complement, tail].filter(Boolean).join(' — ');
}
