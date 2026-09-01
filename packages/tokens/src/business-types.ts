/** Establishment categories stored on `Business.type`.
 *  Keep in sync with packages/tokens/lib/src/business_types.dart
 */

export const BUSINESS_TYPE_GROUPS = [
  { id: 'food', label: 'Alimentação' },
  { id: 'beauty', label: 'Beleza' },
  { id: 'commerce', label: 'Comércio' },
  { id: 'services', label: 'Serviços' },
] as const;

export type BusinessTypeGroupId =
  (typeof BUSINESS_TYPE_GROUPS)[number]['id'];

export const BUSINESS_TYPES = [
  { value: 'padaria', label: 'Padaria', plural: 'Padarias', group: 'food' },
  { value: 'café', label: 'Café', plural: 'Cafés', group: 'food' },
  {
    value: 'restaurant',
    label: 'Restaurante',
    plural: 'Restaurantes',
    group: 'food',
  },
  { value: 'pizzaria', label: 'Pizzaria', plural: 'Pizzarias', group: 'food' },
  {
    value: 'hamburgueria',
    label: 'Hamburgueria',
    plural: 'Hamburguerias',
    group: 'food',
  },
  {
    value: 'lanchonete',
    label: 'Lanchonete',
    plural: 'Lanchonetes',
    group: 'food',
  },
  { value: 'acai', label: 'Açaí', plural: 'Açaí', group: 'food' },
  { value: 'bar', label: 'Bar', plural: 'Bares', group: 'food' },
  {
    value: 'sorveteria',
    label: 'Sorveteria',
    plural: 'Sorveterias',
    group: 'food',
  },
  { value: 'doceria', label: 'Doceria', plural: 'Docerias', group: 'food' },
  { value: 'beauty', label: 'Salão', plural: 'Salões', group: 'beauty' },
  {
    value: 'barbearia',
    label: 'Barbearia',
    plural: 'Barbearias',
    group: 'beauty',
  },
  { value: 'retail', label: 'Varejo', plural: 'Varejo', group: 'commerce' },
  {
    value: 'farmacia',
    label: 'Farmácia',
    plural: 'Farmácias',
    group: 'commerce',
  },
  { value: 'pet', label: 'Pet', plural: 'Pet', group: 'commerce' },
  {
    value: 'academia',
    label: 'Academia',
    plural: 'Academias',
    group: 'services',
  },
  { value: 'outros', label: 'Outros', plural: 'Outros', group: 'services' },
] as const;

export type BusinessTypeId = (typeof BUSINESS_TYPES)[number]['value'];

export const BUSINESS_TYPE_VALUES = BUSINESS_TYPES.map(
  (t) => t.value,
) as unknown as [BusinessTypeId, ...BusinessTypeId[]];

export function isBusinessType(value: string): value is BusinessTypeId {
  return (BUSINESS_TYPE_VALUES as readonly string[]).includes(value);
}

export function businessTypeLabel(value: string | null | undefined): string {
  if (!value) return 'Outros';
  return BUSINESS_TYPES.find((t) => t.value === value)?.label ?? value;
}

export function businessTypePlural(value: string | null | undefined): string {
  if (!value) return 'Outros';
  return BUSINESS_TYPES.find((t) => t.value === value)?.plural ?? value;
}

export const TYPE_LABEL: Record<string, string> = Object.fromEntries(
  BUSINESS_TYPES.map((t) => [t.value, t.label]),
);

export const TYPES = BUSINESS_TYPES.map((t) => ({
  value: t.value,
  label: t.label,
}));
