/**
 * offlineDB.js  –  frontend/src/utils/offlineDB.js
 *
 * IndexedDB layer for offline support.
 * Stores:
 *   "queue"  – pending mutations (POST/PUT/DELETE) to replay when online
 *   "cache"  – GET response snapshots for offline reads
 *
 * KEY FIX: default TTL raised from 10 min → 7 days.
 * Categories and parties are reference data that almost never changes;
 * caching them for 7 days means users can work offline for days, not minutes.
 */

const DB_NAME    = 'creditbook_offline';
const DB_VERSION = 1;

/* ─── TTL presets (exported so client.js can pick the right one) ── */
export const TTL_SHORT = 15 * 60 * 1000;            // 15 min  – dashboard, transactions
export const TTL_LONG  = 7  * 24 * 60 * 60 * 1000; // 7 days  – categories, parties

/* ─── DB open ─────────────────────────────────────────────── */
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

/* ─── QUEUE ────────────────────────────────────────────────── */

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

/* ─── CACHE ────────────────────────────────────────────────── */

/**
 * Default TTL = 7 days (TTL_LONG).
 * Pass TTL_SHORT for high-churn data like dashboard totals or transaction lists.
 */
export async function setCache(key, data, ttl = TTL_LONG) {
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
