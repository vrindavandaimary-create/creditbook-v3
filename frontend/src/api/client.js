client


import axios from 'axios';
import { cache, outbox } from '../offline/db';

const BASE = process.env.REACT_APP_API_URL || '';

const client = axios.create({ baseURL: BASE });

client.interceptors.request.use(cfg => {
  const token = localStorage.getItem('cb3_token');
  if (token) cfg.headers['Authorization'] = `Bearer ${token}`;
  return cfg;
});

client.interceptors.response.use(
  r => r,
  async err => {
    if (err.response?.status === 401) {
      localStorage.removeItem('cb3_token');
      localStorage.removeItem('cb3_user');
      window.location.href = '/login';
      return Promise.reject(err);
    }

    /* ── Offline interception ── */
    const isOffline = !navigator.onLine || err.code === 'ERR_NETWORK' || err.code === 'ECONNABORTED';
    if (isOffline) {
      const cfg = err.config;
      const method = cfg.method?.toUpperCase();

      /* Only queue write operations — reads fall back to cache */
      if (['POST','PUT','DELETE','PATCH'].includes(method)) {
        try {
          await outbox.add({
            method,
            url:  cfg.url.replace(BASE, ''),
            body: cfg.data ? JSON.parse(cfg.data) : null,
          });
          /* Return a fake success so the UI doesn't crash */
          return Promise.resolve({
            data: { success: true, offline: true, message: 'Saved offline — will sync when connected' },
          });
        } catch(e) {
          console.error('[Offline] Failed to queue operation:', e);
        }
      }

      if (method === 'GET') {
        const url = cfg.url.replace(BASE, '');
        try {
          /* Return cached data for read requests */
          if (url.includes('/api/categories'))   { const d = await cache.getCategories();   return { data: { success:true, data:d, offline:true } }; }
          if (url.includes('/api/parties'))       { const d = await cache.getParties();      return { data: { success:true, data:d, offline:true } }; }
          if (url.includes('/api/transactions'))  { const d = await cache.getTransactions(); return { data: { success:true, data:d, offline:true } }; }
          if (url.includes('/api/dashboard'))     {
            /* Compute dashboard from cache */
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
    }

    return Promise.reject(err);
  }
);

export default client;
