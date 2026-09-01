/** @type {import('tailwindcss').Config} */
module.exports = {
  theme: {
    extend: {
      colors: {
        primary: {
          50: 'var(--color-primary-50)',
          100: 'var(--color-primary-100)',
          200: 'var(--color-primary-200)',
          500: 'var(--color-primary-500)',
          600: 'var(--color-primary-600)',
          800: 'var(--color-primary-800)',
          DEFAULT: 'var(--color-primary-500)',
        },
        'on-primary': 'var(--color-on-primary)',
        ink: 'var(--color-ink)',
        card: 'var(--color-card)',
        hairline: 'var(--color-hairline)',
        control: 'var(--color-control)',
        success: {
          DEFAULT: 'var(--color-success)',
          bg: 'var(--color-success-bg)',
          fill: 'var(--color-success-fill)',
        },
        info: {
          DEFAULT: 'var(--color-info)',
          bg: 'var(--color-info-bg)',
        },
        warning: {
          DEFAULT: 'var(--color-warning)',
          bg: 'var(--color-warning-bg)',
        },
        danger: {
          DEFAULT: 'var(--color-danger)',
          bg: 'var(--color-danger-bg)',
          fill: 'var(--color-danger-fill)',
        },
        points: {
          DEFAULT: 'var(--color-points)',
          bg: 'var(--color-points-bg)',
          ring: 'var(--color-points-ring)',
        },
        stamps: {
          DEFAULT: 'var(--color-stamps)',
          bg: 'var(--color-stamps-bg)',
          ring: 'var(--color-stamps-ring)',
        },
        surface: 'var(--color-bg)',
        muted: 'var(--color-neutral-500)',
        faint: 'var(--color-neutral-400)',
        track: 'var(--color-neutral-100)',
        border: 'var(--color-neutral-200)',
      },
      fontFamily: {
        sans: ['var(--font-sans)'],
        mono: ['var(--font-mono)'],
      },
      fontWeight: {
        regular: 'var(--weight-regular)',
        semibold: 'var(--weight-semibold)',
        extrabold: 'var(--weight-extrabold)',
      },
      borderRadius: {
        sm: 'var(--radius-sm)',
        md: 'var(--radius-md)',
        lg: 'var(--radius-lg)',
        xl: 'var(--radius-xl)',
        pill: 'var(--radius-pill)',
      },
      boxShadow: {
        card: 'var(--shadow-card)',
        raised: 'var(--shadow-raised)',
        focus: 'var(--shadow-focus)',
        cta: 'var(--shadow-cta)',
        sheet: 'var(--shadow-sheet)',
      },
      spacing: {
        xs: 'var(--space-xs)',
        sm: 'var(--space-sm)',
        md: 'var(--space-md)',
        lg: 'var(--space-lg)',
        xl: 'var(--space-xl)',
        '2xl': 'var(--space-2xl)',
        '3xl': 'var(--space-3xl)',
      },
    },
  },
};
