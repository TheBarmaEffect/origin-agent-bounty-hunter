export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        // Brand
        brand: '#FF6B00',
        'brand-bright': '#FF8C3D',
        accent: '#3B8BFF',
        violet: '#9B6DFF',
        gold: '#FFB830',
        gold2: '#FFD700',

        // Status
        win: '#22C55E',
        winBright: '#34D399',
        lose: '#FF4455',
        loseBright: '#FF6B7D',
        warn: '#F59E0B',
        audit: '#F59E0B',

        // Surfaces
        bg: '#050510',
        ink: '#0D0A1E',
        surface: '#0C0C18',
        border: '#1F1F2E',
        muted: '#44445A',

        // Agent identity colors
        scout:   '#3B8BFF',
        drill:   '#9B6DFF',
        compass: '#FF6B00',
        dice:    '#FFB830',
        dash:    '#22C55E',
      },
      fontFamily: {
        sans: ['Inter', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono', 'Fira Code', 'monospace'],
        display: ['Inter', 'system-ui', 'sans-serif'],
      },
      backdropBlur: {
        '3xl': '40px',
        '4xl': '60px',
      },
      keyframes: {
        'orb-drift':   { '0%,100%': { transform: 'translate(0,0) scale(1)' }, '50%': { transform: 'translate(30px,-20px) scale(1.05)' } },
        'orb-drift-2': { '0%,100%': { transform: 'translate(0,0) scale(1)' }, '50%': { transform: 'translate(-25px,15px) scale(1.08)' } },
        'specular-slide': { '0%,100%': { backgroundPosition: '-200% 0' }, '50%': { backgroundPosition: '200% 0' } },
        'pulse-soft':  { '0%,100%': { opacity: '0.4' }, '50%': { opacity: '1' } },
        'shake':       { '0%,100%': { transform: 'translateX(0)' }, '20%,60%': { transform: 'translateX(-6px)' }, '40%,80%': { transform: 'translateX(6px)' } },
        'scan-line':   { '0%': { transform: 'translateY(-100%)' }, '100%': { transform: 'translateY(100%)' } },
      },
      animation: {
        'orb-drift':   'orb-drift 18s ease-in-out infinite',
        'orb-drift-2': 'orb-drift-2 22s ease-in-out infinite',
        'specular':    'specular-slide 6s ease-in-out infinite',
        'pulse-soft':  'pulse-soft 1.6s ease-in-out infinite',
        'shake':       'shake 0.4s ease-in-out',
        'scan-line':   'scan-line 3s linear infinite',
      },
    }
  },
  plugins: []
}
