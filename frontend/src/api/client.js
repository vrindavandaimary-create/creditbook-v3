/**
 * client.js  –  frontend/src/api/client.js
 *
 * Axios instance with:
 *  1. JWT attachment
 *  2. Offline GET  → serve IndexedDB cache (7-day TTL for categories/parties,
 *                    15-min for everything else)
 *  3. Offline POST/PUT/DELETE → enqueue to IndexedDB; return fake-success so
 *     pages continue normally
 *  4. Cache invalidation after mutations
 *  5. 401 → redirect to /login
 */

import axios from 'axios';
import { enqueue, setCache, getCache, clearCache, TTL_SHORT, TTL_LONG } from '../utils/offlineDB';

const BASE = process.env.REACT_APP_API_URL || '';

const client = axios.create({ baseURL: BASE });

/* ─── Attach JWT ─────────────────────────────────────────── */
client.interceptors.request.use(cfg => {
  const token = localStorage.getItem('cb3_token');
  if (token) cfg.headers['Authorization'] = `Bearer ${token}`;
  return cfg;
});

/* ─── Stable relative cache key ─────────────────────────── */
function buildCacheKey(url = '', params) {
  let path = url;
  try { path = new URL(url).pathname; } catch { /* already relative */ }

  if (params && Object.keys(params).length > 0) {
    const sorted = Object.keys(params).sort()
      .reduce((acc, k) => { acc[k] = params[k]; return acc; }, {});
    path += '?' + new URLSearchParams(sorted).toString();
  }
  return path;
}

/* ─── Pick cache TTL by endpoint ─────────────────────────── */
// Categories and parties are reference data → cache for 7 days.
// Everything else (dashboard totals, transaction lists) → 15 min.
const LONG_TTL_PREFIXES = ['/api/categories', '/api/parties'];

function pickTTL(cacheKey) {
  return LONG_TTL_PREFIXES.some(p => cacheKey.startsWith(p)) ? TTL_LONG : TTL_SHORT;
}

/* ─── Response interceptor ───────────────────────────────── */
client.interceptors.response.use(

  /* ══ SUCCESS ══ */
  async (response) => {
    const method = (response.config.method || '').toUpperCase();
    const url    = response.config.url || '';
    const params = response.config.params;

    if (method === 'GET' && response.data?.success) {
      const key = buildCacheKey(url, params);
      await setCache(key, response.data, pickTTL(key)).catch(() => {});
    }

    if (['POST', 'PUT', 'DELETE', 'PATCH'].includes(method)) {
      await invalidateRelatedCaches(url).catch(() => {});
    }

    return response;
  },

  /* ══ ERROR ══ */
  async (err) => {
    const isNetworkError = !err.response;
    const config = err.config || {};
    const method = (config.method || '').toUpperCase();
    const url    = config.url || '';
    const params = config.params;

    /* 401 → logout */
    if (err.response?.status === 401) {
      localStorage.removeItem('cb3_token');
      localStorage.removeItem('cb3_user');
      window.location.href = '/login';
      return Promise.reject(err);
    }

    /* ── OFFLINE GET ── */
    if (isNetworkError && method === 'GET') {
      const key    = buildCacheKey(url, params);
      const cached = await getCache(key).catch(() => null);

      if (cached) {
        // Return cached data in the same shape axios returns so
        // pages can do r.data.data, r.data.success, etc. unchanged.
        return { data: cached, status: 200, offline: true };
      }

      // No cache → structured reject so catch blocks can check .offline
      return Promise.reject({
        ...err,
        offline: true,
        noCacheAvailable: true,
        response: {
          data: { success: false, message: 'You are offline and there is no cached data.' },
          status: 503,
        },
      });
    }

    /* ── OFFLINE MUTATION ── */
    if (isNetworkError && ['POST', 'PUT', 'DELETE', 'PATCH'].includes(method)) {

      // Auth calls cannot be queued
      if (url.includes('/api/auth/')) {
        return Promise.reject({
          ...err,
          response: { data: { success: false, message: 'Cannot log in while offline.' }, status: 503 },
        });
      }

      // File uploads cannot be queued
      const ct = config.headers?.['Content-Type'] || '';
      if (url.includes('/api/bills') && ct.includes('multipart')) {
        return Promise.reject({
          ...err,
          response: { data: { success: false, message: 'File uploads require an internet connection.' }, status: 503 },
        });
      }

      let data = config.data;
      try { data = typeof data === 'string' ? JSON.parse(data) : data; } catch { data = null; }

      await enqueue({
        method,
        url:         buildCacheKey(url, null),
        data,
        description: humanLabel(method, url),
      }).catch(() => {});

      /*
       * Return a fake-success response. Pages MUST check r.data.queued before
       * using r.data.data (there is no real server-side _id yet).
       *
       * The { data: undefined } means r.data.data is undefined intentionally —
       * callers must branch on r.data.queued.
       */
      return {
        data:    { success: true, queued: true, message: 'Saved offline — will sync when connected.' },
        status:  202,
        offline: true,
      };
    }

    return Promise.reject(err);
  }
);

/* ─── Cache invalidation map ─────────────────────────────── */
async function invalidateRelatedCaches(url) {
  const keys = [];

  if (url.includes('/api/transactions')) {
    keys.push('/api/transactions', '/api/dashboard', '/api/parties');
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

/* ─── Human-readable queue label ─────────────────────────── */
function humanLabel(method, url) {
  const verbs    = { POST: 'Add', PUT: 'Update', DELETE: 'Delete', PATCH: 'Update' };
  const resource = (url.replace('/api/', '').split('/')[0]) || 'record';
  return `${verbs[method] || method} ${resource}`;
}

export default client;
