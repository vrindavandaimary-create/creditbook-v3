/**
 * CreditBook Offline DB
 * IndexedDB wrapper — no extra library needed.
 * Stores: categories, parties, transactions + outbox (pending sync queue).
 */

const DB_NAME    = 'creditbook_offline';
const DB_VERSION = 1;

let _db = null;

export const openDB = () => new Promise((resolve, reject) => {
  if (_db) return resolve(_db);
  const req = indexedDB.open(DB_NAME, DB_VERSION);

  req.onupgradeneeded = e => {
    const db = e.target.result;
    if (!db.objectStoreNames.contains('categories'))
      db.createObjectStore('categories', { keyPath: '_id' });
    if (!db.objectStoreNames.contains('parties'))
      db.createObjectStore('parties', { keyPath: '_id' });
    if (!db.objectStoreNames.contains('transactions'))
      db.createObjectStore('transactions', { keyPath: '_id' });
    if (!db.objectStoreNames.contains('outbox')) {
      const ob = db.createObjectStore('outbox', { keyPath: 'id', autoIncrement: true });
      ob.createIndex('by_created', 'createdAt');
    }
  };

  req.onsuccess = e => { _db = e.target.result; resolve(_db); };
  req.onerror   = e => reject(e.target.error);
});

const getAll = async (store) => {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const req = db.transaction(store, 'readonly').objectStore(store).getAll();
    req.onsuccess = () => resolve(req.result || []);
    req.onerror   = () => reject(req.error);
  });
};

const putAll = async (store, items) => {
  const db  = await openDB();
  const txn = db.transaction(store, 'readwrite');
  const s   = txn.objectStore(store);
  items.forEach(item => s.put(item));
  return new Promise((res, rej) => { txn.oncomplete = res; txn.onerror = rej; });
};

const clearStore = async (store) => {
  const db = await openDB();
  const txn = db.transaction(store, 'readwrite');
  txn.objectStore(store).clear();
  return new Promise((res, rej) => { txn.oncomplete = res; txn.onerror = rej; });
};

export const cache = {
  saveCategories:   items => putAll('categories', items),
  saveParties:      items => putAll('parties', items),
  saveTransactions: items => putAll('transactions', items),
  getCategories:    ()    => getAll('categories'),
  getParties:       ()    => getAll('parties'),
  getTransactions:  ()    => getAll('transactions'),
  clearAll: async () => {
    await clearStore('categories');
    await clearStore('parties');
    await clearStore('transactions');
  },
};

export const outbox = {
  add: async (op) => {
    const db  = await openDB();
    const txn = db.transaction('outbox', 'readwrite');
    txn.objectStore('outbox').add({ ...op, createdAt: Date.now(), status: 'pending' });
    return new Promise((res, rej) => { txn.oncomplete = res; txn.onerror = rej; });
  },
  getAll: () => getAll('outbox'),
  remove: async (id) => {
    const db  = await openDB();
    const txn = db.transaction('outbox', 'readwrite');
    txn.objectStore('outbox').delete(id);
    return new Promise((res, rej) => { txn.oncomplete = res; txn.onerror = rej; });
  },
  count: async () => {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const req = db.transaction('outbox', 'readonly').objectStore('outbox').count();
      req.onsuccess = () => resolve(req.result);
      req.onerror   = () => reject(req.error);
    });
  },
  clear: () => clearStore('outbox'),
};
