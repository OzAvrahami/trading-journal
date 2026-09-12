import axios from 'axios';
import {
  getAccessToken, getSessionVersion, setAccessToken, invalidateSession,
  onSessionInvalidated, isDefinitiveAuthFailure,
} from './session.js';
export { getAccessToken, setAccessToken, clearAccessToken } from './session.js';

const baseURL = import.meta.env.VITE_API_URL || '';
const api = axios.create({ baseURL, withCredentials: true, headers: { 'Content-Type': 'application/json' } });
const staleRequest = () => new axios.CanceledError('Session changed; discarded previous session response.');
let refreshFlight = null;
onSessionInvalidated(() => { refreshFlight?.controller.abort(); refreshFlight = null; });

export function refreshAccessToken(version = getSessionVersion()) {
  if (version !== getSessionVersion()) return Promise.reject(staleRequest());
  if (refreshFlight?.version === version) return refreshFlight.promise;
  const controller = new AbortController();
  const flight = { version, controller };
  flight.promise = axios.post(`${baseURL}/api/auth/refresh`, {}, { withCredentials: true, signal: controller.signal })
    .then(({ data }) => {
      if (version !== getSessionVersion()) throw staleRequest();
      setAccessToken(data.accessToken);
      return data.accessToken;
    }).catch(error => {
      if (version !== getSessionVersion()) throw staleRequest();
      if (isDefinitiveAuthFailure(error)) invalidateSession();
      throw error;
    }).finally(() => { if (refreshFlight === flight) refreshFlight = null; });
  refreshFlight = flight;
  return flight.promise;
}

api.interceptors.request.use(config => {
  if (config._sessionVersion !== undefined && config._sessionVersion !== getSessionVersion()) throw staleRequest();
  config._sessionVersion = getSessionVersion();
  const token = getAccessToken();
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});
api.interceptors.response.use(response => {
  if (response.config._sessionVersion !== getSessionVersion()) throw staleRequest();
  return response;
}, async error => {
  const original = error.config;
  if (!original) throw error;
  if (original._sessionVersion !== getSessionVersion()) throw staleRequest();
  const code = error.response?.data?.error?.code;
  if (error.response?.status === 401 && code === 'TOKEN_EXPIRED' && !original._retry) {
    original._retry = true;
    await refreshAccessToken(original._sessionVersion);
    return api(original);
  }
  if (isDefinitiveAuthFailure(error) || (error.response?.status === 401 && code === 'TOKEN_EXPIRED' && original._retry)) invalidateSession();
  throw error;
});
export default api;
