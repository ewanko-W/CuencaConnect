/// <reference types="vitest/config" />
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import { VitePWA } from 'vite-plugin-pwa'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      strategies: 'injectManifest',
      srcDir: 'src/sw',
      filename: 'service-worker.ts',
      registerType: 'autoUpdate',
      injectRegister: false, // registered in src/pwa/registerServiceWorker.ts
      includeAssets: ['favicon.svg', 'icons/apple-touch-icon-180.png'],
      manifest: {
        id: '/app',
        name: 'CuencaConnect',
        short_name: 'CuencaConnect',
        description:
          'Report incidents and receive emergency alerts from the Municipality of Cuenca, Batangas (capstone prototype).',
        lang: 'en-PH',
        // The installed app is the resident area only; /admin and /office
        // open in the browser.
        start_url: '/app',
        scope: '/app',
        display: 'standalone',
        orientation: 'portrait',
        background_color: '#f7f8fa',
        theme_color: '#0b5cad',
        categories: ['government', 'utilities', 'news'],
        icons: [
          { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
          { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
          { src: '/icons/maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      injectManifest: {
        globPatterns: ['**/*.{js,css,html,svg,png,ico,webmanifest}'],
      },
      devOptions: { enabled: false },
    }),
  ],
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    include: ['src/**/*.test.{ts,tsx}'],
    css: false,
  },
})
