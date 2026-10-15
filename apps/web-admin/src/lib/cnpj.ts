export function formatCnpj(value: string) {
  const digits = value.replace(/\D/g, '').slice(0, 14);
  if (digits.length <= 11) {
    let out = digits.slice(0, 3);
    if (digits.length > 3) out += `.${digits.slice(3, 6)}`;
    if (digits.length > 6) out += `.${digits.slice(6, 9)}`;
    if (digits.length > 9) out += `-${digits.slice(9, 11)}`;
    return out;
  }
  let out = digits.slice(0, 2);
  if (digits.length > 2) out += `.${digits.slice(2, 5)}`;
  if (digits.length > 5) out += `.${digits.slice(5, 8)}`;
  if (digits.length > 8) out += `/${digits.slice(8, 12)}`;
  if (digits.length > 12) out += `-${digits.slice(12, 14)}`;
  return out;
}
