import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./app/**/*.{ts,tsx}', './components/**/*.{ts,tsx}', './lib/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        bg: 'var(--bg)',
        'bg-deep': 'var(--bg-deep)',
        card: 'var(--card)',
        'card-2': 'var(--card-2)',
        ink: 'var(--ink)',
        'ink-2': 'var(--ink-2)',
        'ink-3': 'var(--ink-3)',
        line: 'var(--line)',
        'line-soft': 'var(--line-soft)',
        espresso: 'var(--espresso)',
        sand: 'var(--sand)',
        accent: 'var(--accent)',
        'accent-deep': 'var(--accent-deep)',
        'accent-warm': 'var(--accent-warm)',
        verdict: {
          excellent: 'var(--verdict-excellent)',
          good: 'var(--verdict-good)',
          fair: 'var(--verdict-fair)',
          poor: 'var(--verdict-poor)',
          bad: 'var(--verdict-bad)',
        },
      },
      fontFamily: {
        sans: ['Manrope', 'ui-rounded', 'system-ui', 'sans-serif'],
        display: ['Fraunces', 'Iowan Old Style', 'Georgia', 'serif'],
      },
      borderRadius: {
        card: '22px',
        pill: '999px',
      },
      boxShadow: {
        card: 'var(--shadow-soft)',
        lift: 'var(--shadow-lift)',
      },
    },
  },
  plugins: [],
};

export default config;
