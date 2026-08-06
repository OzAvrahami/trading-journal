import api from './client.js';

export const preferencesApi = {
  get: () => api.get('/api/preferences').then((response) => response.data),
  update: (data) => api.patch('/api/preferences', data).then((response) => response.data),
};
