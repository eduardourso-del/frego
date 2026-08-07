/** Digits only (strips mask). */
export function digitsOnly(value: string) {
  return value.replace(/\D/g, '');
}

/**
 * Máscara BR com DDD: (11) 98765-4321 ou (11) 3456-7890
 */
export function formatPhoneBr(value: string): string {
  const d = digitsOnly(value).slice(0, 11);
  if (d.length === 0) return '';
  if (d.length <= 2) return `(${d}`;
  if (d.length <= 6) return `(${d.slice(0, 2)}) ${d.slice(2)}`;
  if (d.length <= 10) {
    return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
  }
  return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
}

/** Valor pronto para a API (só dígitos com DDD). */
export function phoneDigitsForApi(value: string): string {
  return digitsOnly(value).slice(0, 11);
}
