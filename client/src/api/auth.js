import api from './client.js';

export const authApi = {
  signup: (data)  => api.post('/api/auth/signup', data).then(r => r.data),
  login:  (data)  => api.post('/api/auth/login', data).then(r => r.data),
  logout: ()      => api.post('/api/auth/logout').then(r => r.data),
  refresh: ()     => api.post('/api/auth/refresh').then(r => r.data),
  getMe: ()       => api.get('/api/me').then(r => r.data),
  updateMe: (data) => api.patch('/api/me', data).then(r => r.data),
};
