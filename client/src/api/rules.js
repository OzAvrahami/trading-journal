import api from './client.js';

export const listRules = (params) => api.get('/api/rules', { params }).then((response) => response.data);
export const getRule = (id) => api.get(`/api/rules/${id}`).then((response) => response.data);
export const createRule = (data) => api.post('/api/rules', data).then((response) => response.data);
export const updateRule = (id, data) => api.patch(`/api/rules/${id}`, data).then((response) => response.data);
export const deleteRule = (id) => api.delete(`/api/rules/${id}`).then((response) => response.data);
export const getAdherence = (params) => api.get('/api/rules/adherence', { params }).then((response) => response.data);
export const listRuleChecks = (params) => api.get('/api/rules/checks', { params }).then((response) => response.data);
export const createRuleCheck = (data) => api.post('/api/rules/checks', data).then((response) => response.data);
export const updateRuleCheck = (id, data) => api.patch(`/api/rules/checks/${id}`, data).then((response) => response.data);
export const deleteRuleCheck = (id) => api.delete(`/api/rules/checks/${id}`).then((response) => response.data);

export const rulesApi = {
  list: listRules,
  get: getRule,
  create: createRule,
  update: updateRule,
  remove: deleteRule,
  adherence: getAdherence,
  listChecks: listRuleChecks,
  createCheck: createRuleCheck,
  updateCheck: updateRuleCheck,
  removeCheck: deleteRuleCheck,
};
