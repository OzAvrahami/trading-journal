import api from './client.js';

export const portfolioApi = {
  list: (params) => api.get('/api/portfolios', { params }).then((response) => response.data),
  get: (id) => api.get(`/api/portfolios/${id}`).then((response) => response.data),
  create: (data) => api.post('/api/portfolios', data).then((response) => response.data),
  update: (id, data) => api.patch(`/api/portfolios/${id}`, data).then((response) => response.data),
  instruments: (params) => api.get('/api/investment-instruments', { params }).then((response) => response.data),
  createInstrument: (data) => api.post('/api/investment-instruments', data).then((response) => response.data),
  updateInstrument: (id, data) => api.patch(`/api/investment-instruments/${id}`, data).then((response) => response.data),
  transactions: (params) => api.get('/api/portfolio-transactions', { params }).then((response) => response.data),
  createTransaction: (data) => api.post('/api/portfolio-transactions', data).then((response) => response.data),
  updateTransaction: (id, data) => api.patch(`/api/portfolio-transactions/${id}`, data).then((response) => response.data),
  deleteTransaction: (id) => api.delete(`/api/portfolio-transactions/${id}`).then((response) => response.data),
  prices: (params) => api.get('/api/investment-prices', { params }).then((response) => response.data),
  upsertPrice: (instrumentId, date, data) => api.put(`/api/investment-prices/${instrumentId}/${date}`, data).then((response) => response.data),
  deletePrice: (instrumentId, date) => api.delete(`/api/investment-prices/${instrumentId}/${date}`).then((response) => response.data),
};

