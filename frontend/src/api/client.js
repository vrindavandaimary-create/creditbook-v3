/**
 * client.js  (REPLACE: frontend/src/api/client.js)
 *
 * CHANGES vs previous version:
 *  • Imports TTL_SHORT / TTL_LONG from offlineDB.
 *  • Categories and parties GETs are cached with TTL_LONG (7 days) so they
 *    survive long offline sessions.  Everything else keeps TTL_SHORT (10 min).
 */

import axios from 'axios';
import { enqueue, setCache, getCache, clearCache, TTL_SHORT, TTL_LONG } from '../utils/offlineDB';

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

/* ─── Pick TTL based on endpoint ─── */
// Categories and parties are reference data that rarely change —
// cache them for 7 days so they're available during long offline periods.
const LONG_TTL_PREFIXES = ['/api/categories', '/api/parties'];

function cacheTTL(key) {
  return LONG_TTL_PREFIXES.some(p => key.startsWith(p)) ? TTL_LONG : TTL_SHORT;
}

/* ─── Response interceptor ─── */
client.interceptors.response.use(

  /* SUCCESS path */
  async (response) => {
    const method = response.config.method?.toUpperCase();
    const url    = response.config.url || '';
    const params = response.config.params;

    // Cache every successful GET
    if (method === 'GET' && response.data?.success) {
      const key = buildCacheKey(url, params);
      await setCache(key, response.data, cacheTTL(key)).catch(() => {});
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

    /* 401 — redirect to login */
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
        return { data: cached, status: 200, offline: true };
      }

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

      // Parse body
      let data = config.data;
      try { data = typeof data === 'string' ? JSON.parse(data) : data; }
      catch (_) { data = null; }

      await enqueue({
        method,
        url:         buildCacheKey(url, null),
        data,
        description: humanLabel(method, url),
      }).catch(() => {});

      /*
       * Return fake-success so pages continue normally.
       * Note: `data` is intentionally absent (no real _id exists yet).
       * Pages must check r.data.queued before accessing r.data.data._id.
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
