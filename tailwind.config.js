/** @type {import('tailwindcss').Config} */

// Glacier design system. Every colour resolves to a CSS variable from
// src/styles/glacier-tokens.css, so light and dark themes come from the
// tokens, not from per-class dark variants.
const STEPS = [50, 100, 200, 300, 400, 500, 600, 700, 800, 900, 950];
const scale = (family) =>
  Object.fromEntries(STEPS.map((s) => [s, `rgb(var(--g-${family}-${s}) / <alpha-value>)`]));
const token = (name) => `rgb(var(--g-${name}) / <alpha-value>)`;

const neutral = scale('neutral');
const accent = scale('accent');
const success = scale('success');
const danger = scale('danger');
const warning = scale('warning');

export default {
  darkMode: 'class',
  content: [
    "./index.html",
    // Source only: the committed build output under src/*/dist would otherwise be scanned
    "./src/**/*.{ts,tsx}",
    "./src/*/index.html",
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['var(--g-font-sans)'],
        mono: ['var(--g-font-mono)'],
      },
      fontWeight: {
        // Glacier uses Onest 400 / 500 / 600 only
        bold: '600',
        extrabold: '600',
        black: '600',
      },
      colors: {
        white: token('white'),

        // Legacy palettes, mapped onto Glacier roles so existing classes follow the system
        gray: neutral, zinc: neutral, slate: neutral, neutral, stone: neutral,
        primary: accent, blue: accent, sky: accent, cyan: accent, teal: accent,
        indigo: accent, violet: accent, purple: accent, fuchsia: accent,
        green: success, emerald: success, lime: success,
        red: danger, rose: danger, pink: danger,
        amber: warning, yellow: warning, orange: warning,

        // Glacier semantic tokens (prefer these in new code)
        canvas: token('bg-canvas'),
        surface: { DEFAULT: token('bg-surface'), alt: token('bg-surface-alt') },
        subtle: token('bg-subtle'),
        'neutral-badge': token('bg-neutral-badge'),
        chrome: 'var(--g-bg-chrome)',
        hover: 'var(--g-bg-hover)',
        selected: 'var(--g-bg-selected)',
        stroke: {
          card: token('stroke-card'),
          divider: token('stroke-divider'),
          control: token('stroke-control'),
          accessible: token('stroke-accessible'),
        },
        fg: {
          DEFAULT: token('fg'),
          muted: token('fg-muted'),
          subtle: token('fg-subtle'),
          'on-solid': token('fg-on-solid'),
        },
        accent: {
          ...accent,
          DEFAULT: token('accent'),
          on: token('on-accent'),
          text: token('accent-text'),
          subtle: token('accent-subtle'),
          'subtle-2': token('accent-subtle-2'),
          'subtle-fg': token('accent-subtle-fg'),
          strong: token('accent-strong'),
        },
        'on-accent': token('on-accent'),
        'app-icon': { 1: token('app-icon-1'), 2: token('app-icon-2') },
        danger: { ...danger, fg: token('danger-fg'), bg: token('danger-bg'), solid: token('danger-solid') },
        warning: { ...warning, fg: token('warning-fg'), bg: token('warning-bg') },
        success: { ...success, fg: token('success-fg'), bg: token('success-bg') },
        focus: { outer: token('focus-outer'), inner: token('focus-inner') },
      },
      boxShadow: {
        sm: 'var(--g-shadow-raised)',
        DEFAULT: 'var(--g-shadow-card)',
        md: 'var(--g-shadow-card)',
        card: 'var(--g-shadow-card)',
        raised: 'var(--g-shadow-raised)',
        lg: 'var(--g-shadow-dialog)',
        xl: 'var(--g-shadow-dialog)',
        '2xl': 'var(--g-shadow-dialog)',
        dialog: 'var(--g-shadow-dialog)',
        flyout: 'var(--g-shadow-flyout)',
      },
      height: { control: '32px', 'control-lg': '40px' },
      width: { sidebar: '240px' },
      backdropBlur: {
        xs: '2px',
      },
    },
  },
  plugins: [],
}
