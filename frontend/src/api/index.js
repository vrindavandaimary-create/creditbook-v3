import client from './client';
import { cache } from '../offline/db';

/* After every successful GET, save to IndexedDB so data is available offline */
const withCache = (apiCall, saver) => async (...args) => {
  const r = await apiCall(...args);
  if (!r.data?.offline && r.data?.data) {
    const data = Array.isArray(r.data.data) ? r.data.data : [r.data.data];
    saver(data).catch(() => {});
  }
  return r;
};

export const authAPI = {
  sendOtp:           d => client.post('/api/auth/send-otp', d),
  verifyOtp:         d => client.post('/api/auth/verify-otp', d),
  sendRegisterOtp:   d => client.post('/api/auth/send-register-otp', d),
  verifyRegisterOtp: d => client.post('/api/auth/verify-register-otp', d),
  me:                () => client.get('/api/auth/me'),
  update:            d => client.put('/api/auth/update', d),
};

export const categoryAPI = {
  getAll:  withCache(
    (params) => client.get('/api/categories', { params }),
    cache.saveCategories
  ),
  create:  d      => client.post('/api/categories', d),
  update:  (id,d) => client.put(`/api/categories/${id}`, d),
  delete:  (id,d) => client.delete(`/api/categories/${id}`, { data: d }),
};

export const partyAPI = {
  getAll:  withCache(
    (params) => client.get('/api/parties', { params }),
    cache.saveParties
  ),
  getOne:  id       => client.get(`/api/parties/${id}`),
  create:  d        => client.post('/api/parties', d),
  update:  (id,d)   => client.put(`/api/parties/${id}`, d),
  delete:  id       => client.delete(`/api/parties/${id}`),
};

export const txAPI = {
  getAll:  withCache(
    (params) => client.get('/api/transactions', { params }),
    cache.saveTransactions
  ),
  add:     d  => client.post('/api/transactions', d),
  delete:  id => client.delete(`/api/transactions/${id}`),
};

export const billAPI = {
  getAll:  (params) => client.get('/api/bills', { params }),
  getOne:  id       => client.get(`/api/bills/${id}`),
  create:  formData => client.post('/api/bills', formData, { headers: { 'Content-Type': 'multipart/form-data' } }),
  status:  (id,s)   => client.put(`/api/bills/${id}/status`, { status: s }),
  saveAsTx:(id)     => client.post(`/api/bills/${id}/save-transaction`),
  delete:  id       => client.delete(`/api/bills/${id}`),
};

export const dashAPI = {
  get: () => client.get('/api/dashboard'),
};

export const chatAPI = {
  send: d => client.post('/api/chat', d),
};
