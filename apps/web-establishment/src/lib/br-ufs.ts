/** Keep in step with services/api/src/lib/br-fuso.ts */
export const BR_UFS = [
  ['AC', 'Acre'],
  ['AL', 'Alagoas'],
  ['AP', 'Amapá'],
  ['AM', 'Amazonas'],
  ['BA', 'Bahia'],
  ['CE', 'Ceará'],
  ['DF', 'Distrito Federal'],
  ['ES', 'Espírito Santo'],
  ['GO', 'Goiás'],
  ['MA', 'Maranhão'],
  ['MT', 'Mato Grosso'],
  ['MS', 'Mato Grosso do Sul'],
  ['MG', 'Minas Gerais'],
  ['PA', 'Pará'],
  ['PB', 'Paraíba'],
  ['PR', 'Paraná'],
  ['PE', 'Pernambuco'],
  ['PI', 'Piauí'],
  ['RJ', 'Rio de Janeiro'],
  ['RN', 'Rio Grande do Norte'],
  ['RS', 'Rio Grande do Sul'],
  ['RO', 'Rondônia'],
  ['RR', 'Roraima'],
  ['SC', 'Santa Catarina'],
  ['SP', 'São Paulo'],
  ['SE', 'Sergipe'],
  ['TO', 'Tocantins'],
] as const;

export type OperatingAddress = {
  postalCode: string;
  street: string;
  streetNumber: string;
  complement: string;
  neighborhood: string;
  city: string;
  state: string;
};

export type AddressField = keyof OperatingAddress;

export function emptyOperatingAddress(): OperatingAddress {
  return {
    postalCode: '',
    street: '',
    streetNumber: '',
    complement: '',
    neighborhood: '',
    city: '',
    state: '',
  };
}

export function formatCep(raw: string) {
  const digits = raw.replace(/\D/g, '').slice(0, 8);
  if (digits.length <= 5) return digits;
  return `${digits.slice(0, 5)}-${digits.slice(5)}`;
}

export function operatingAddressErrors(
  value: OperatingAddress,
): Partial<Record<AddressField, string>> {
  const errors: Partial<Record<AddressField, string>> = {};
  if (value.postalCode.replace(/\D/g, '').length !== 8) {
    errors.postalCode = 'Informe um CEP com 8 dígitos.';
  }
  if (!value.street.trim()) errors.street = 'Campo obrigatório.';
  if (!value.streetNumber.trim()) errors.streetNumber = 'Campo obrigatório.';
  if (!value.neighborhood.trim()) errors.neighborhood = 'Campo obrigatório.';
  if (!value.city.trim()) errors.city = 'Campo obrigatório.';
  if (!value.state) errors.state = 'Escolha o estado.';
  return errors;
}

export type CepHit = {
  street: string;
  neighborhood: string;
  city: string;
  state: string;
};

export async function lookupCep(cep: string): Promise<CepHit | null> {
  const digits = cep.replace(/\D/g, '');
  if (digits.length !== 8) return null;
  const res = await fetch(`https://viacep.com.br/ws/${digits}/json/`);
  if (!res.ok) throw new Error('Não foi possível buscar o CEP.');
  const json = (await res.json()) as {
    erro?: boolean;
    logradouro?: string;
    bairro?: string;
    localidade?: string;
    uf?: string;
  };
  if (!json || json.erro || !json.uf) return null;
  return {
    street: json.logradouro ?? '',
    neighborhood: json.bairro ?? '',
    city: json.localidade ?? '',
    state: json.uf,
  };
}
