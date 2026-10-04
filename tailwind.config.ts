import type { Config } from 'tailwindcss'

export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        bg: {
          base: '#0f0f13',
          card: '#1a1a24',
          elevated: '#22222f',
          border: '#2a2a3a',
          // Borde de campos de formulario: contraste 3:1 sobre las tarjetas
          field: '#646b7a',
        },
        accent: {
          indigo: '#6366f1',
          cyan: '#22d3ee',
          green: '#10b981',
          red: '#f43f5e',
          yellow: '#f59e0b',
        },
        gray: {
          // Gris para texto terciario y placeholders: contraste ≥ 4.5:1 sobre los fondos de la app
          450: '#868e9c',
        },
      },
      fontFamily: {
        sans: ['system-ui', '-apple-system', 'Segoe UI', 'Roboto', 'sans-serif'],
      },
      spacing: {
        'safe-top': 'env(safe-area-inset-top, 0px)',
        'safe-bottom': 'env(safe-area-inset-bottom, 0px)',
      },
    },
  },
  plugins: [],
} satisfies Config
