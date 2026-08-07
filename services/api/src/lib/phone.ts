import { parsePhoneNumberFromString } from 'libphonenumber-js';

/** Normalize to E.164 or throw. Defaults region BR when no country code. */
export function toE164(raw: string, defaultCountry: 'BR' | 'US' = 'BR'): string {
  const parsed = parsePhoneNumberFromString(raw, defaultCountry);
  if (!parsed || !parsed.isValid()) {
    throw Object.assign(new Error('INVALID_PHONE'), { statusCode: 400 });
  }
  return parsed.format('E.164');
}

/** Last 4 national digits (for counter search). */
export function phoneLast4(phoneE164: string): string {
  const digits = phoneE164.replace(/\D/g, '');
  return digits.slice(-4);
}

export function normalizeLast4(raw: string): string {
  const digits = raw.replace(/\D/g, '');
  if (digits.length !== 4) {
    throw Object.assign(new Error('INVALID_LAST4'), { statusCode: 400 });
  }
  return digits;
}
