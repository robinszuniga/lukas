import { defineConfig } from 'vitest/config'
import path from 'path'

// Pruebas de lógica pura y de la capa de datos (SQLite con sql.js en Node). Sin navegador.
export default defineConfig({
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
})
