/**
 * syncManager.js  –  frontend/src/utils/syncManager.js
 *
 * Replays the IndexedDB queue when connectivity is restored.
 *
 * Key features:
 *   1. Processes items in FIFO order (createdAt ascending).
 *   2. ID REMAPPING — if a category was created offline (localId: "local_xxx")
 *      and the server returns the real MongoDB _id, every subsequent queue
 *      item whose data references "local_xxx" gets it replaced with the real
 *      _id before the request is sent.  This fixes the case where a party
 *      was created offline using a temp category ID.
 *   3. Per-item pending cleanup (Bug #8 fix): pendingStore entries are removed
 *      individually as each item syncs, not blanket-cleared at the end. This
 *      prevents ghost UI entries when some items fail or exceed MAX_RETRIES.
 *   4. syncAllToCache() is called after any successful syncs (Bug #4 fix) so
 *      that the IndexedDB is refreshed with server-truth data regardless of
 *      which code path triggered the sync (startup or connectivity event).
 */

import { getQueue, dequeue, incrementRetry, clearCache } from './offlineDB';
import { removePending } from './pendingStore';
import { syncAllToCache } from './dataSync';

const MAX_RETRIES = 3;

const CACHE_KEYS = [
  '/api/parties',
  '/api/categories',
  '/api/dashboard',
  '/api/transactions',
];

export async function syncQueue() {
  const queue = await getQueue();
  if (queue.length === 0) return { synced: 0, failed: 0 };

  const idMap  = {}; // localId  →  real server _id
  let synced   = 0;
  let failed   = 0;

  for (const item of queue) {
    if ((item.retries || 0) >= MAX_RETRIES) {
      await dequeue(item.id).catch(() => {});
      // Bug #8 fix: remove this specific pending item so it doesn't
      // linger as a ghost in the UI after being permanently dropped.
      if (item.localId) {
        removePending('party',    item.localId);
        removePending('category', item.localId);
      }
      failed++;
      continue;
    }

    try {
      const token = localStorage.getItem('cb3_token');
      const base  = process.env.REACT_APP_API_URL || '';

      /* ── Replace any temp IDs in data with real server IDs ── */
      let data = item.data;
      if (data && Object.keys(idMap).length > 0) {
        let str = JSON.stringify(data);
        for (const [local, real] of Object.entries(idMap)) {
          str = str.split(local).join(real);
        }
        data = JSON.parse(str);
      }

      const res = await fetch(`${base}${item.url}`, {
        method:  item.method,
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: data ? JSON.stringify(data) : undefined,
      });

      if (res.ok) {
        /* Store localId → realId mapping for subsequent items */
        if (item.localId) {
          const json = await res.json().catch(() => null);
          const realId = json?.data?._id
            || json?.data?.category?._id
            || json?.data?.party?._id;
          if (realId) idMap[item.localId] = realId;

          // Bug #8 fix: remove this item's pending entry now that it has
          // a real server ID — don't wait for a blanket clearAllPending().
          removePending('party',    item.localId);
          removePending('category', item.localId);
        }
        await dequeue(item.id).catch(() => {});
        synced++;
      } else if (res.status === 401) {
        // JWT expired — DO NOT delete queue items, they must survive re-login.
        // Clear token and stop — user must re-authenticate first.
        localStorage.removeItem('cb3_token');
        localStorage.removeItem('cb3_user');
        window.location.href = '/login';
        break;
      } else {
        await incrementRetry(item.id).catch(() => {});
        failed++;
      }
    } catch {
      /* Still offline — stop and leave items in queue */
      await incrementRetry(item.id).catch(() => {});
      break;
    }
  }

  if (synced > 0) {
    // Wipe stale list-level caches so the re-fetch below starts clean.
    await Promise.all(CACHE_KEYS.map(k => clearCache(k).catch(() => {})));

    // Bug #4 fix: re-download all data into IndexedDB so that the cache
    // is always server-fresh after a sync, regardless of which call path
    // triggered syncQueue() (startup useEffect OR connectivity listener).
    await syncAllToCache().catch(() => {});
  }

  return { synced, failed };
}

/**
 * Wire up online/offline events.
 * Call once from App.js — returns cleanup for useEffect.
 */
export function initConnectivityListeners(onStatusChange) {
  const handleOnline = async () => {
    const result = await syncQueue().catch(() => ({ synced: 0, failed: 0 }));
    onStatusChange(true, result);
  };
  const handleOffline = () => onStatusChange(false, null);

  window.addEventListener('online',  handleOnline);
  window.addEventListener('offline', handleOffline);

  const swListener = async (event) => {
    if (event.data?.type === 'BACKGROUND_SYNC') {
      const result = await syncQueue().catch(() => ({ synced: 0, failed: 0 }));
      onStatusChange(navigator.onLine, result);
    }
  };
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.addEventListener('message', swListener);
  }

  return () => {
    window.removeEventListener('online',  handleOnline);
    window.removeEventListener('offline', handleOffline);
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.removeEventListener('message', swListener);
    }
  };
}
