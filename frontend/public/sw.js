/**
 * CreditBook Service Worker
 * Strategy:
 *   - App shell (HTML/JS/CSS): Cache-first, fallback to network
 *   - API calls: Network-first (offline handled in client.js via IndexedDB)
 */

const CACHE_NAME    = 'creditbook-v3-shell';
const OFFLINE_URL   = '/offline.html';

/* Files to pre-cache on install */
const PRECACHE = ['/', '/offline.html'];

self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE_NAME)
      .then(c => c.addAll(PRECACHE))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', e => {
  const { request } = e;
  const url = new URL(request.url);

  /* Never intercept API calls — handled by client.js IndexedDB logic */
  if (url.pathname.startsWith('/api/')) return;

  /* Navigation requests: serve app shell */
  if (request.mode === 'navigate') {
    e.respondWith(
      fetch(request).catch(() =>
        caches.match('/').then(r => r || caches.match(OFFLINE_URL))
      )
    );
    return;
  }

  /* Static assets: cache-first */
  e.respondWith(
    caches.match(request).then(cached => {
      if (cached) return cached;
      return fetch(request).then(resp => {
        if (!resp || resp.status !== 200 || resp.type === 'opaque') return resp;
        const clone = resp.clone();
        caches.open(CACHE_NAME).then(c => c.put(request, clone));
        return resp;
      }).catch(() => caches.match('/'));
    })
  );
});

/* Listen for sync messages from the app */
self.addEventListener('message', e => {
  if (e.data?.type === 'SKIP_WAITING') self.skipWaiting();
});
