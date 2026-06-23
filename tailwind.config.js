/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        // Vibrant brand palette
        brand: {
          50: '#FFF3EF',
          100: '#FFE2D6',
          200: '#FFC4AD',
          300: '#FF9E7A',
          400: '#FF7A4D',
          500: '#FF5630', // primary orange
          600: '#ED3B12',
          700: '#C42D0C',
          800: '#9B2810',
          900: '#7E2613',
        },
        teal: {
          50: '#ECFEFB',
          100: '#CFFBF4',
          200: '#9FF5EA',
          300: '#63E9DC',
          400: '#2DD4C4',
          500: '#0EA5A4', // accent teal
          600: '#0A8585',
          700: '#0C6A6B',
          800: '#0F5455',
          900: '#114748',
        },
        ink: {
          DEFAULT: '#0B1020',
          soft: '#3A4253',
          muted: '#6B7280',
        },
        cloud: '#F7F8FB',
      },
      fontFamily: {
        display: ['"Plus Jakarta Sans"', 'system-ui', 'sans-serif'],
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
      boxShadow: {
        soft: '0 10px 40px -12px rgba(11, 16, 32, 0.18)',
        glow: '0 20px 60px -15px rgba(255, 86, 48, 0.45)',
        card: '0 4px 24px -8px rgba(11, 16, 32, 0.12)',
      },
      backgroundImage: {
        'hero-grad':
          'radial-gradient(1200px 600px at 80% -10%, rgba(255,86,48,0.18), transparent), radial-gradient(900px 500px at 10% 10%, rgba(14,165,164,0.16), transparent)',
        'brand-grad': 'linear-gradient(135deg, #FF5630 0%, #FF8A5B 45%, #0EA5A4 120%)',
      },
      keyframes: {
        float: {
          '0%, 100%': { transform: 'translateY(0px)' },
          '50%': { transform: 'translateY(-14px)' },
        },
        'float-slow': {
          '0%, 100%': { transform: 'translateY(0px) rotate(0deg)' },
          '50%': { transform: 'translateY(-22px) rotate(3deg)' },
        },
        shimmer: {
          '0%': { backgroundPosition: '200% 0' },
          '100%': { backgroundPosition: '-200% 0' },
        },
      },
      animation: {
        float: 'float 6s ease-in-out infinite',
        'float-slow': 'float-slow 9s ease-in-out infinite',
        shimmer: 'shimmer 2.5s linear infinite',
      },
    },
  },
  plugins: [],
}
