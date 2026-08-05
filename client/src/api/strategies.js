import api from './client.js';

export const strategiesApi = {
  list: (params) => api.get('/api/strategies', { params }).then((response) => response.data),
  legacy: () => api.get('/api/strategies/legacy-values').then((response) => response.data),
  create: (data) => api.post('/api/strategies', data).then((response) => response.data),
  update: (id, data) => api.patch(`/api/strategies/${id}`, data).then((response) => response.data),
  listSetups: (params) => api.get('/api/setups', { params }).then((response) => response.data),
  createSetup: (data) => api.post('/api/setups', data).then((response) => response.data),
  updateSetup: (id, data) => api.patch(`/api/setups/${id}`, data).then((response) => response.data),
};
