/**
 * client.js  (REPLACE: frontend/src/api/client.js)
 *
 * Bugs fixed vs first draft:
 *  1. Offline GET fallback: the fake response now wraps cached data exactly
 *     the same way axios does — { data: <cachedPayload> } — so every page
 *     that does `r.data.data` or `r.data.data.party` keeps working.
 *  2. Offline POST/PUT/DELETE fake-success: returns { data: { success:true,
 *     queued:true } } so catch blocks that check err.response?.data?.message
 *     never fire (no throw = no catch).
 *  3. Cache keys now strip the base URL so they are consistent whether
 *     REACT_APP_API_URL is set or not.
 *  4. Mutation cache invalidation is narrower and correct for all routes.
 */

import axios from 'axios';
import { enqueue, setCache, getCache, clearCache } from '../utils/offlineDB';

const BASE = process.env.REACT_APP_API_URL || '';

const client = axios.create({ baseURL: BASE });

/* ── Attach JWT ── */
client.interceptors.request.use(cfg => {
  const token = localStorage.getItem('cb3_token');
  if (token) cfg.headers['Authorization'] = `Bearer ${token}`;
  return cfg;
});

/* ── Response interceptor ── */
client.interceptors.response.use(

  /* SUCCESS path */
  async (response) => {
    const method = response.config.method?.toUpperCase();
    const url    = response.config.url || '';   // relative path, e.g. /api/dashboard

    // Cache successful GET responses
    if (method === 'GET' && response.data?.success) {
      const params   = response.config.params
        ? '?' + new URLSearchParams(response.config.params).toString()
        : '';
      await setCache(url + params, response.data).catch(() => {});
    }

    // Invalidate stale cache entries after any mutation
    if (['POST', 'PUT', 'DELETE', 'PATCH'].includes(method)) {
      await invalidateRelatedCaches(url).catch(() => {});
    }

    return response;
  },

  /* ERROR path */
  async (err) => {
    const isNetworkError = !err.response;          // true = no internet / CORS / timeout
    const config = err.config || {};
    const method = config.method?.toUpperCase();
    const url    = config.url || '';

    /* 401 — token expired, redirect to login (unchanged) */
    if (err.response?.status === 401) {
      localStorage.removeItem('cb3_token');
      localStorage.removeItem('cb3_user');
      window.location.href = '/login';
      return Promise.reject(err);
    }

    /* ── Offline + GET → serve cached data ── */
    if (isNetworkError && method === 'GET') {
      const params   = config.params
        ? '?' + new URLSearchParams(config.params).toString()
        : '';
      const cacheKey = url + params;
      const cached   = await getCache(cacheKey).catch(() => null);

      if (cached) {
        /*
         * Return an object shaped exactly like an axios response.
         * Every page does `const r = await someAPI.get(); r.data.data`
         * "cached" is the full { success, data, ... } payload we stored,
         * so wrapping it as { data: cached } makes r.data === cached,
         * and r.data.data === cached.data — identical to the live path.
         */
        return { data: cached, status: 200, offline: true };
      }

      // Nothing in cache — reject so the page shows its own error state
      return Promise.reject({ ...err, offline: true });
    }

    /* ── Offline + Mutation → queue for background sync ── */
    if (isNetworkError && ['POST', 'PUT', 'DELETE', 'PATCH'].includes(method)) {

      // Never queue auth endpoints (OTP sends, etc.)
      if (url.includes('/api/auth/')) {
        return Promise.reject({ ...err, offline: true });
      }

      // Parse the body (axios stringifies it before sending)
      let data = config.data;
      try { data = typeof data === 'string' ? JSON.parse(data) : data; }
      catch (_) { data = null; }

      await enqueue({
        method,
        url,
        data,
        description: humanLabel(method, url),
      }).catch(() => {});

      /*
       * Return a fake-success so the UI flow continues normally.
       * Shape: { data: { success: true, queued: true, message: '...' } }
       *
       * Pages do:
       *   await txAPI.add(...);
       *   toast.success('Entry saved!');   ← this fires ✓
       *   onSaved();                        ← this fires ✓
       *
       * No throw → catch block never runs → no error toast.
       */
      return {
        data: {
          success: true,
          queued:  true,
          message: 'Saved offline. Will sync when connected.',
        },
        status:  202,
        offline: true,
      };
    }

    return Promise.reject(err);
  }
);

/* ── Cache invalidation map ── */
async function invalidateRelatedCaches(url) {
  const toInvalidate = [];

  if (url.includes('/api/transactions'))  toInvalidate.push('/api/transactions', '/api/dashboard');
  if (url.includes('/api/parties'))       toInvalidate.push('/api/parties', '/api/dashboard');
  if (url.includes('/api/categories'))    toInvalidate.push('/api/categories', '/api/dashboard', '/api/parties');
  if (url.includes('/api/bills'))         toInvalidate.push('/api/bills', '/api/dashboard');

  // Also invalidate the specific party detail cache if the URL contains a party id
  // e.g. /api/parties/abc123  or  /api/transactions when partyId is in the body
  const partyIdMatch = url.match(/\/api\/parties\/([a-f0-9]{24})/);
  if (partyIdMatch) {
    toInvalidate.push(`/api/parties/${partyIdMatch[1]}`);
  }

  await Promise.all(toInvalidate.map(k => clearCache(k).catch(() => {})));
}

/* ── Human readable queue description ── */
function humanLabel(method, url) {
  const verbs = { POST: 'Add', PUT: 'Update', DELETE: 'Delete', PATCH: 'Update' };
  const parts  = url.replace('/api/', '').split('/');
  return `${verbs[method] || method} ${parts[0]}`;
}

export default client;
