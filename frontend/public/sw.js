/**
 * sw.js  (REPLACE: frontend/public/sw.js)
 *
 * Changes from original:
 *  1. Caches successful API GET responses in Cache Storage (network-first).
 *  2. Serves stale API cache when offline instead of returning a raw error.
 *  3. Handles Background Sync tag → posts BACKGROUND_SYNC message to all tabs.
 *  4. Static asset caching unchanged.
 */

const CACHE_NAME     = 'creditbook-v3';
const API_CACHE_NAME = 'creditbook-api-v1';

const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/manifest.json',
  '/icon-192.png',
  '/icon-512.png',
];

// Only these GET prefixes are worth caching
const CACHEABLE_API_PREFIXES = [
  '/api/dashboard',
  '/api/parties',
  '/api/categories',
  '/api/transactions',
  '/api/bills',
];

/* ── Install ── */
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(STATIC_ASSETS))
  );
  self.skipWaiting();
});

/* ── Activate: remove old caches ── */
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys
          .filter(k => k !== CACHE_NAME && k !== API_CACHE_NAME)
          .map(k => caches.delete(k))
      )
    )
  );
  self.clients.claim();
});

/* ── Fetch ── */
self.addEventListener('fetch', event => {
  const { request } = event;
  const url = new URL(request.url);

  /* ── API requests ── */
  if (url.pathname.startsWith('/api/')) {
    const shouldCache =
      request.method === 'GET' &&
      CACHEABLE_API_PREFIXES.some(p => url.pathname.startsWith(p));

    if (shouldCache) {
      // Network-first: try network, fall back to SW cache
      event.respondWith(
        fetch(request.clone())
          .then(async networkRes => {
            if (networkRes.ok) {
              const cache = await caches.open(API_CACHE_NAME);
              cache.put(request, networkRes.clone());
            }
            return networkRes;
          })
          .catch(async () => {
            const cached = await caches.match(request);
            if (cached) return cached;
            // Nothing cached — return a JSON 503 instead of a browser error
            return new Response(
              JSON.stringify({ success: false, offline: true, message: 'You are offline.' }),
              {
                status:  503,
                headers: { 'Content-Type': 'application/json' },
              }
            );
          })
      );
      return;
    }

    // Non-cacheable API calls (mutations, auth) — pass through, don't intercept
    return;
  }

  /* ── SPA navigation: serve index.html ── */
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request).catch(() => caches.match('/index.html'))
    );
    return;
  }

  /* ── Static assets: cache-first ── */
  event.respondWith(
    caches.match(request).then(cached => cached || fetch(request))
  );
});

/* ── Background Sync ── */
self.addEventListener('sync', event => {
  if (event.tag === 'creditbook-sync') {
    event.waitUntil(broadcastSync());
  }
});

async function broadcastSync() {
  const clients = await self.clients.matchAll({ type: 'window' });
  clients.forEach(c => c.postMessage({ type: 'BACKGROUND_SYNC' }));
}

/* ── Messages from the app ── */
self.addEventListener('message', event => {
  if (event.data?.type === 'SKIP_WAITING') self.skipWaiting();
  if (event.data?.type === 'TRIGGER_SYNC') broadcastSync();
});
