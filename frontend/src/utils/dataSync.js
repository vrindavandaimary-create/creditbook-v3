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

let syncing = false; // prevent concurrent runs

export async function syncAllToCache() {
  if (!navigator.onLine || syncing) return;
  syncing = true;
  try {
    // 1. Categories + parties list + dashboard in parallel
    const [, partyRes] = await Promise.allSettled([
      categoryAPI.getAll(),
      partyAPI.getAll(),
      dashAPI.get(),
    ]);

    // 2. Pre-cache every individual party's detail page (party + its transactions)
    //    so PartyDetail works offline even if the user never opened it.
    if (partyRes.status === 'fulfilled') {
      const parties = partyRes.value?.data?.data || [];
      await Promise.allSettled(
        parties.map(p => partyAPI.getOne(p._id))
      );
    }
  } catch (e) {
    console.warn('[dataSync] cache sync error:', e);
  } finally {
    syncing = false;
  }
}
