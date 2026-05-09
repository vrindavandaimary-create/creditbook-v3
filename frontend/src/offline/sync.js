/**
 * CreditBook Sync Engine
 * Replays the outbox queue to the server when back online.
 * Each outbox entry has: { method, url, body, tempId, store }
 */
import { outbox, cache } from './db';

const BASE  = process.env.REACT_APP_API_URL || '';
const token = () => localStorage.getItem('cb3_token') || '';

const apiCall = async (method, url, body) => {
  const res = await fetch(`${BASE}${url}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token()}`,
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.message || `HTTP ${res.status}`);
  }
  return res.json();
};

/* Fetch fresh data from server and save to IndexedDB cache */
export const refreshCache = async () => {
  try {
    const [cats, parties, txs] = await Promise.all([
      apiCall('GET', '/api/categories'),
      apiCall('GET', '/api/parties'),
      apiCall('GET', '/api/transactions?limit=500'),
    ]);
    await Promise.all([
      cache.saveCategories(cats.data?.data   || cats.data || []),
      cache.saveParties(parties.data?.data   || parties.data || []),
      cache.saveTransactions(txs.data?.data  || txs.data || []),
    ]);
    console.log('[Sync] Cache refreshed');
  } catch(e) {
    console.warn('[Sync] Cache refresh failed:', e.message);
  }
};

/* Replay all pending outbox operations in order */
export const syncOutbox = async (onProgress) => {
  const pending = await outbox.getAll();
  if (!pending.length) return { synced: 0, failed: 0 };

  console.log(`[Sync] Replaying ${pending.length} pending operations`);
  let synced = 0, failed = 0;

  /* We process in creation order so balances are correct */
  const sorted = pending.sort((a, b) => a.createdAt - b.createdAt);

  for (const op of sorted) {
    try {
      await apiCall(op.method, op.url, op.body);
      await outbox.remove(op.id);
      synced++;
      onProgress?.({ synced, failed, total: pending.length, current: op });
    } catch(e) {
      console.error(`[Sync] Failed to replay op ${op.id}:`, e.message);
      failed++;
      /* Don't remove — leave it in outbox to retry next time */
    }
  }

  /* Refresh cache from server so local data is authoritative */
  if (synced > 0) await refreshCache();

  console.log(`[Sync] Done — synced: ${synced}, failed: ${failed}`);
  return { synced, failed };
};
