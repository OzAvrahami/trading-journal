import api from './client.js';

export const dailyReviewApi = {
  get: (date) => api.get(`/api/daily-reviews/${date}`).then((response) => response.data),
  save: (date, data) => api.put(`/api/daily-reviews/${date}`, data).then((response) => response.data),
};
