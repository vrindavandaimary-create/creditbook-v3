/**
 * dataSync.js  –  frontend/src/utils/dataSync.js  (NEW FILE)
 *
 * Pre-fetches every piece of data the app needs and stores it in the
 * IndexedDB cache (via client.js success interceptor).  Call this once
 * on app load and again whenever the user comes back online.
 *
 * With this in place the app works fully offline:
 *   • categories, parties list, each party's detail + transactions,
 *     and the dashboard are all available from IndexedDB.
 */

import { partyAPI, categoryAPI, dashAPI } from '../api';
import { clearAllCache } from './offlineDB';

let syncing = false; // prevent concurrent runs

export async function syncAllToCache() {
  if (!navigator.onLine || syncing) return;
  syncing = true;
  try {
    // Wipe ALL stale IndexedDB caches first — this includes individual
    // /api/parties/:id entries that hold stale transaction lists.
    // Safe to do because we immediately re-download everything below.
    await clearAllCache().catch(() => {});

    // Re-download categories + parties list + dashboard in parallel
    const [, partyRes] = await Promise.allSettled([
      categoryAPI.getAll(),
      partyAPI.getAll(),
      dashAPI.get(),
    ]);

    // Cache each party's detail page (transactions included)
    // This is the most important step — without it PartyDetail shows stale txns offline.
    if (partyRes.status === 'fulfilled') {
      const parties = partyRes.value?.data?.data || [];
      // Batch in groups of 5 to avoid hammering the server
      for (let i = 0; i < parties.length; i += 5) {
        await Promise.allSettled(
          parties.slice(i, i + 5).map(p => partyAPI.getOne(p._id))
        );
      }
    }
  } catch (e) {
    console.warn('[dataSync] cache sync error:', e);
  } finally {
    syncing = false;
  }
}
