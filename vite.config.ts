import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'
import path from 'path'

// Se sirve desde https://<usuario>.github.io/lukas/ → base fija. HashRouter hace el resto.
export default defineConfig({
  base: '/lukas/',
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['icons/*.png', 'icons/*.svg'],
      manifest: {
        id: '/lukas/',
        name: 'Lukas',
        short_name: 'Lukas',
        description: 'Tus finanzas del día a día, sencillas.',
        lang: 'es',
        start_url: '/lukas/',
        scope: '/lukas/',
        display: 'standalone',
        prefer_related_applications: false,
        orientation: 'portrait',
        background_color: '#0f0f13',
        theme_color: '#0f0f13',
        icons: [
          { src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
          { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
          { src: 'icons/icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,wasm,png,svg,ico}'],
        maximumFileSizeToCacheInBytes: 4 * 1024 * 1024,
        navigateFallback: '/lukas/index.html',
      },
    }),
  ],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  build: {
    outDir: 'dist',
    emptyOutDir: true,
  },
})
