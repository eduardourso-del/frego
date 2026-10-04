/** Frego design tokens — single source for web + Flutter.
 *  Values match tokens.json / css/tokens.css (guia de aplicação digital, out/2026).
 */

export const colors = {
  papel: '#F4EFE6',
  grafite: '#070707',
  mostarda: '#FFD900',
  azul: '#0073C8',
  white: '#FFFFFF',
  light: {
    primary50: '#FFF6C2',
    primary100: '#FFEE8A',
    primary200: '#F6E27A',
    primary500: '#FFD900',
    primary600: '#E0BE00',
    primary800: '#070707',
    onPrimary: '#070707',
    bg: '#F4EFE6',
    card: '#FFFCF7',
    neutral100: '#EAE4DA',
    neutral200: '#D8D1C6',
    hairline: '#D8D1C6',
    control: '#82796E',
    neutral400: '#82796E',
    neutral500: '#5C544A',
    neutral700: '#3F3832',
    ink: '#070707',
    success: '#386143',
    successBg: '#E8EFE7',
    successFill: '#386143',
    danger: '#963D22',
    dangerBg: '#F8EBE5',
    dangerFill: '#963D22',
    info: '#3F505C',
    infoBg: '#E8EDF0',
    points: '#8C4A12',
    pointsBg: '#F8F1E6',
    pointsRing: '#E6D3B0',
    stamps: '#5C3D86',
    stampsBg: '#F3EEF8',
    stampsRing: '#DDD0EC',
    cashback: '#1B5E52',
    cashbackBg: '#E7F3F0',
    cashbackRing: '#C5DDD6',
    promo: '#6E3A55',
    promoBg: '#F7EEF2',
    promoRing: '#E4CFD8',
  },
} as const;

/** Shop's own color when it has not picked one. Not a Frego brand color. */
export const defaultBrandColor = '#070707';
export const defaultBrandColorDark = '#070707';

export const spacing = {
  xs: 8,
  sm: 16,
  md: 24,
  lg: 32,
  xl: 48,
  '2xl': 64,
  '3xl': 96,
} as const;

export const radius = {
  sm: 8,
  md: 8,
  lg: 16,
  xl: 16,
  pill: 999,
  icon: '22.4%',
} as const;

export const typography = {
  fontFamily: "'Instrument Sans', Arial, sans-serif",
  displayFamily: "'Source Serif 4', Georgia, serif",
  monoFamily: "'Source Code Pro', ui-monospace, monospace",
  weights: { regular: 400, semibold: 600, extrabold: 700 },
  display: { size: 40, lineHeight: 44, weight: 400, tracking: '-0.025em' },
  title: { size: 32, lineHeight: 38, weight: 600, tracking: '-0.02em' },
  section: { size: 24, lineHeight: 30, weight: 600, tracking: '-0.015em' },
  sub: { size: 18, lineHeight: 24, weight: 600, tracking: '0' },
  body: { size: 16, lineHeight: 26, weight: 400, tracking: '0' },
  support: { size: 14, lineHeight: 22, weight: 400, tracking: '0' },
  label: { size: 12, lineHeight: 16, weight: 600, tracking: '0.08em' },
  number: { size: 32, lineHeight: 34, weight: 600, tracking: '-0.02em' },
  numberSm: { size: 20, lineHeight: 24, weight: 600, tracking: '0' },
} as const;

export const motion = {
  fast: 150,
  base: 150,
  easing: 'cubic-bezier(0.2, 0, 0.2, 1)',
} as const;

export const touch = {
  minTarget: 44,
} as const;

/** Public paths after copy-brand.mjs (web apps). */
export const brand = {
  assinatura: '/brand/frego-assinatura.svg',
  assinaturaNegativa: '/brand/frego-assinatura-negativa.svg',
  assinaturaMonoEscura: '/brand/frego-assinatura-mono-escura.svg',
  assinaturaMonoClara: '/brand/frego-assinatura-mono-clara.svg',
  icone: '/brand/frego-icone-arredondado.svg',
  iconeLoja: '/brand/frego-icone-loja.svg',
  iconeNegativo: '/brand/frego-icone-negativo.svg',
  favicon32: '/brand/png/frego-favicon-32.png',
  favicon16: '/brand/png/frego-favicon-16.png',
  og: '/brand/png/frego-compartilhamento-1200x630.png',
  appleTouch: '/brand/png/frego-icone-180.png',
} as const;

export const tokens = {
  colors,
  spacing,
  radius,
  typography,
  motion,
  touch,
  brand,
  defaultBrandColor,
  defaultBrandColorDark,
} as const;

export default tokens;

export {
  BUSINESS_TYPES,
  BUSINESS_TYPE_GROUPS,
  BUSINESS_TYPE_VALUES,
  TYPE_LABEL,
  TYPES,
  businessTypeLabel,
  businessTypePlural,
  isBusinessType,
} from './business-types';
export type {
  BusinessTypeGroupId,
  BusinessTypeId,
} from './business-types';
