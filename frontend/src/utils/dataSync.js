/**
 * dataSync.js  —  frontend/src/utils/dataSync.js
 *
 * Downloads ALL app data into IndexedDB cache when online.
 * Call on app load and every time the device comes back online.
 *
 * FIX (Bug #6): We no longer call clearAllCache() before fetching.
 * Pre-wiping created a data-loss window: if the network dropped between
 * the clear and the re-fetch completing, the user was left with an
 * empty IndexedDB and a fully non-functional offline experience.
 * Instead, each API call in client.js calls setCache() which overwrites
 * the existing entry in place — so the cache is always at least as fresh
 * as the last successful fetch, with no gap.
 *
 * Individual stale keys are still cleared by invalidateRelatedCaches()
 * inside client.js whenever a mutation succeeds online, and by
 * syncManager.js after a full queue flush — so staleness is handled
 * precisely where it matters without blanket destruction.
 */

import { partyAPI, categoryAPI, dashAPI } from '../api';

let syncing = false;

export async function syncAllToCache() {
  if (!navigator.onLine || syncing) return;
  syncing = true;
  try {
    // Download categories, parties list, and dashboard in parallel.
    // Each successful response is written to IndexedDB by client.js's
    // response interceptor (setCache), overwriting any stale entry.
    const [, partyRes] = await Promise.allSettled([
      categoryAPI.getAll(),
      partyAPI.getAll(),
      dashAPI.get(),
    ]);

    // Cache each party's detail page (party info + full transaction history).
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
