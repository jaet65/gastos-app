import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'
import basicSsl from '@vitejs/plugin-basic-ssl'

// https://vite.dev/config/
export default defineConfig({
  server: {
    host: true, // Permite acceso desde la red local si lo necesitas
    https: true, // Habilita HTTPS en el servidor de desarrollo
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('/node_modules/@tremor/')) return 'tremor-vendor';
          if (id.includes('/node_modules/@firebase/')) {
            const packageName = id.split('/node_modules/@firebase/')[1].split('/')[0];
            return `firebase-${packageName}`;
          }
          if (id.includes('/node_modules/firebase/')) {
            const packageName = id.split('/node_modules/firebase/')[1].split('/')[0];
            return `firebase-${packageName}`;
          }
          if (id.includes('/node_modules/framer-motion/')) return 'motion-vendor';
          if (/\/node_modules\/(react|react-dom|scheduler)\//.test(id)) return 'react-vendor';
        }
      }
    }
  },
  plugins: [
    react(),
    basicSsl(), // Genera el certificado SSL autofirmado automáticamente
    VitePWA({
      strategies: 'injectManifest',
      srcDir: 'src',
      filename: 'service-worker.js',
      registerType: 'autoUpdate',
      includeAssets: ['favicon.ico', 'apple-touch-icon.png', 'masked-icon.svg'],
      manifest: {
        name: 'Gastos MAF',
        short_name: 'Gastos MAF',
        description: 'Aplicación para el registro de gastos',
        lang: 'es',
        start_url: '/',
        display: 'standalone',
        theme_color: '#ffffff',
        share_target: {
          action: '/share-target',
          method: 'POST',
          enctype: 'multipart/form-data',
          params: {
            files: [
              {
                name: 'file',
                accept: ['application/pdf', '.pdf']
              }
            ]
          }
        },
        icons: [
          {
            src: '/pwa-192x192.png',
            sizes: '192x192',
            type: 'image/png',
            purpose: 'any'
          },
          {
            src: '/pwa-512x512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'any maskable'
          },
        ],
      },
      workbox: {
        // El bundle principal supera los 5 MB; Workbox mide este límite en bytes.
        maximumFileSizeToCacheInBytes: 7000000,
      }
    })
  ],
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: './src/vitest.setup.js',
  },
})