/**
 * offlineDB.js
 * PLACE AT: frontend/src/utils/offlineDB.js
 *
 * CHANGES vs original:
 *  • Added TTL_SHORT / TTL_LONG exports so callers can choose.
 *  • Default TTL raised to 24 h (was 10 min) — prevents cached categories
 *    and parties from expiring between short offline sessions.
 */

const DB_NAME    = 'creditbook_offline';
const DB_VERSION = 1;

/* ── TTL constants ── */
export const TTL_SHORT = 10  * 60  * 1000;          // 10 min  (transactions, dashboard)
export const TTL_LONG  = 7   * 24  * 60 * 60 * 1000; // 7 days  (categories, parties)

function openDB() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);

    req.onupgradeneeded = (e) => {
      const db = e.target.result;
      if (!db.objectStoreNames.contains('queue')) {
        const qs = db.createObjectStore('queue', { keyPath: 'id', autoIncrement: true });
        qs.createIndex('createdAt', 'createdAt', { unique: false });
      }
      if (!db.objectStoreNames.contains('cache')) {
        db.createObjectStore('cache', { keyPath: 'key' });
      }
    };

    req.onsuccess = (e) => resolve(e.target.result);
    req.onerror   = (e) => reject(e.target.error);
  });
}

/* ── QUEUE ── */

export async function enqueue(item) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx  = db.transaction('queue', 'readwrite');
    const req = tx.objectStore('queue').add({ ...item, createdAt: Date.now(), retries: 0 });
    req.onsuccess = () => resolve(req.result);
    req.onerror   = () => reject(req.error);
  });
}

export async function getQueue() {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx  = db.transaction('queue', 'readonly');
    const req = tx.objectStore('queue').index('createdAt').getAll();
    req.onsuccess = () => resolve(req.result);
    req.onerror   = () => reject(req.error);
  });
}

export async function dequeue(id) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx  = db.transaction('queue', 'readwrite');
    const req = tx.objectStore('queue').delete(id);
    req.onsuccess = () => resolve();
    req.onerror   = () => reject(req.error);
  });
}

export async function incrementRetry(id) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx    = db.transaction('queue', 'readwrite');
    const store = tx.objectStore('queue');
    const get   = store.get(id);
    get.onsuccess = () => {
      const item = get.result;
      if (!item) return resolve();
      item.retries = (item.retries || 0) + 1;
      const put = store.put(item);
      put.onsuccess = () => resolve();
      put.onerror   = () => reject(put.error);
    };
    get.onerror = () => reject(get.error);
  });
}

export async function getQueueCount() {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx  = db.transaction('queue', 'readonly');
    const req = tx.objectStore('queue').count();
    req.onsuccess = () => resolve(req.result);
    req.onerror   = () => reject(req.error);
  });
}

/* ── CACHE ── */

// Default TTL is now 24 h instead of 10 min.
// Pass TTL_SHORT for frequently-changing data (dashboard, transactions).
// Pass TTL_LONG  for reference data (categories, parties).
export async function setCache(key, data, ttl = 24 * 60 * 60 * 1000) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx  = db.transaction('cache', 'readwrite');
    const req = tx.objectStore('cache').put({ key, data, expiresAt: Date.now() + ttl });
    req.onsuccess = () => resolve();
    req.onerror   = () => reject(req.error);
  });
}

export async function getCache(key) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx  = db.transaction('cache', 'readonly');
    const req = tx.objectStore('cache').get(key);
    req.onsuccess = () => {
      const rec = req.result;
      if (!rec || Date.now() > rec.expiresAt) return resolve(null);
      resolve(rec.data);
    };
    req.onerror = () => reject(req.error);
  });
}

export async function clearCache(key) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx  = db.transaction('cache', 'readwrite');
    const req = tx.objectStore('cache').delete(key);
    req.onsuccess = () => resolve();
    req.onerror   = () => reject(req.error);
  });
}

export async function clearAllCache() {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx  = db.transaction('cache', 'readwrite');
    const req = tx.objectStore('cache').clear();
    req.onsuccess = () => resolve();
    req.onerror   = () => reject(req.error);
  });
}
