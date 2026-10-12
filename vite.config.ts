import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import { VitePWA } from 'vite-plugin-pwa'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: [
        'favicon.svg',
        'app-icon.svg',
        'app-icon-192.png',
        'app-icon-512.png',
        'sky-sweep-art.png',
        'pose_landmarker_lite.task',
        'wasm/vision_wasm_module_internal.js',
        'wasm/vision_wasm_module_internal.wasm',
      ],
      manifest: {
        name: 'Motion Arcade',
        short_name: 'Motion Arcade',
        description: 'A body-powered mini game arcade.',
        theme_color: '#18221f',
        background_color: '#f2f3e9',
        display: 'standalone',
        start_url: '/',
        scope: '/',
        icons: [
          {
            src: '/app-icon-192.png',
            sizes: '192x192',
            type: 'image/png',
            purpose: 'any',
          },
          {
            src: '/app-icon-512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'any maskable',
          },
          {
            src: '/app-icon.svg',
            sizes: 'any',
            type: 'image/svg+xml',
            purpose: 'any maskable',
          },
        ],
      },
      workbox: {
        maximumFileSizeToCacheInBytes: 16 * 1024 * 1024,
      },
    }),
  ],
})
