import axios from 'axios';
import { cache, outbox } from '../offline/db';

const BASE = process.env.REACT_APP_API_URL || '';

const client = axios.create({ baseURL: BASE, timeout: 10000 });

client.interceptors.request.use(cfg => {
  const token = localStorage.getItem('cb3_token');
  if (token) cfg.headers['Authorization'] = `Bearer ${token}`;
  return cfg;
});

client.interceptors.response.use(
  r => r,
  async err => {
    /* ── Auth error ── */
    if (err.response?.status === 401) {
      localStorage.removeItem('cb3_token');
      localStorage.removeItem('cb3_user');
      window.location.href = '/login';
      return Promise.reject(err);
    }

    /* ── Offline detection ──
       We check navigator.onLine first — most reliable signal.
       err.code checks cover: no network, DNS fail, connection refused, timeout.
       err.response being undefined means the request never got a response.
    */
    const isOffline =
      !navigator.onLine ||
      !err.response ||
      err.code === 'ERR_NETWORK' ||
      err.code === 'ECONNABORTED' ||
      err.code === 'ERR_INTERNET_DISCONNECTED' ||
      err.code === 'ETIMEDOUT' ||
      err.message === 'Network Error';

    if (!isOffline) return Promise.reject(err);

    const cfg    = err.config;
    const method = cfg?.method?.toUpperCase();
    if (!method) return Promise.reject(err);

    /* cfg.url from axios is always the relative path (e.g. '/api/parties')
       because axios prepends baseURL internally. No replace() needed. */
    const relUrl = cfg.url?.startsWith('http') ? cfg.url.replace(BASE, '') : cfg.url;

    /* ── WRITES → queue in outbox ── */
    if (['POST', 'PUT', 'DELETE', 'PATCH'].includes(method)) {
      try {
        let body = null;
        if (cfg.data) {
          try { body = JSON.parse(cfg.data); } catch { body = cfg.data; }
        }
        await outbox.add({ method, url: relUrl, body });
        return Promise.resolve({
          data: { success: true, offline: true, message: 'Saved offline — will sync when connected' },
        });
      } catch(e) {
        console.error('[Offline] Failed to queue:', e);
        return Promise.reject(err);
      }
    }

    /* ── READS → serve from IndexedDB cache ── */
    if (method === 'GET') {
      try {
        if (relUrl?.includes('/api/categories')) {
          const d = await cache.getCategories();
          return { data: { success:true, data:d, offline:true } };
        }
        if (relUrl?.includes('/api/parties') && !relUrl?.includes('/api/parties/')) {
          const d = await cache.getParties();
          return { data: { success:true, data:d, offline:true } };
        }
        if (relUrl?.includes('/api/transactions')) {
          const d = await cache.getTransactions();
          return { data: { success:true, data:d, offline:true } };
        }
        if (relUrl?.includes('/api/dashboard')) {
          const [parties, categories] = await Promise.all([cache.getParties(), cache.getCategories()]);
          const totalToGet  = parties.filter(p=>p.balance>0).reduce((s,p)=>s+p.balance,0);
          const totalToGive = parties.filter(p=>p.balance<0).reduce((s,p)=>s+Math.abs(p.balance),0);
          const grouped = categories.map(cat => {
            const ps = parties.filter(p => p.categoryId?._id===cat._id || p.categoryId===cat._id);
            return {
              category: cat,
              parties: ps,
              toGet:  ps.filter(p=>p.balance>0).reduce((s,p)=>s+p.balance,0),
              toGive: ps.filter(p=>p.balance<0).reduce((s,p)=>s+Math.abs(p.balance),0),
            };
          });
          return { data: { success:true, data:{ grouped, totalToGet, totalToGive }, offline:true } };
        }
      } catch(e) {
        console.warn('[Offline] Cache read failed:', e);
      }
    }

    return Promise.reject(err);
  }
);

export default client;
