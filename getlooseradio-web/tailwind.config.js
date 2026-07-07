/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        'glr-black': '#0a0a0a',
        'glr-purple': '#9333ea',
        'glr-purple-light': '#a855f7',
        'glr-purple-dark': '#7e22ce',
        'glr-gold': '#f59e0b',
        'glr-gold-light': '#fbbf24',
        'glr-red': '#ef4444',
        'glr-text': '#f8fafc',
        'glr-muted': '#94a3b8',
        'glr-card': 'rgba(255,255,255,0.04)',
        'glr-border': 'rgba(147,51,234,0.25)',
      },
      fontFamily: {
        heading: ['"Bebas Neue"', 'cursive'],
        body: ['Inter', 'sans-serif'],
      },
      backgroundImage: {
        'gradient-radial': 'radial-gradient(var(--tw-gradient-stops))',
        'hero-glow': 'radial-gradient(ellipse 80% 50% at 50% -20%, rgba(147,51,234,0.35) 0%, transparent 60%)',
      },
      animation: {
        'pulse-slow': 'pulse 2.5s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'spin-slow': 'spin 8s linear infinite',
        'glow-pulse': 'glow-pulse 2s ease-in-out infinite',
        'slide-up': 'slideUp 0.5s ease-out forwards',
        'float': 'float 6s ease-in-out infinite',
      },
      keyframes: {
        'glow-pulse': {
          '0%, 100%': { boxShadow: '0 0 8px rgba(239,68,68,0.8), 0 0 20px rgba(239,68,68,0.4)' },
          '50%': { boxShadow: '0 0 20px rgba(239,68,68,1), 0 0 40px rgba(239,68,68,0.6)' },
        },
        'slideUp': {
          '0%': { transform: 'translateY(100%)', opacity: '0' },
          '100%': { transform: 'translateY(0)', opacity: '1' },
        },
        'float': {
          '0%, 100%': { transform: 'translateY(0px)' },
          '50%': { transform: 'translateY(-12px)' },
        },
      },
      backdropBlur: {
        xs: '2px',
      },
    },
  },
  plugins: [],
}
