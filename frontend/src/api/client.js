/**
 * client.js  –  frontend/src/api/client.js
 *
 * Axios instance with full offline support:
 *   • Online GET  → hit server, cache response to IndexedDB (7-day TTL for
 *                   categories/parties, 15-min for everything else)
 *   • Offline GET → serve IndexedDB cache; reject with {offline:true} if
 *                   no cache available
 *   • Offline mutation → enqueue to IndexedDB; return fake-success response
 *                        including the localId so callers can do optimistic UI
 *
 * __localId convention
 * --------------------
 * When creating a resource offline the caller should add __localId to the
 * request data:  partyAPI.create({ name, ..., __localId: generateLocalId() })
 * This file strips __localId before adding the item to the queue so it is
 * never sent to the server.  It is stored in the queue item as `localId`
 * so syncManager can do temp-ID → real-ID remapping.
 */

import axios from 'axios';
import { enqueue, setCache, getCache, clearCache, TTL_SHORT, TTL_LONG } from '../utils/offlineDB';

const BASE = process.env.REACT_APP_API_URL || '';
const client = axios.create({ baseURL: BASE });

/* ─── Attach JWT ─────────────────────────────────────── */
client.interceptors.request.use(cfg => {
  const token = localStorage.getItem('cb3_token');
  if (token) cfg.headers['Authorization'] = `Bearer ${token}`;
  return cfg;
});

/* ─── Stable relative cache key ─────────────────────── */
function buildCacheKey(url = '', params) {
  let path = url;
  try { path = new URL(url).pathname; } catch { /* already relative */ }
  if (params && Object.keys(params).length > 0) {
    const sorted = Object.keys(params).sort()
      .reduce((a, k) => { a[k] = params[k]; return a; }, {});
    path += '?' + new URLSearchParams(sorted).toString();
  }
  return path;
}

/* ─── TTL by endpoint ────────────────────────────────── */
function pickTTL(key) {
  if (key.startsWith('/api/categories') || key.startsWith('/api/parties')) return TTL_LONG;
  return TTL_SHORT;
}

/* ─── Response interceptor ──────────────────────────── */
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

    /* ── Offline GET: serve cache ── */
    if (isNetworkError && method === 'GET') {
      const key    = buildCacheKey(url, params);
      const cached = await getCache(key).catch(() => null);
      if (cached) return { data: cached, status: 200, offline: true };
      return Promise.reject({
        ...err, offline: true, noCacheAvailable: true,
        response: { data: { success: false, message: 'Offline — no cached data.' }, status: 503 },
      });
    }

    /* ── Offline mutation: enqueue ── */
    if (isNetworkError && ['POST', 'PUT', 'DELETE', 'PATCH'].includes(method)) {

      if (url.includes('/api/auth/')) {
        return Promise.reject({
          ...err,
          response: { data: { success: false, message: 'Cannot log in while offline.' }, status: 503 },
        });
      }

      const ct = config.headers?.['Content-Type'] || '';
      if (url.includes('/api/bills') && ct.includes('multipart')) {
        return Promise.reject({
          ...err,
          response: { data: { success: false, message: 'File uploads require an internet connection.' }, status: 503 },
        });
      }

      /* Parse body and extract __localId */
      let data = config.data;
      try { data = typeof data === 'string' ? JSON.parse(data) : data; } catch { data = null; }

      let localId = null;
      if (data?.__localId) {
        localId = data.__localId;
        // Strip __localId so it is never sent to the server
        const { __localId, ...rest } = data;
        data = rest;
      }

      await enqueue({
        method,
        url:         buildCacheKey(url, null),
        data,
        localId,                       // for syncManager ID remapping
        description: humanLabel(method, url),
      }).catch(() => {});

      return {
        data: {
          success: true,
          queued:  true,
          localId,                     // returned to caller for optimistic UI
          message: 'Saved offline — will sync when connected.',
        },
        status:  202,
        offline: true,
      };
    }

    return Promise.reject(err);
  }
);

/* ─── Cache invalidation ─────────────────────────────── */
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
  }
  await Promise.all(keys.map(k => clearCache(k).catch(() => {})));
}

function humanLabel(method, url) {
  const verbs    = { POST: 'Add', PUT: 'Update', DELETE: 'Delete', PATCH: 'Update' };
  const resource = (url.replace('/api/', '').split('/')[0]) || 'record';
  return `${verbs[method] || method} ${resource}`;
}

export default client;
