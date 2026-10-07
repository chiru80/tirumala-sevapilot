/** @type {import('tailwindcss').Config} */
export default {
  content: [
    './src/**/*.{ts,tsx,html}',
    './sidepanel.html',
    './popup.html',
    './options.html',
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        // TTD Temple Purple — Primary Brand Identity
        ttd: {
          50: '#FAF5FF',
          100: '#F3E8FF',
          200: '#E9D5FF',
          300: '#D8B4FE',
          400: '#9E6BC9',
          500: '#7650A3', // ttd-purple-light
          600: '#5B2A86', // PRIMARY ttd-purple
          700: '#4A216E',
          800: '#421B68', // ttd-purple-dark
          900: '#321450',
          950: '#210B36',
        },
        // Traditional Temple Gold — Heritage, Premium Accents & Important CTAs
        gold: {
          50: '#FDFCF7',
          100: '#FCF8EC',
          200: '#F8EECE',
          300: '#F4E2A8',
          400: '#F0CC63', // temple-gold-light
          500: '#D4A72C', // temple-gold
          600: '#BA8E1F',
          700: '#A97916', // temple-gold-dark
          800: '#875E10',
          900: '#69480C',
          950: '#3F2B07',
        },
        // Temple Traditional Palettes
        temple: {
          red: '#B3261E',       // Divine / Kumkum alert red
          kumkum: '#C62828',    // Deep kumkum
          green: '#2E7D5B',     // Auspicious temple green
          'green-light': '#EBF5F0',
          ivory: '#FFFDF7',     // Main background
          cream: '#FFF8E8',     // Card & nav background
          'warm-white': '#FFFCF5',
          sand: '#F4E8D0',
        },
        // Temple Night Mode (authentic dark mode, NOT generic black/purple SaaS)
        night: {
          bg: '#211526',
          surface: '#321B3F',
          elevated: '#3F234F',
          border: 'rgba(212, 167, 44, 0.22)',
          text: '#F8EFD8',
          gold: '#B9933A',
        },
        // Semantic Surfaces
        surface: {
          light: '#FFFDF7',
          DEFAULT: '#FFFDF7',
          card: '#FFFFFF',
          cream: '#FFF8E8',
          dark: '#211526',
          'dark-elevated': '#321B3F',
        },
        // Traditional Text Palette
        devotee: {
          primary: '#321B3F',
          secondary: '#6B5A70',
          muted: '#8B7D8F',
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'sans-serif'],
        serif: ['"Noto Serif"', 'Georgia', 'Cambria', 'serif'],
      },
      fontSize: {
        'xs': ['13px', { lineHeight: '1.45' }],
        'sm': ['14px', { lineHeight: '1.5' }],
        'md': ['15px', { lineHeight: '1.5' }],
        'base': ['15px', { lineHeight: '1.5' }],
        'lg': ['16px', { lineHeight: '1.5' }],
        'xl': ['18px', { lineHeight: '1.3' }],
        '2xl': ['22px', { lineHeight: '1.25' }],
        '3xl': ['24px', { lineHeight: '1.2' }],
      },
      spacing: {
        'panel': '400px',
      },
      borderRadius: {
        'xl': '0.75rem',
        '2xl': '1rem',
      },
      backdropBlur: {
        'xs': '2px',
      },
      boxShadow: {
        '2xs': '0 1px 2px 0 rgba(0, 0, 0, 0.04)',
        'xs': '0 1px 2px 0 rgba(0, 0, 0, 0.06)',
        'temple-sm': '0 1px 3px rgba(91, 42, 134, 0.05), 0 1px 2px rgba(212, 167, 44, 0.08)',
        'temple': '0 4px 12px rgba(91, 42, 134, 0.06), 0 2px 4px rgba(212, 167, 44, 0.08)',
        'temple-gold': '0 0 0 1px rgba(212, 167, 44, 0.35), 0 4px 12px rgba(91, 42, 134, 0.12)',
      },
      animation: {
        'fade-in': 'fadeIn 0.2s ease-out',
        'slide-up': 'slideUp 0.3s ease-out',
        'slide-in-right': 'slideInRight 0.3s ease-out',
        'pulse-soft': 'pulseSoft 2s infinite',
        'gold-glow': 'goldGlow 2.5s infinite',
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        slideUp: {
          '0%': { opacity: '0', transform: 'translateY(8px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        slideInRight: {
          '0%': { opacity: '0', transform: 'translateX(8px)' },
          '100%': { opacity: '1', transform: 'translateX(0)' },
        },
        pulseSoft: {
          '0%, 100%': { opacity: '1' },
          '50%': { opacity: '0.75' },
        },
        goldGlow: {
          '0%, 100%': { borderColor: 'rgba(212, 167, 44, 0.3)' },
          '50%': { borderColor: 'rgba(212, 167, 44, 0.7)' },
        },
      },
    },
  },
  plugins: [],
};
