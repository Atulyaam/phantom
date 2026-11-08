import type { Config } from 'tailwindcss';

export default {
  content: ['./src/**/*.{html,ts,tsx}', './src/entrypoints/**/*.{html,ts,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        base: 'var(--color-bg-base)',
        surface: {
          DEFAULT: 'var(--color-bg-surface)',
          raised: 'var(--color-bg-surface-raised)',
          overlay: 'var(--color-bg-surface-overlay)',
          subtle: 'var(--color-bg-subtle)',
        },
        spectral: {
          purple: 'var(--color-spectral-purple)',
          cyan: 'var(--color-spectral-cyan)',
          accent: 'var(--color-text-accent)',
        },
        severity: {
          critical: 'var(--color-severity-critical)',
          serious: 'var(--color-severity-serious)',
          moderate: 'var(--color-severity-moderate)',
          minor: 'var(--color-severity-minor)',
          unknown: 'var(--color-severity-unknown)',
        },
        room: {
          haunted: 'var(--color-room-haunted)',
          quiet: 'var(--color-room-quiet)',
          manual: 'var(--color-room-manual)',
        },
      },
      fontFamily: {
        sans: 'var(--font-sans)',
        mono: 'var(--font-mono)',
        display: 'var(--font-display)',
      },
      boxShadow: {
        mansion: 'var(--shadow-mansion-card)',
        glow: 'var(--shadow-mansion-glow)',
      },
    },
  },
  plugins: [],
} satisfies Config;
