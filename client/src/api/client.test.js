import axios from 'axios';
import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';
import api, { refreshAccessToken } from './client.js';
import { getAccessToken, setAccessToken, invalidateSession, getSessionVersion } from './session.js';

const defaultAdapter = axios.defaults.adapter;
const apiAdapter = api.defaults.adapter;
const response = (config, data = {}, status = 200) => ({ config, data, status, statusText: '', headers: {} });
const failure = (config, code, status = 401) => new axios.AxiosError('request failed', 'TEST_FAILURE', config, null, response(config, { error: { code } }, status));
function deferred() { let resolve, reject; const promise = new Promise((a,b) => { resolve=a; reject=b; }); return { promise, resolve, reject }; }
beforeEach(() => { invalidateSession(); setAccessToken('original-token'); });
afterEach(() => { invalidateSession(); axios.defaults.adapter = defaultAdapter; api.defaults.adapter = apiAdapter; });

describe('session-aware API responses', () => {
  it('clears only definitive authentication failures, not network or server errors', async () => {
    for (const code of ['NETWORK', 'INTERNAL_ERROR', 'SESSION_INVALID']) {
      setAccessToken('original-token');
      api.defaults.adapter = config => Promise.reject(code === 'NETWORK' ? new axios.AxiosError('offline', 'ERR_NETWORK', config) : failure(config, code, code === 'INTERNAL_ERROR' ? 500 : 401));
      await expect(api.get('/api/accounts')).rejects.toBeDefined();
      expect(getAccessToken()).toBe(code === 'SESSION_INVALID' ? null : 'original-token');
    }
  });
  it('shares one refresh for concurrent expiry responses and retries each only once', async () => {
    const pending = deferred();
    axios.defaults.adapter = vi.fn(config => pending.promise.then(() => response(config, { accessToken: 'refreshed-token' })));
    api.defaults.adapter = vi.fn(config => config._retry ? Promise.resolve(response(config, { ok: true })) : Promise.reject(failure(config, 'TOKEN_EXPIRED')));
    const a = api.get('/api/accounts'); const b = api.get('/api/trades');
    await vi.waitFor(() => expect(axios.defaults.adapter).toHaveBeenCalledOnce());
    pending.resolve();
    await expect(Promise.all([a,b])).resolves.toHaveLength(2);
    expect(getAccessToken()).toBe('refreshed-token');
    expect(api.defaults.adapter).toHaveBeenCalledTimes(4);
  });
  it('a late previous-session success cannot be consumed by a new user', async () => {
    const pending = deferred(); let request;
    api.defaults.adapter = config => { request = config; return pending.promise; };
    const work = api.get('/api/trades'); const rejected = expect(work).rejects.toMatchObject({ code: 'ERR_CANCELED' });
    await vi.waitFor(() => expect(request).toBeDefined());
    invalidateSession(); setAccessToken('new-user');
    pending.resolve(response(request, [{ id: 'old-private-data' }]));
    await rejected; expect(getAccessToken()).toBe('new-user');
  });
  it('a late refresh is aborted and cannot restore the previous token', async () => {
    const pending = deferred(); let request;
    axios.defaults.adapter = config => { request = config; return pending.promise; };
    const work = refreshAccessToken(); const rejected = expect(work).rejects.toMatchObject({ code: 'ERR_CANCELED' });
    await vi.waitFor(() => expect(request).toBeDefined());
    invalidateSession(); setAccessToken('new-user');
    pending.resolve(response(request, { accessToken: 'old-refreshed-token' }));
    await rejected; expect(request.signal.aborted).toBe(true); expect(getAccessToken()).toBe('new-user');
  });
  it('failed transient refresh retains session, while invalid refresh clears it and cannot loop', async () => {
    for (const status of [500,401]) {
      setAccessToken('expired-token'); const version = getSessionVersion();
      axios.defaults.adapter = vi.fn(config => Promise.reject(failure(config, status === 401 ? 'INVALID_REFRESH_TOKEN' : 'INTERNAL_ERROR', status)));
      api.defaults.adapter = config => Promise.reject(failure(config,'TOKEN_EXPIRED'));
      await expect(api.get('/api/trades')).rejects.toBeDefined();
      expect(axios.defaults.adapter).toHaveBeenCalledOnce();
      expect(getSessionVersion()).toBe(status === 500 ? version : version + 1);
    }
  });
  it('a second expiry after refresh stops instead of recursively refreshing', async () => {
    axios.defaults.adapter = vi.fn(config => Promise.resolve(response(config,{ accessToken:'still-expired' })));
    api.defaults.adapter = config => Promise.reject(failure(config,'TOKEN_EXPIRED'));
    await expect(api.get('/api/trades')).rejects.toBeDefined();
    expect(axios.defaults.adapter).toHaveBeenCalledOnce(); expect(getAccessToken()).toBe(null);
  });
});
