import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { registerSW } from 'virtual:pwa-register'
import './index.css'
import App from './App.jsx'

// registerType: 'autoUpdate' (vite.config.js) reloads the page automatically once a
// new service worker takes over. But an installed app only gets a chance to find a
// new one when *something* re-registers — a bare page load isn't enough for an iOS
// home-screen icon that's just sitting backgrounded, since coming back to it isn't a
// fresh launch. Re-checking on every foreground (not just on load) is what keeps an
// already-installed icon from going stale until someone force-quits it.
registerSW({
  immediate: true,
  onRegisteredSW(swUrl, registration) {
    if (!registration) return
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') registration.update().catch(() => {})
    })
  },
})

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
