import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: 'autoUpdate',
      // We register the service worker ourselves (src/main.jsx) instead of using the
      // plugin's auto-injected script, which only ever registers once on load and
      // never re-checks — on iOS, an installed home-screen icon that's just sitting
      // backgrounded can go stale until the user force-quits and relaunches it. Our
      // own registration also checks on every foreground, catching that case.
      injectRegister: false,
      // Precaches only the built app shell (JS/CSS/HTML/icons). No runtimeCaching
      // entries are added, so every Supabase call stays network-only, same as today —
      // installing the app must never make picks/leaderboard data look cached or stale.
      includeAssets: ['favicon.svg'],
      manifest: {
        name: 'Poold',
        short_name: 'Poold',
        description: "Make it interesting. Private pick'em pools for your friend group.",
        start_url: '/',
        display: 'standalone',
        background_color: '#F8F0E4', // sand
        theme_color: '#1B4332', // fairway
        icons: [
          { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
          { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
          { src: '/icons/icon-512-maskable.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        navigateFallback: '/index.html',
      },
    }),
  ],
})
