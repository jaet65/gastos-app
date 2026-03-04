import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
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
          },
          {
            src: '/pwa-512x512.png',
            sizes: '512x512',
            type: 'image/png',
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
})
