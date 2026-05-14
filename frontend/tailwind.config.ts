import type { Config } from 'tailwindcss'

const config: Config = {
  content: ['./src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        primary: {
          DEFAULT: '#15524a',
          50: '#eef6f4',
          100: '#d0e7e2',
          200: '#a3cec5',
          300: '#71b1a4',
          400: '#3f9385',
          500: '#15524a',
          600: '#114841',
          700: '#0e3b35',
          800: '#0a2d29',
          900: '#06201d',
        },
        // DATAVERS.AI brand cyan used in the logo lockup.
        brand: {
          DEFAULT: '#06b6d4',
          50: '#ecfeff',
          100: '#cffafe',
          200: '#a5f3fc',
          300: '#67e8f9',
          400: '#22d3ee',
          500: '#06b6d4',
          600: '#0891b2',
          700: '#0e7490',
          800: '#155e75',
          900: '#164e63',
        },
      },
      fontFamily: {
        sans: ['ui-sans-serif', 'system-ui', '-apple-system', 'Segoe UI', 'Roboto', 'sans-serif'],
      },
    },
  },
  plugins: [],
}

export default config
