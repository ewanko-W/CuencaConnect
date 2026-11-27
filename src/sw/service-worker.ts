/// <reference lib="webworker" />
/**
 * CuencaConnect service worker (built by vite-plugin-pwa, injectManifest).
 *
 * Phase 1: precache the app shell so the PWA is installable and opens
 * offline. Later phases add map-tile caching, the offline report queue
 * (Background Sync), and Web Push. Supabase API requests are cross-origin
 * and are deliberately NOT cached here (no stale private data on the device).
 */
import { clientsClaim } from 'workbox-core'
import { cleanupOutdatedCaches, createHandlerBoundToURL, precacheAndRoute } from 'workbox-precaching'
import { NavigationRoute, registerRoute } from 'workbox-routing'

declare const self: ServiceWorkerGlobalScope & {
  __WB_MANIFEST: Array<string | { url: string; revision: string | null }>
}

void self.skipWaiting()
clientsClaim()
cleanupOutdatedCaches()

precacheAndRoute(self.__WB_MANIFEST)

// Single-page app: every navigation is served from the precached shell.
registerRoute(new NavigationRoute(createHandlerBoundToURL('/index.html')))
