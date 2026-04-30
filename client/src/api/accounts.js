import api from './client.js';

export const accountsApi = {
  list:   ()         => api.get('/api/accounts').then(r => r.data),
  create: (data)     => api.post('/api/accounts', data).then(r => r.data),
  update: (id, data) => api.patch(`/api/accounts/${id}`, data).then(r => r.data),
  remove: (id)       => api.delete(`/api/accounts/${id}`).then(r => r.data),
};
