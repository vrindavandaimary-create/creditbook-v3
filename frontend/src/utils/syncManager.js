/**
 * syncManager.js
 * PLACE AT: frontend/src/utils/syncManager.js   (NEW FILE)
 *
 * Replays the IndexedDB queue when connectivity is restored.
 * Called from App.js on mount and on the browser "online" event.
 */

import { getQueue, dequeue, incrementRetry, clearCache } from './offlineDB';

const MAX_RETRIES = 3;

export async function syncQueue() {
  const queue = await getQueue();
  if (queue.length === 0) return { synced: 0, failed: 0 };

  let synced = 0;
  let failed = 0;

  for (const item of queue) {
    // Drop items that exceeded retry limit
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
        // Token expired – drop the item, the auth interceptor will redirect
        await dequeue(item.id).catch(() => {});
        failed++;
      } else {
        await incrementRetry(item.id).catch(() => {});
        failed++;
      }
    } catch {
      // Still offline – stop trying, leave items in queue
      await incrementRetry(item.id).catch(() => {});
      break;
    }
  }

  // Wipe cached GETs for resources that were just mutated so pages
  // fetch fresh data from the server on their next load().
  if (synced > 0) {
    const keysToWipe = ['/api/parties', '/api/categories', '/api/dashboard', '/api/transactions'];
    await Promise.all(keysToWipe.map(k => clearCache(k).catch(() => {})));
  }

  return { synced, failed };
}

/**
 * Wire up online/offline events.
 * Call once in App.js — returns a cleanup function for useEffect.
 *
 * onStatusChange(isOnline: boolean, syncResult: {synced,failed} | null)
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

  // Listen for the SW's BACKGROUND_SYNC message
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
