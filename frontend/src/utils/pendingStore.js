/**
 * pendingStore.js  –  frontend/src/utils/pendingStore.js  (NEW FILE)
 *
 * localStorage helper for items created while offline (categories, parties).
 * These "pending" items are merged into the UI immediately so the user sees
 * their changes right away.  When the sync queue is flushed online, the
 * server assigns real MongoDB IDs; syncManager calls clearAllPending() so
 * the live server data takes over on the next load().
 *
 * Uses localStorage (not IndexedDB) to keep it synchronous and simple —
 * pending items are small and few.
 */

const KEY = (type) => `cb3_pending_${type}`;

/** Save or update a locally-created pending item. */
export function savePending(type, item) {
  const all      = getPending(type);
  const filtered = all.filter(i => i.localId !== item.localId); // dedupe
  localStorage.setItem(KEY(type), JSON.stringify([...filtered, item]));
}

/** Get all pending items of a given type ('category' | 'party'). */
export function getPending(type) {
  try { return JSON.parse(localStorage.getItem(KEY(type)) || '[]'); }
  catch { return []; }
}

/** Remove one pending item by its localId. */
export function removePending(type, localId) {
  const filtered = getPending(type).filter(i => i.localId !== localId);
  localStorage.setItem(KEY(type), JSON.stringify(filtered));
}

/** Remove all pending items of a given type. */
export function clearPending(type) {
  localStorage.removeItem(KEY(type));
}

/** Remove ALL pending items (called after a successful sync). */
export function clearAllPending() {
  clearPending('category');
  clearPending('party');
}
