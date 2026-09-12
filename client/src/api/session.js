let token = null;
let version = 0;
const listeners = new Set();
export const getAccessToken = () => token;
export const getSessionVersion = () => version;
export const setAccessToken = value => { token = value; };
export const clearAccessToken = () => { token = null; };
export function invalidateSession() {
  token = null;
  version++;
  for (const listener of listeners) listener();
  return version;
}
export function onSessionInvalidated(listener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}
export function isDefinitiveAuthFailure(error) {
  return error?.response?.status === 401 && [
    'SESSION_INVALID', 'INVALID_TOKEN', 'INVALID_REFRESH_TOKEN', 'NO_REFRESH_TOKEN', 'UNAUTHORIZED',
  ].includes(error.response.data?.error?.code);
}
