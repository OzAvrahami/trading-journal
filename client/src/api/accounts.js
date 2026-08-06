import api from './client.js';

export const accountsApi = {
  list:   (params)   => api.get('/api/accounts', { params }).then(r => r.data),
  get:    (id)       => api.get(`/api/accounts/${id}`).then(r => r.data),
  create: (data)     => api.post('/api/accounts', data).then(r => r.data),
  update: (id, data) => api.patch(`/api/accounts/${id}`, data).then(r => r.data),
  linkInvestmentPortfolio: (id, portfolioId) => api.post(`/api/accounts/${id}/link-investment-portfolio`, { portfolioId }).then(r => r.data),
  remove: (id)       => api.delete(`/api/accounts/${id}`).then(r => r.data),
};
