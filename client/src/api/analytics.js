import api from './client.js';

export const analyticsApi = {
  daySummary:  (date) => api.get('/api/analytics/day-summary', { params: { date } }).then(r => r.data),
  summary:     (params) => api.get('/api/analytics/summary', { params }).then(r => r.data),
  equityCurve: (params) => api.get('/api/analytics/equity-curve', { params }).then(r => r.data),
  distribution:(params) => api.get('/api/analytics/distribution', { params }).then(r => r.data),
  rDistribution:(params) => api.get('/api/analytics/r-distribution', { params }).then(r => r.data),
  breakdown:   (params) => api.get('/api/analytics/breakdown', { params }).then(r => r.data),
  calendar:    (params) => api.get('/api/analytics/calendar', { params }).then(r => r.data),
};
