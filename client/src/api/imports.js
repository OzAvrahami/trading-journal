import api from './client.js';

/**
 * Upload a CSV file for preview (no DB writes).
 *
 * @param {string} broker - e.g. 'topstepx' | 'tradovate'
 * @param {File}   file   - the CSV File object from <input type="file">
 * @returns {{ sessionId: string, preview: object[], stats: object }}
 */
export async function parseImport(broker, file) {
  const formData = new FormData();
  formData.append('broker', broker);
  formData.append('file', file);

  const { data } = await api.post('/api/imports/parse', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
  return data;
}

/**
 * Commit a previously parsed import session to the database.
 *
 * @param {string} sessionId - from parseImport response
 * @param {string} accountId - UUID of the account to assign all imported trades to
 * @returns {{ inserted: number, dbDuplicates: number }}
 */
export async function commitImport(sessionId, accountId) {
  const { data } = await api.post('/api/imports/commit', { sessionId, accountId });
  return data;
}

export async function listImportRuns(params = {}) {
  const { data } = await api.get('/api/imports/runs', { params });
  return data;
}

export async function getImportRun(runId, params = {}) {
  const { data } = await api.get(`/api/imports/runs/${runId}`, { params });
  return data;
}
