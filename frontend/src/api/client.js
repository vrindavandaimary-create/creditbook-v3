import axios from 'axios';

const BASE = process.env.REACT_APP_API_URL || '';

const client = axios.create({ baseURL: BASE });

client.interceptors.request.use(cfg => {
  const token = localStorage.getItem('cb3_token');
  if (token) cfg.headers['Authorization'] = `Bearer ${token}`;
  return cfg;
});

client.interceptors.response.use(
  r => r,
  err => {
    if (err.response?.status === 401) {
      localStorage.removeItem('cb3_token');
      localStorage.removeItem('cb3_user');
      window.location.href = '/login';
    }
    return Promise.reject(err);
  }
);

export default client;
