/**
 * dataSync.js  —  frontend/src/utils/dataSync.js
 *
 * Downloads ALL app data into IndexedDB cache when online.
 * Call on app load and every time the device comes back online.
 */

import { partyAPI, categoryAPI, dashAPI } from '../api';
import { clearAllCache } from './offlineDB';

let syncing = false;

export async function syncAllToCache() {
  if (!navigator.onLine || syncing) return;
  syncing = true;
  try {
    // Wipe ALL stale IndexedDB caches first so individual /api/parties/:id
    // entries from before a sync don't serve old transaction lists offline.
    await clearAllCache().catch(() => {});

    // Download categories, parties list, dashboard in parallel
    const [, partyRes] = await Promise.allSettled([
      categoryAPI.getAll(),
      partyAPI.getAll(),
      dashAPI.get(),
    ]);

    // Cache each party's detail (party info + full transaction history).
    // Batched in groups of 5 to avoid hammering the server.
    if (partyRes.status === 'fulfilled') {
      const parties = partyRes.value?.data?.data || [];
      for (let i = 0; i < parties.length; i += 5) {
        await Promise.allSettled(
          parties.slice(i, i + 5).map(p => partyAPI.getOne(p._id))
        );
      }
    }
    console.log('[dataSync] all data cached to IndexedDB');
  } catch (e) {
    console.warn('[dataSync]', e);
  } finally {
    syncing = false;
  }
}
