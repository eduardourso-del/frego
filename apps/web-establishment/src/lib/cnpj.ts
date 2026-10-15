export function formatCpf(digits: string) {
  let out = digits.slice(0, 3);
  if (digits.length > 3) out += `.${digits.slice(3, 6)}`;
  if (digits.length > 6) out += `.${digits.slice(6, 9)}`;
  if (digits.length > 9) out += `-${digits.slice(9, 11)}`;
  return out;
}

export function formatCnpj(value: string) {
  const digits = value.replace(/\D/g, '').slice(0, 14);
  if (digits.length <= 11) return formatCpf(digits);
  let out = digits.slice(0, 2);
  if (digits.length > 2) out += `.${digits.slice(2, 5)}`;
  if (digits.length > 5) out += `.${digits.slice(5, 8)}`;
  if (digits.length > 8) out += `/${digits.slice(8, 12)}`;
  if (digits.length > 12) out += `-${digits.slice(12, 14)}`;
  return out;
}

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

export function taxIdLabel(value: string | null | undefined) {
  const digits = (value ?? '').replace(/\D/g, '');
  if (digits.length === 11) return 'CPF';
  if (digits.length === 14) return 'CNPJ';
  return 'CPF ou CNPJ';
}

/** Mensagem do campo. No cadastro, vazio também é erro. */
export function cnpjFieldError(value: string, required = false) {
  const digits = value.replace(/\D/g, '');
  if (!digits) return required ? 'Informe o CPF ou CNPJ.' : null;
  if (digits.length < 11) return 'CPF ou CNPJ incompleto.';
  if (digits.length === 11) return isValidCpf(digits) ? null : 'CPF inválido.';
  if (digits.length < 14) return 'CNPJ incompleto.';
  return isValidCnpj(digits) ? null : 'CNPJ inválido.';
}
