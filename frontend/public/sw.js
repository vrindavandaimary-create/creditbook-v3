/**
 * sw.js  —  frontend/public/sw.js
 *
 * Offline-first Service Worker for CreditBook.
 *
 * ARCHITECTURE
 * ────────────
 * ┌─────────────────────────────────────────────────────────────────┐
 * │  Request type          │  SW strategy                           │
 * ├────────────────────────┼────────────────────────────────────────┤
 * │  Cross-origin (API)    │  SKIP — let it fail naturally so       │
 * │  e.g. Render backend   │  axios error interceptor serves        │
 * │                        │  IndexedDB cache in client.js          │
 * ├────────────────────────┼────────────────────────────────────────┤
 * │  SPA navigation        │  Network first → cache response        │
 * │  (page loads)          │  Offline fallback → cached index.html  │
 * │                        │  React Router handles the actual route  │
 * ├────────────────────────┼────────────────────────────────────────┤
 * │  Static assets         │  Cache first → if missing, fetch AND   │
 * │  (JS, CSS, fonts,      │  save to cache for next time           │
 * │   images)              │                                         │
 * └────────────────────────┴────────────────────────────────────────┘
 *
 * KEY FIXES vs previous version
 * ──────────────────────────────
 * 1. Cross-origin requests are SKIPPED completely.
 *    Previous bug: `url.pathname.startsWith('/api/')` matched
 *    https://backend.onrender.com/api/... and the SW returned a 503
 *    JSON — making axios see a server response (not a network error)
 *    so client.js's IndexedDB fallback NEVER triggered.
 *
 * 2. Static assets are cached AS THEY ARE FETCHED (cache-as-you-go).
 *    Previous bug: the handler did `caches.match || fetch` but never
 *    called `cache.put` — assets were never saved, so the app bundle
 *    (JS/CSS with content-hash filenames) was never available offline.
 *
 * 3. No 503 JSON responses. If something is not cached and the network
 *    fails, the SW either returns the app shell or lets the request
 *    fail naturally (for non-navigation requests).
 */

const SHELL_CACHE = 'cb3-shell-v3'; // bump version to force SW reinstall

/* ── Install: pre-cache only the root shell ── */
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(SHELL_CACHE).then(cache =>
      // Pre-cache the app entry point so navigation works immediately offline.
      // All other assets (JS bundle, CSS) are cached the first time they are fetched.
      cache.addAll(['/', '/index.html', '/manifest.json'])
        .catch(() => cache.add('/')) // fallback if manifest/icons missing
    )
  );
  self.skipWaiting(); // activate immediately without waiting for old SW to die
});

/* ── Activate: delete old cache versions, claim all open tabs ── */
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(keys =>
        Promise.all(
          keys
            .filter(k => k !== SHELL_CACHE) // remove every old cache version
            .map(k => caches.delete(k))
        )
      )
      .then(() => self.clients.claim()) // take control of all tabs immediately
  );
});

/* ── Fetch ── */
self.addEventListener('fetch', event => {
  const { request } = event;
  const url = new URL(request.url);

  /* 1. Skip non-GET requests (POST, PUT, DELETE, PATCH)
        Mutations must hit the network; offline mutations are queued
        by client.js (axios interceptor) directly into IndexedDB.      */
  if (request.method !== 'GET') return;

  /* 2. Skip cross-origin requests — most importantly API calls to the
        Render backend (https://your-app.onrender.com/api/...).
        If we intercept and return a non-network-error response offline,
        axios never sees a network error and client.js's IndexedDB
        fallback is bypassed.  Leave these completely alone.             */
  if (url.origin !== self.location.origin) return;

  /* 3. Skip browser-extension and non-http requests                    */
  if (!url.protocol.startsWith('http')) return;

  /* 4. SPA navigation requests (user navigates to any route)
        Strategy: try network, cache the response, fall back to shell.  */
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then(networkResponse => {
          // Cache the fresh shell for offline use
          if (networkResponse.ok) {
            const toCache = networkResponse.clone();
            caches.open(SHELL_CACHE).then(c => c.put(request, toCache));
          }
          return networkResponse;
        })
        .catch(async () => {
          // Offline — serve the cached shell.
          // React Router will handle the actual /route client-side.
          const cached =
            (await caches.match(request)) ||
            (await caches.match('/index.html')) ||
            (await caches.match('/'));
          return cached || new Response(
            '<h1>Offline</h1><p>Please open the app while connected at least once.</p>',
            { status: 200, headers: { 'Content-Type': 'text/html' } }
          );
        })
    );
    return;
  }

  /* 5. Static assets (JS bundle, CSS, fonts, images, icons)
        Strategy: serve from cache if available (instant), otherwise
        fetch from network AND save to cache for next time.
        This "cache-as-you-go" means the entire app is cached after
        the very first online visit.                                     */
  event.respondWith(
    caches.match(request).then(cached => {
      if (cached) return cached;

      // Not in cache yet — fetch from network and save
      return fetch(request).then(networkResponse => {
        if (networkResponse.ok) {
          const toCache = networkResponse.clone();
          caches.open(SHELL_CACHE).then(c => c.put(request, toCache));
        }
        return networkResponse;
      });
      // If fetch fails and there's no cache, the resource is simply unavailable.
      // We do NOT return a 503 JSON here — let it fail naturally.
    })
  );
});

/* ── Background Sync relay ── */
self.addEventListener('sync', event => {
  if (event.tag === 'creditbook-sync') {
    event.waitUntil(broadcastSync());
  }
});

async function broadcastSync() {
  const allClients = await self.clients.matchAll({ type: 'window' });
  allClients.forEach(c => c.postMessage({ type: 'BACKGROUND_SYNC' }));
}

/* ── Messages from the app ── */
self.addEventListener('message', event => {
  if (event.data?.type === 'SKIP_WAITING') self.skipWaiting();
  if (event.data?.type === 'TRIGGER_SYNC') broadcastSync();
});
