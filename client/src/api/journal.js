import api from './client.js';

export const listJournalEntries = (params) => api.get('/api/journal', { params }).then((response) => response.data);
export const getJournalCalendar = (month) => api.get('/api/journal/calendar', { params: { month } }).then((response) => response.data);
export const getJournalEntry = (id) => api.get(`/api/journal/${id}`).then((response) => response.data);
export const createJournalEntry = (data) => api.post('/api/journal', data).then((response) => response.data);
export const updateJournalEntry = (id, data) => api.patch(`/api/journal/${id}`, data).then((response) => response.data);
export const deleteJournalEntry = (id) => api.delete(`/api/journal/${id}`).then((response) => response.data);

export const journalApi = {
  list: listJournalEntries,
  calendar: getJournalCalendar,
  get: getJournalEntry,
  create: createJournalEntry,
  update: updateJournalEntry,
  remove: deleteJournalEntry,
};
