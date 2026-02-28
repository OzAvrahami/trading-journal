import api from './client.js';

export const tradesApi = {
  list:   (params) => api.get('/api/trades', { params }).then(r => r.data),
  get:    (id)     => api.get(`/api/trades/${id}`).then(r => r.data),
  create: (data)   => api.post('/api/trades', data).then(r => r.data),
  update: (id, data) => api.patch(`/api/trades/${id}`, data).then(r => r.data),
  remove: (id)     => api.delete(`/api/trades/${id}`).then(r => r.data),
  exportCsv: (params) =>
    api.get('/api/trades/export', { params, responseType: 'blob' }).then(r => r.data),
};
