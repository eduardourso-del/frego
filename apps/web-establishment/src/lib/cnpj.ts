export function formatCnpj(value: string) {
  const digits = value.replace(/\D/g, '').slice(0, 14);
  let out = digits.slice(0, 2);
  if (digits.length > 2) out += `.${digits.slice(2, 5)}`;
  if (digits.length > 5) out += `.${digits.slice(5, 8)}`;
  if (digits.length > 8) out += `/${digits.slice(8, 12)}`;
  if (digits.length > 12) out += `-${digits.slice(12, 14)}`;
  return out;
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

/** Mensagem enquanto o campo opcional está preenchido e ainda não é válido. */
export function cnpjFieldError(value: string) {
  const digits = value.replace(/\D/g, '');
  if (!digits) return null;
  if (digits.length < 14) return 'CNPJ incompleto.';
  if (!isValidCnpj(digits)) return 'CNPJ inválido.';
  return null;
}
