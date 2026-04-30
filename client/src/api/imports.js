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
 * @returns {{ inserted: number, dbDuplicates: number }}
 */
export async function commitImport(sessionId) {
  const { data } = await api.post('/api/imports/commit', { sessionId });
  return data;
}
