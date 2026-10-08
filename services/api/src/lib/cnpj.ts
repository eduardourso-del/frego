/** null = vazio, string = 14 dígitos válidos. */
export function normalizeCnpj(
  value: string | null | undefined,
): string | null | 'invalid' {
  if (value == null) return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  const digits = trimmed.replace(/\D/g, '');
  if (!isValidCnpj(digits)) return 'invalid';
  return digits;
}

export function isValidCnpj(value: string) {
  const cnpj = value.replace(/\D/g, '');
  if (cnpj.length !== 14) return false;
  if (/^(\d)\1{13}$/.test(cnpj)) return false;

  const digit = (base: string, factors: number[]) => {
    const sum = factors.reduce(
      (total, factor, index) => total + Number(base[index]) * factor,
      0,
    );
    const mod = sum % 11;
    return mod < 2 ? 0 : 11 - mod;
  };

  const first = digit(cnpj, [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]);
  if (first !== Number(cnpj[12])) return false;
  const second = digit(cnpj, [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]);
  return second === Number(cnpj[13]);
}
