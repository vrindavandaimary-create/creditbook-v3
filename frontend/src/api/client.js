/**
 * client.js  (REPLACE: frontend/src/api/client.js)
 *
 * Fixes vs previous broken version:
 *
 * Fix 1 – Cache keys are always RELATIVE paths.
 *          In production, axios config.url can be the full absolute URL
 *          (https://xxx.onrender.com/api/dashboard). We strip it to just
 *          /api/dashboard so save and lookup always match.
 *
 * Fix 2 – Query params are sorted before serialization.
 *          partyAPI.getAll({ categoryId:'abc' }) → key: /api/parties?categoryId=abc
 *          Always consistent regardless of JS object key order.
 *
 * Fix 3 – After offline mutation, onSaved() calls load() which does
 *          another GET. That GET also hits the offline path and now
 *          correctly serves the cached data instead of throwing.
 *          The UI refreshes with stale-but-visible data instead of
 *          crashing and navigating away.
 *
 * Fix 4 – partyAPI.getOne (/api/parties/:id) is now cached on every
 *          successful online load, so it's available when offline.
 */

import axios from 'axios';
import { enqueue, setCache, getCache, clearCache } from '../utils/offlineDB';

const BASE = process.env.REACT_APP_API_URL || '';

const client = axios.create({ baseURL: BASE });

/* ─── Attach JWT ─── */
client.interceptors.request.use(cfg => {
  const token = localStorage.getItem('cb3_token');
  if (token) cfg.headers['Authorization'] = `Bearer ${token}`;
  return cfg;
});

/* ─── Build a stable relative cache key ─── */
function buildCacheKey(url, params) {
  let path = url || '';

  // Strip base URL if axios gave us an absolute URL
  try {
    const u = new URL(url);
    path = u.pathname;
  } catch {
    // Already relative — fine
  }

  if (params && Object.keys(params).length > 0) {
    // Sort keys so param order never affects the key
    const sorted = Object.keys(params)
      .sort()
      .reduce((acc, k) => { acc[k] = params[k]; return acc; }, {});
    path += '?' + new URLSearchParams(sorted).toString();
  }

  return path;
}

/* ─── Response interceptor ─── */
client.interceptors.response.use(

  /* SUCCESS path */
  async (response) => {
    const method = response.config.method?.toUpperCase();
    const url    = response.config.url || '';
    const params = response.config.params;

    // Cache every successful GET.
    // Categories and parties are reference data → 7-day TTL.
    // Dashboard and transactions change frequently → 15-min TTL.
    if (method === 'GET' && response.data?.success) {
      const key = buildCacheKey(url, params);
      const LONG_TTL  = 7 * 24 * 60 * 60 * 1000; // 7 days
      const SHORT_TTL = 15 * 60 * 1000;            // 15 min
      const isRef = key.startsWith('/api/categories') || key.startsWith('/api/parties');
      await setCache(key, response.data, isRef ? LONG_TTL : SHORT_TTL).catch(() => {});
    }

    // Invalidate stale caches after mutations
    if (['POST', 'PUT', 'DELETE', 'PATCH'].includes(method)) {
      await invalidateRelatedCaches(url).catch(() => {});
    }

    return response;
  },

  /* ERROR path */
  async (err) => {
    const isNetworkError = !err.response;
    const config = err.config || {};
    const method = (config.method || '').toUpperCase();
    const url    = config.url || '';
    const params = config.params;

    /* 401 — redirect to login (unchanged from original) */
    if (err.response?.status === 401) {
      localStorage.removeItem('cb3_token');
      localStorage.removeItem('cb3_user');
      window.location.href = '/login';
      return Promise.reject(err);
    }

    /* ══ OFFLINE + GET ══ */
    if (isNetworkError && method === 'GET') {
      const key    = buildCacheKey(url, params);
      const cached = await getCache(key).catch(() => null);

      if (cached) {
        /*
         * Shape: { data: cached, status: 200 }
         * Pages read:  r.data.data          → cached.data          ✓
         *              r.data.data.party     → cached.data.party    ✓  (PartyDetail)
         *              r.data.data || []     → cached.data || []    ✓  (Parties list)
         */
        return { data: cached, status: 200, offline: true };
      }

      // No cache available — give a structured error so catch blocks
      // show their own message instead of crashing
      return Promise.reject({
        ...err,
        offline: true,
        response: {
          data: { success: false, message: 'Offline — no cached data available.' },
          status: 503,
        },
      });
    }

    /* ══ OFFLINE + MUTATION ══ */
    if (isNetworkError && ['POST', 'PUT', 'DELETE', 'PATCH'].includes(method)) {

      // Never queue auth calls (OTP)
      if (url.includes('/api/auth/')) {
        return Promise.reject({
          ...err,
          response: {
            data: { success: false, message: 'Cannot authenticate while offline.' },
            status: 503,
          },
        });
      }

      // Never queue file uploads (bills with images)
      const contentType = config.headers?.['Content-Type'] || '';
      if (url.includes('/api/bills') && contentType.includes('multipart')) {
        return Promise.reject({
          ...err,
          response: {
            data: { success: false, message: 'File uploads require an internet connection.' },
            status: 503,
          },
        });
      }

      // Parse body (axios serialises it to a JSON string)
      let data = config.data;
      try { data = typeof data === 'string' ? JSON.parse(data) : data; }
      catch (_) { data = null; }

      await enqueue({
        method,
        url:         buildCacheKey(url, null),   // store relative path only
        data,
        description: humanLabel(method, url),
      }).catch(() => {});

      /*
       * Return fake-success so the page's try block continues:
       *
       *   await txAPI.add(...)             ← gets this fake response (no throw)
       *   toast.success('Entry saved!')    ← fires ✓
       *   onSaved()                        ← fires ✓
       *     └─ load()
       *          └─ partyAPI.getOne()      ← also offline → served from cache ✓
       *
       * The catch block with toast.error never fires. ✓
       */
      return {
        data:    { success: true, queued: true, message: 'Saved offline. Will sync when connected.' },
        status:  202,
        offline: true,
      };
    }

    return Promise.reject(err);
  }
);

/* ─── Cache invalidation map ─── */
async function invalidateRelatedCaches(url) {
  const keys = [];

  if (url.includes('/api/transactions')) {
    keys.push('/api/transactions', '/api/dashboard', '/api/parties');
    // Invalidate specific party detail if mongo id is in the URL
    const m = url.match(/\/api\/transactions\/([a-f0-9]{24})/i);
    if (m) keys.push(`/api/transactions/${m[1]}`);
  }

  if (url.includes('/api/parties')) {
    keys.push('/api/parties', '/api/dashboard');
    const m = url.match(/\/api\/parties\/([a-f0-9]{24})/i);
    if (m) keys.push(`/api/parties/${m[1]}`);
  }

  if (url.includes('/api/categories')) {
    keys.push('/api/categories', '/api/dashboard', '/api/parties');
    const m = url.match(/\/api\/categories\/([a-f0-9]{24})/i);
    if (m) keys.push(`/api/categories/${m[1]}`);
  }

  if (url.includes('/api/bills')) {
    keys.push('/api/bills', '/api/dashboard');
    const m = url.match(/\/api\/bills\/([a-f0-9]{24})/i);
    if (m) keys.push(`/api/bills/${m[1]}`);
  }

  await Promise.all(keys.map(k => clearCache(k).catch(() => {})));
}

/* ─── Human-readable queue label ─── */
function humanLabel(method, url) {
  const verbs    = { POST: 'Add', PUT: 'Update', DELETE: 'Delete', PATCH: 'Update' };
  const resource = (url.replace('/api/', '').split('/')[0]) || 'record';
  return `${verbs[method] || method} ${resource}`;
}

export default client;
