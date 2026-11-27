/// <reference lib="webworker" />
/**
 * CuencaConnect service worker (built by vite-plugin-pwa, injectManifest).
 *
 * - Precaches the app shell so the PWA is installable and opens offline.
 * - Caches OpenStreetMap tiles that were already viewed (bounded, 7 days),
 *   so the report map still shows streets with a weak or no connection.
 * Supabase API requests are cross-origin and deliberately NOT cached (no
 * stale private data on the device). Unsent reports are kept by the app in
 * IndexedDB (src/lib/reports/outbox.ts), not by the service worker.
 */
import { clientsClaim } from 'workbox-core'
import { cleanupOutdatedCaches, createHandlerBoundToURL, precacheAndRoute } from 'workbox-precaching'
import { ExpirationPlugin } from 'workbox-expiration'
import { NavigationRoute, registerRoute } from 'workbox-routing'
import { CacheFirst } from 'workbox-strategies'

declare const self: ServiceWorkerGlobalScope & {
  __WB_MANIFEST: Array<string | { url: string; revision: string | null }>
}

void self.skipWaiting()
clientsClaim()
cleanupOutdatedCaches()

precacheAndRoute(self.__WB_MANIFEST)

// Single-page app: every navigation is served from the precached shell.
registerRoute(new NavigationRoute(createHandlerBoundToURL('/index.html')))

// OpenStreetMap tiles. Bounded to respect the OSM tile usage policy and the
// phone's storage; tiles are requested with CORS (TileLayer crossOrigin).
registerRoute(
  ({ url }) => url.hostname === 'tile.openstreetmap.org',
  new CacheFirst({
    cacheName: 'osm-tiles',
    plugins: [new ExpirationPlugin({ maxEntries: 400, maxAgeSeconds: 7 * 24 * 60 * 60, purgeOnQuotaError: true })],
  }),
)
