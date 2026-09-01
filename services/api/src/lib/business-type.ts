import { z } from 'zod';

/** Keep in sync with packages/tokens/src/business-types.ts */
export const BUSINESS_TYPE_VALUES = [
  'padaria',
  'café',
  'restaurant',
  'pizzaria',
  'hamburgueria',
  'lanchonete',
  'acai',
  'bar',
  'sorveteria',
  'doceria',
  'beauty',
  'barbearia',
  'retail',
  'farmacia',
  'pet',
  'academia',
  'outros',
] as const;

export const businessTypeSchema = z.enum(BUSINESS_TYPE_VALUES);
