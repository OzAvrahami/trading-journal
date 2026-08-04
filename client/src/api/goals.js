import api from './client.js';

export const listGoals = (params) => api.get('/api/goals', { params }).then((response) => response.data);
export const getGoal = (id) => api.get(`/api/goals/${id}`).then((response) => response.data);
export const createGoal = (data) => api.post('/api/goals', data).then((response) => response.data);
export const updateGoal = (id, data) => api.patch(`/api/goals/${id}`, data).then((response) => response.data);
export const deleteGoal = (id) => api.delete(`/api/goals/${id}`).then((response) => response.data);

export const goalsApi = {
  list: listGoals,
  get: getGoal,
  create: createGoal,
  update: updateGoal,
  remove: deleteGoal,
};
