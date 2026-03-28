import client from './client';

export const authAPI = {
  sendOtp:            (phone)            => client.post('/api/auth/send-otp',            { phone }),
  verifyOtp:          (phone, otp)       => client.post('/api/auth/verify-otp',           { phone, otp }),
  sendRegisterOtp:    (phone, name, businessName) =>
                        client.post('/api/auth/send-register-otp', { phone, name, businessName }),
  verifyRegisterOtp:  (phone, otp)       => client.post('/api/auth/verify-register-otp',  { phone, otp }),
  me:                 ()                 => client.get('/api/auth/me'),
  update:             d                  => client.put('/api/auth/update', d),
};

export const categoryAPI = {
  getAll:  ()      => client.get('/api/categories'),
  create:  d       => client.post('/api/categories', d),
  update:  (id, d) => client.put(`/api/categories/${id}`, d),
  delete:  (id, d) => client.delete(`/api/categories/${id}`, { data: d }),
};

export const partyAPI = {
  getAll:  (params) => client.get('/api/parties', { params }),
  getOne:  id       => client.get(`/api/parties/${id}`),
  create:  d        => client.post('/api/parties', d),
  update:  (id, d)  => client.put(`/api/parties/${id}`, d),
  delete:  id       => client.delete(`/api/parties/${id}`),
};

export const txAPI = {
  getAll:  (params) => client.get('/api/transactions', { params }),
  add:     d        => client.post('/api/transactions', d),
  delete:  id       => client.delete(`/api/transactions/${id}`),
};

export const billAPI = {
  getAll:  (params) => client.get('/api/bills', { params }),
  getOne:  id       => client.get(`/api/bills/${id}`),
  create:  formData => client.post('/api/bills', formData, { headers: { 'Content-Type': 'multipart/form-data' } }),
  status:  (id, s)  => client.put(`/api/bills/${id}/status`, { status: s }),
  saveAsTx:(id)     => client.post(`/api/bills/${id}/save-transaction`),
  delete:  id       => client.delete(`/api/bills/${id}`),
};

export const dashAPI = { get:  () => client.get('/api/dashboard') };
export const chatAPI = { send: d  => client.post('/api/chat', d)  };
