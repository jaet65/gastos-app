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
  plugins: [
    react(),
    basicSsl(), // Genera el certificado SSL autofirmado automáticamente
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.ico', 'apple-touch-icon.png', 'masked-icon.svg'],
      manifest: {
        name: 'Gastos MAF',
        short_name: 'GastosMAF',
        description: 'Aplicación para el registro de gastos',
        theme_color: '#ffffff',
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
            purpose: 'maskable'
          },
        ],
      },
      workbox: {
        // Aumenta el límite de tamaño de archivo para el precaching.
        // El valor está en bytes. 5000000 bytes son ~4.76 MiB.
        maximumFileSizeToCacheInBytes: 5000000,
      }
    })
  ],
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: './src/vitest.setup.js',
  },
})