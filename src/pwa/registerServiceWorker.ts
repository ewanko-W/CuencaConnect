import { registerSW } from 'virtual:pwa-register'

/**
 * Registers the service worker produced by vite-plugin-pwa. The service
 * worker is only built for production (`npm run build` + `npm run preview`
 * or a deployment); it is disabled in `npm run dev`.
 */
export function registerServiceWorker(): void {
  if (!('serviceWorker' in navigator)) return
  registerSW({ immediate: true })
}
