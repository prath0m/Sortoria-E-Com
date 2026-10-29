import type { Config } from 'tailwindcss';

/**
 * Sartoria design tokens. Colours are CSS variables (see src/styles/index.css) so the admin
 * dark theme can remap them; every scale is generated and contrast-checked (see CLAUDE.md).
 */
const scale = (name: string, steps: (string | number)[]) =>
  Object.fromEntries(steps.map((s) => [s, `rgb(var(--${name}-${s}) / <alpha-value>)`]));

const steps = [50, 100, 200, 300, 400, 500, 600, 700, 800, 900, 950];

export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  darkMode: 'class',
  theme: {
    screens: {
      xs: '360px',
      sm: '640px',
      md: '768px',
      lg: '1024px',
      xl: '1280px',
      '2xl': '1440px',
    },
    extend: {
      colors: {
        burgundy: { ...scale('burgundy', steps), DEFAULT: 'rgb(var(--burgundy-800) / <alpha-value>)' },
        sage: { ...scale('sage', steps), DEFAULT: 'rgb(var(--sage-400) / <alpha-value>)' },
        gold: { ...scale('gold', steps), DEFAULT: 'rgb(var(--gold-300) / <alpha-value>)' },
        cream: { ...scale('cream', [50, 100, 200, 300]), DEFAULT: 'rgb(var(--cream-100) / <alpha-value>)' },
        ink: {
          DEFAULT: 'rgb(var(--ink) / <alpha-value>)',
          soft: 'rgb(var(--ink-soft) / <alpha-value>)',
          muted: 'rgb(var(--ink-muted) / <alpha-value>)',
        },
        surface: {
          DEFAULT: 'rgb(var(--surface) / <alpha-value>)',
          raised: 'rgb(var(--surface-raised) / <alpha-value>)',
          sunken: 'rgb(var(--surface-sunken) / <alpha-value>)',
        },
        line: {
          DEFAULT: 'rgb(var(--line) / <alpha-value>)',
          strong: 'rgb(var(--line-strong) / <alpha-value>)',
        },
        primary: {
          DEFAULT: 'rgb(var(--primary) / <alpha-value>)',
          hover: 'rgb(var(--primary-hover) / <alpha-value>)',
          on: 'rgb(var(--on-primary) / <alpha-value>)',
        },
        accent: {
          DEFAULT: 'rgb(var(--accent) / <alpha-value>)',
          soft: 'rgb(var(--accent-soft) / <alpha-value>)',
        },
        shade: 'rgb(var(--shade) / <alpha-value>)',
        success: 'rgb(var(--success) / <alpha-value>)',
        danger: 'rgb(var(--danger) / <alpha-value>)',
        warning: 'rgb(var(--warning) / <alpha-value>)',
      },
      fontFamily: {
        display: ['"Cormorant Garamond"', 'Georgia', 'serif'],
        sans: ['Manrope', 'system-ui', '-apple-system', 'Segoe UI', 'sans-serif'],
      },
      fontSize: {
        'display-2xl': ['clamp(2.75rem, 1.6rem + 4.8vw, 5.75rem)', { lineHeight: '1.02', letterSpacing: '-0.01em' }],
        'display-xl': ['clamp(2.25rem, 1.5rem + 3vw, 4rem)', { lineHeight: '1.06', letterSpacing: '-0.005em' }],
        'display-lg': ['clamp(1.875rem, 1.4rem + 1.9vw, 3rem)', { lineHeight: '1.1' }],
        'display-md': ['clamp(1.5rem, 1.25rem + 1vw, 2.125rem)', { lineHeight: '1.15' }],
        'display-sm': ['1.375rem', { lineHeight: '1.25' }],
        eyebrow: ['0.6875rem', { lineHeight: '1rem', letterSpacing: '0.24em' }],
      },
      letterSpacing: {
        wordmark: '0.32em',
      },
      borderRadius: {
        xs: '2px',
        sm: '4px',
        DEFAULT: '6px',
        md: '8px',
      },
      boxShadow: {
        soft: '0 1px 2px rgb(42 20 19 / 0.04), 0 4px 16px -4px rgb(42 20 19 / 0.08)',
        lift: '0 2px 4px rgb(42 20 19 / 0.04), 0 18px 40px -12px rgb(42 20 19 / 0.22)',
        drawer: '-24px 0 60px -20px rgb(42 20 19 / 0.35)',
        ring: '0 0 0 1px rgb(var(--line) / 1)',
      },
      transitionTimingFunction: {
        luxe: 'cubic-bezier(.22,1,.36,1)',
        'in-out-soft': 'cubic-bezier(.65,0,.35,1)',
      },
      transitionDuration: {
        250: '250ms',
        400: '400ms',
        700: '700ms',
        1200: '1200ms',
      },
      maxWidth: {
        page: '1440px',
        prose: '68ch',
      },
      keyframes: {
        shimmer: { '100%': { transform: 'translateX(100%)' } },
        'fade-in': { from: { opacity: '0' }, to: { opacity: '1' } },
        marquee: { from: { transform: 'translateX(0)' }, to: { transform: 'translateX(-50%)' } },
      },
      animation: {
        shimmer: 'shimmer 1.6s infinite',
        'fade-in': 'fade-in .4s cubic-bezier(.22,1,.36,1) both',
        marquee: 'marquee 40s linear infinite',
      },
      zIndex: {
        header: '40',
        drawer: '60',
        modal: '70',
        toast: '80',
      },
    },
  },
  plugins: [],
} satisfies Config;
