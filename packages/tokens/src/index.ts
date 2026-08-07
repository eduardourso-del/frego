/** Frego design tokens — single source for web + Flutter. */

export const colors = {
  light: {
    primary50: '#EEF1FD',
    primary200: '#C7D2F7',
    primary500: '#3B5BDB',
    primary600: '#2F49C4',
    primary800: '#1E2F8A',
    neutralBg: '#F7F8FA',
    neutral100: '#F1F3F6',
    neutral200: '#E4E7EC',
    neutralHairline: '#EEF0F3',
    neutral400: '#9AA0AA',
    neutral500: '#6B7280',
    neutral700: '#3F444F',
    neutralInk: '#16181D',
    card: '#FFFFFF',
    success: '#1F9D6B',
    successBg: '#E6F6EE',
    warning: '#E8920C',
    warningBg: '#FDF2E0',
    danger: '#DF4138',
    dangerBg: '#FDECEB',
  },
  dark: {
    bg: '#0C0D10',
    card: '#15171C',
    raised: '#1D2026',
    border: '#2A2E37',
    primary: '#5B78E8',
    text: '#E8EAED',
    textDim: '#9AA0AA',
    textFaint: '#5B616B',
    success: '#2BB37E',
    warning: '#F0A52C',
    danger: '#F0584F',
  },
} as const;

export const spacing = {
  xs: 8,
  sm: 16,
  md: 24,
  lg: 32,
  xl: 48,
} as const;

export const radius = {
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  pill: 999,
} as const;

export const typography = {
  fontFamily:
    "-apple-system, BlinkMacSystemFont, 'SF Pro Display', 'SF Pro Text', system-ui, sans-serif",
  monoFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
  display: { size: 40, weight: 600, tracking: '-0.03em' },
  title: { size: 28, weight: 600, tracking: '-0.02em' },
  heading: { size: 20, weight: 600, tracking: '-0.01em' },
  body: { size: 17, weight: 400, tracking: '0' },
  secondary: { size: 15, weight: 400, tracking: '0' },
  label: { size: 13, weight: 600, tracking: '0.04em' },
} as const;

export const shadow = {
  card: '0 1px 2px rgba(16,24,40,0.04)',
  raised: '0 16px 40px rgba(16,24,40,0.08)',
  floating: '0 24px 60px rgba(16,24,40,0.12)',
  button: '0 1px 2px rgba(16,24,40,0.12)',
  cta: '0 8px 20px rgba(59,91,219,0.28)',
  focus: '0 0 0 3px rgba(59,91,219,0.12)',
} as const;

export const tokens = { colors, spacing, radius, typography, shadow } as const;
export default tokens;
