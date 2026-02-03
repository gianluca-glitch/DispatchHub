import type { Config } from 'tailwindcss';

const config: Config = {
  darkMode: 'class',
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        // DispatchHub dark industrial palette
        background: '#0c0d0f',
        surface: {
          0: '#111318',
          1: '#191b22',
          2: '#22252e',
          3: '#2b2f3a',
        },
        border: {
          DEFAULT: '#2a2d38',
          light: '#353945',
        },
        text: {
          0: '#f0f1f4',
          1: '#c4c7d0',
          2: '#8b8f9e',
          3: '#5e6170',
        },
        amber: {
          DEFAULT: '#f59e0b',
          dim: '#b45309',
        },
        success: '#22c55e',
        danger: '#ef4444',
        info: '#3b82f6',
        purple: '#a855f7',
      },
      fontFamily: {
        sans: ['DM Sans', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono', 'monospace'],
      },
      borderRadius: {
        DEFAULT: '6px',
        lg: '10px',
      },
      boxShadow: {
        modal: '0 12px 48px rgba(0,0,0,0.6)',
      },
      keyframes: {
        'pulse-glow': {
          '0%, 100%': { opacity: '1', boxShadow: '0 0 0 0 rgba(239,68,68,0.5)' },
          '50%': { opacity: '0.7', boxShadow: '0 0 0 8px rgba(239,68,68,0)' },
        },
      },
      animation: {
        'pulse-glow': 'pulse-glow 1.5s infinite',
      },
    },
  },
  plugins: [require('@tailwindcss/typography')],
};

export default config;
