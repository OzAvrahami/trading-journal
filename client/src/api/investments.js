import api from './client.js';

const get = (path, params) => api.get(`/api/investments/${path}`, { params }).then((response) => response.data);

export const investmentsApi = {
  scope: (params) => get('scope', params),
  overview: (params) => get('overview', params),
  holdings: (params) => get('holdings', params),
  transactions: (params) => get('transactions', params),
  dividends: (params) => get('dividends', params),
  performance: (params) => get('performance', params),
  allocation: (params) => get('allocation', params),
};
