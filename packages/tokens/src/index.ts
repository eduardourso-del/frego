/** Frego design tokens — single source for web + Flutter.
 *  Values match tokens.json / css/tokens.css (guia de estilos, ago/2026).
 *  When the definitive brand arrives, update tokens.json + tokens.css and this file.
 */

export const colors = {
  light: {
    primary50: '#EEF2FB',
    primary100: '#DCE4F7',
    primary200: '#B4C4EA',
    primary500: '#24479C',
    primary600: '#1B3781',
    primary800: '#101F45',
    onPrimary: '#FFFFFF',
    bg: '#F7F8FA',
    card: '#FFFFFF',
    neutral100: '#F1F3F6',
    neutral200: '#E4E7EC',
    hairline: '#E4E8EE',
    control: '#868C96',
    neutral400: '#98A0AB',
    neutral500: '#5F6672',
    neutral700: '#3F444F',
    ink: '#16181D',
    success: '#12805A',
    successBg: '#E6F6EE',
    successFill: '#2BB37E',
    danger: '#C4342A',
    dangerBg: '#FDECEB',
    dangerFill: '#DF4138',
    info: '#24479C',
    infoBg: '#EEF2FB',
    points: '#B45309',
    pointsBg: '#FFFBEB',
    pointsRing: '#FDE68A',
    stamps: '#6D28D9',
    stampsBg: '#F5F3FF',
    stampsRing: '#DDD6FE',
    cashback: '#0F766E',
    cashbackBg: '#F0FDFA',
    cashbackRing: '#99F6E4',
  },
  dark: {
    primary500: '#5C82DE',
    primary600: '#4A6FD1',
    primary800: '#DCE4F7',
    onPrimary: '#0C0D10',
    bg: '#0C0D10',
    card: '#15171C',
    raised: '#1D2026',
    hairline: '#2A2E37',
    control: '#666D78',
    neutral200: '#2A2E37',
    neutral400: '#5B616B',
    neutral500: '#9AA0AA',
    ink: '#E8EAED',
    success: '#3ECB93',
    successBg: 'rgba(62, 203, 147, 0.14)',
    danger: '#F0584F',
    dangerBg: 'rgba(240, 88, 79, 0.14)',
    info: '#5C82DE',
    infoBg: 'rgba(92, 130, 222, 0.14)',
    points: '#FCD34D',
    pointsBg: 'rgba(180, 83, 9, 0.20)',
    pointsRing: 'rgba(252, 211, 77, 0.28)',
    stamps: '#C4B5FD',
    stampsBg: 'rgba(109, 40, 217, 0.18)',
    stampsRing: 'rgba(196, 181, 253, 0.30)',
    cashback: '#5EEAD4',
    cashbackBg: 'rgba(15, 118, 110, 0.18)',
    cashbackRing: 'rgba(94, 234, 212, 0.30)',
  },
} as const;

/** Default shop brand color when a business has not picked one. */
export const defaultBrandColor = colors.light.primary500;
export const defaultBrandColorDark = colors.light.primary600;

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
  md: 12,
  lg: 16,
  xl: 20,
  pill: 100,
  icon: '22.4%',
} as const;

export const typography = {
  fontFamily:
    "'Archivo', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
  monoFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, monospace',
  weights: { regular: 400, semibold: 600, extrabold: 800 },
  display: { size: 40, lineHeight: 44, weight: 800, tracking: '-0.03em' },
  title: { size: 32, lineHeight: 38, weight: 800, tracking: '-0.025em' },
  section: { size: 24, lineHeight: 30, weight: 800, tracking: '-0.015em' },
  sub: { size: 18, lineHeight: 24, weight: 800, tracking: '0' },
  body: { size: 16, lineHeight: 26, weight: 400, tracking: '0' },
  support: { size: 14, lineHeight: 22, weight: 400, tracking: '0' },
  label: { size: 12, lineHeight: 16, weight: 600, tracking: '0.08em' },
  number: { size: 32, lineHeight: 34, weight: 800, tracking: '-0.025em' },
  numberSm: { size: 20, lineHeight: 24, weight: 600, tracking: '0' },
} as const;

export const motion = {
  fast: 150,
  base: 250,
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
