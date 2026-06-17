import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./app/**/*.{ts,tsx}', './components/**/*.{ts,tsx}', './lib/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        bg: 'var(--bg)',
        card: 'var(--card)',
        'card-2': 'var(--card-2)',
        ink: 'var(--ink)',
        'ink-2': 'var(--ink-2)',
        'ink-3': 'var(--ink-3)',
        line: 'var(--line)',
        espresso: 'var(--espresso)',
        sand: 'var(--sand)',
        accent: 'var(--accent)',
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
      },
      borderRadius: {
        card: '18px',
      },
      boxShadow: {
        card: '0 1px 2px rgba(46, 42, 34, 0.04), 0 8px 24px rgba(46, 42, 34, 0.04)',
      },
    },
  },
  plugins: [],
};

export default config;
