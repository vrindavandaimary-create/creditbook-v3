/**
 * offlineDB.js  –  frontend/src/utils/offlineDB.js
 *
 * IndexedDB layer. Two stores:
 *   "queue"  – pending mutations to replay when online
 *   "cache"  – GET response snapshots for offline reads (7-day default TTL)
 */

const DB_NAME    = 'creditbook_offline';
const DB_VERSION = 1;

// TTL_SHORT was 15 min — kills offline reads after first reconnect window.
// For a 3-day offline scenario every endpoint needs at least 4 days of TTL.
// TTL_SHORT is kept for truly volatile data (e.g. dashboard totals) but
// raised to 4 days so the app stays fully usable for a long offline stretch.
export const TTL_SHORT = 4  * 24 * 60 * 60 * 1000; // 4 days  (was 15 min)
export const TTL_LONG  = 10 * 24 * 60 * 60 * 1000; // 10 days (was 7 days)

/**
 * Generate a unique local ID for items created while offline.
 * Format: "local_<timestamp36>_<random5>"
 * Used as a temporary _id until the server assigns a real MongoDB ObjectId.
 */
export function generateLocalId() {
  return 'local_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 7);
}

/* ─── DB open ─────────────────────────────────────────── */
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

/* ─── QUEUE ────────────────────────────────────────────── */
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

/* ─── CACHE ────────────────────────────────────────────── */
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
