/**
 * syncManager.js  –  frontend/src/utils/syncManager.js
 *
 * Replays the IndexedDB queue when connectivity is restored.
 *
 * FIX: after a successful sync we call clearRelatedCaches() so that
 * pages refetch fresh data from the server on their next load()
 * instead of serving the now-outdated cached responses.
 */

import { getQueue, dequeue, incrementRetry, clearCache } from './offlineDB';

const MAX_RETRIES = 3;

/* ─── Endpoints whose caches should be wiped after any sync ── */
const CACHE_KEYS_TO_CLEAR = [
  '/api/parties',
  '/api/categories',
  '/api/dashboard',
  '/api/transactions',
];

async function clearRelatedCaches() {
  await Promise.all(CACHE_KEYS_TO_CLEAR.map(k => clearCache(k).catch(() => {})));
}

export async function syncQueue() {
  const queue = await getQueue();
  if (queue.length === 0) return { synced: 0, failed: 0 };

  let synced = 0;
  let failed = 0;

  for (const item of queue) {
    if ((item.retries || 0) >= MAX_RETRIES) {
      await dequeue(item.id).catch(() => {});
      failed++;
      continue;
    }

    try {
      const token = localStorage.getItem('cb3_token');
      const base  = process.env.REACT_APP_API_URL || '';

      const res = await fetch(`${base}${item.url}`, {
        method:  item.method,
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: item.data ? JSON.stringify(item.data) : undefined,
      });

      if (res.ok) {
        await dequeue(item.id).catch(() => {});
        synced++;
      } else if (res.status === 401) {
        await dequeue(item.id).catch(() => {});
        failed++;
      } else {
        await incrementRetry(item.id).catch(() => {});
        failed++;
      }
    } catch {
      // Still offline — stop, leave items in queue
      await incrementRetry(item.id).catch(() => {});
      break;
    }
  }

  // Wipe cached GETs so next page load fetches fresh server data
  if (synced > 0) {
    await clearRelatedCaches().catch(() => {});
  }

  return { synced, failed };
}

/**
 * Wire up online/offline events.
 * Call once from App.js — returns a cleanup function for useEffect.
 */
export function initConnectivityListeners(onStatusChange) {
  const handleOnline = async () => {
    const result = await syncQueue().catch(() => ({ synced: 0, failed: 0 }));
    onStatusChange(true, result);
  };

  const handleOffline = () => {
    onStatusChange(false, null);
  };

  window.addEventListener('online',  handleOnline);
  window.addEventListener('offline', handleOffline);

  // Listen for SW background-sync message
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
