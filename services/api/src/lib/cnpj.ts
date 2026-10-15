/** null = vazio. string = CPF (11) ou CNPJ (14), só dígitos. */

export function isValidCpf(value: string) {
  const cpf = value.replace(/\D/g, '');
  if (cpf.length !== 11) return false;
  if (/^(\d)\1{10}$/.test(cpf)) return false;

  const check = (length: number) => {
    let sum = 0;
    for (let i = 0; i < length; i++) sum += Number(cpf[i]) * (length + 1 - i);
    const mod = (sum * 10) % 11;
    return mod === 10 ? 0 : mod;
  };

  return check(9) === Number(cpf[9]) && check(10) === Number(cpf[10]);
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

/** Aceita CPF ou CNPJ. O cadastro guarda os dígitos na coluna cnpj. */
export function normalizeCnpj(
  value: string | null | undefined,
): string | null | 'invalid' {
  if (value == null) return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  const digits = trimmed.replace(/\D/g, '');
  if (digits.length === 11 && isValidCpf(digits)) return digits;
  if (digits.length === 14 && isValidCnpj(digits)) return digits;
  return 'invalid';
}
