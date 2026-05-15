import type { Config } from 'tailwindcss'

const config: Config = {
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        // Brand
        accent: '#15524a',
        'accent-2': '#1f7a6d',
        'accent-soft': '#e9f1ef',
        // Ink
        ink: '#1a1a1a',
        'ink-soft': '#3a3a3a',
        'ink-mute': '#666666',
        // Surfaces
        paper: '#fafaf7',
        rule: '#e6e3dc',
        'rule-soft': '#f0ede5',
        // Decision state pills
        'state-proposed': '#d99543',
        'state-accepted': '#5ec087',
        'state-rejected': '#d56363',
        'state-superseded': '#a8b0bb',
        // Viewer (dark surface)
        'p-bg': '#0e1116',
        'p-surface': '#161a21',
        'p-text': '#e6e9ee',
        'p-rule': '#252b35',
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'sans-serif'],
      },
      borderRadius: {
        DEFAULT: '6px',
      },
      boxShadow: {
        card: '0 1px 2px 0 rgba(15,23,42,0.04), 0 1px 1px 0 rgba(15,23,42,0.03)',
        'card-hover': '0 4px 12px -2px rgba(15,23,42,0.08), 0 2px 4px -1px rgba(15,23,42,0.04)',
        pop: '0 12px 32px -8px rgba(15,23,42,0.16), 0 4px 12px -2px rgba(15,23,42,0.08)',
      },
      keyframes: {
        'fade-in': {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        'fade-up': {
          '0%': { opacity: '0', transform: 'translateY(8px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        'scale-in': {
          '0%': { opacity: '0', transform: 'scale(0.96)' },
          '100%': { opacity: '1', transform: 'scale(1)' },
        },
        'pin-bounce': {
          '0%,100%': { transform: 'translateY(0)' },
          '50%': { transform: 'translateY(-3px)' },
        },
        'slide-in-right': {
          '0%': { opacity: '0', transform: 'translateX(16px)' },
          '100%': { opacity: '1', transform: 'translateX(0)' },
        },
      },
      animation: {
        'fade-in': 'fade-in 180ms ease-out',
        'fade-up': 'fade-up 220ms ease-out',
        'scale-in': 'scale-in 180ms ease-out',
        'pin-bounce': 'pin-bounce 1.6s ease-in-out infinite',
        'slide-in-right': 'slide-in-right 220ms ease-out',
      },
    },
  },
  plugins: [],
}
export default config
