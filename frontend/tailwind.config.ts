import type { Config } from 'tailwindcss';

/**
 * Sartoria design tokens (clean minimal: neutrals + one indigo accent). Colours are CSS variables (see src/styles/index.css) so the admin
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
        charcoal: { ...scale('charcoal', steps), DEFAULT: 'rgb(var(--charcoal-800) / <alpha-value>)' },
        stone: { ...scale('stone', steps), DEFAULT: 'rgb(var(--stone-400) / <alpha-value>)' },
        iris: { ...scale('iris', steps), DEFAULT: 'rgb(var(--iris-300) / <alpha-value>)' },
        paper: { ...scale('paper', [50, 100, 200, 300]), DEFAULT: 'rgb(var(--paper-100) / <alpha-value>)' },
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
        display: ['"Inter Variable"', 'Inter', 'system-ui', '-apple-system', 'Segoe UI', 'sans-serif'],
        sans: ['"Inter Variable"', 'Inter', 'system-ui', '-apple-system', 'Segoe UI', 'sans-serif'],
      },
      fontSize: {
        'display-2xl': ['clamp(2.5rem, 1.5rem + 4.2vw, 5rem)', { lineHeight: '1.02', letterSpacing: '-0.04em' }],
        'display-xl': ['clamp(2rem, 1.35rem + 2.7vw, 3.5rem)', { lineHeight: '1.06', letterSpacing: '-0.035em' }],
        'display-lg': ['clamp(1.75rem, 1.3rem + 1.8vw, 2.625rem)', { lineHeight: '1.1', letterSpacing: '-0.03em' }],
        'display-md': ['clamp(1.375rem, 1.15rem + 0.9vw, 1.875rem)', { lineHeight: '1.18', letterSpacing: '-0.025em' }],
        'display-sm': ['1.25rem', { lineHeight: '1.3', letterSpacing: '-0.02em' }],
        eyebrow: ['0.75rem', { lineHeight: '1rem', letterSpacing: '0.08em' }],
      },
      letterSpacing: {
        wordmark: '0.18em',
      },
      borderRadius: {
        xs: '8px',
        sm: '12px',
        DEFAULT: '12px',
        md: '16px',
      },
      boxShadow: {
        soft: '0 1px 2px rgb(0 0 0 / 0.04), 0 2px 8px -2px rgb(0 0 0 / 0.06)',
        lift: '0 1px 3px rgb(0 0 0 / 0.06), 0 16px 40px -12px rgb(0 0 0 / 0.18)',
        drawer: '-24px 0 60px -20px rgb(0 0 0 / 0.25)',
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
