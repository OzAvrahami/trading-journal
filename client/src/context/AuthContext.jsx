import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { authApi } from '../api/auth.js';
import { refreshAccessToken } from '../api/client.js';
import { setAccessToken, getSessionVersion, invalidateSession, onSessionInvalidated } from '../api/session.js';

export const AuthContext = createContext(null);
export function AuthProvider({ children }) {
  const queryClient = useQueryClient();
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  useEffect(() => onSessionInvalidated(() => {
    // Cancel before clearing: late responses cannot refill a previous user's cache.
    void queryClient.cancelQueries();
    queryClient.clear();
    setUser(null);
  }), [queryClient]);

  useEffect(() => {
    let mounted = true;
    const version = getSessionVersion();
    refreshAccessToken(version).then(() => authApi.getMe()).then(value => {
      if (mounted && version === getSessionVersion()) setUser(value);
    }).catch(() => {
      // Only definitive 401s invalidate session state in the API layer.
      // Offline/5xx errors retain the cookie and do not manufacture a logout.
    }).finally(() => { if (mounted) setLoading(false); });
    return () => { mounted = false; };
  }, []);

  const authenticate = useCallback(async (method, credentials) => {
    const version = invalidateSession();
    const result = await method(credentials);
    if (version !== getSessionVersion()) return null;
    setAccessToken(result.accessToken);
    setUser(result.user);
    return result.user;
  }, []);
  const login = useCallback(data => authenticate(authApi.login, data), [authenticate]);
  const signup = useCallback(data => authenticate(authApi.signup, data), [authenticate]);
  const logout = useCallback(async () => {
    const version = getSessionVersion();
    try { await authApi.logout(); } catch {}
    finally { if (version === getSessionVersion()) invalidateSession(); }
  }, []);
  const updateProfile = useCallback(async data => {
    const version = getSessionVersion();
    const updated = await authApi.updateMe(data);
    if (version === getSessionVersion()) setUser(prev => prev ? { ...prev, ...updated } : prev);
    return updated;
  }, []);
  const applyUserUpdate = useCallback(data => setUser(previous => previous ? { ...previous, ...data } : previous), []);
  return (
    <AuthContext.Provider value={{ user, loading, login, signup, logout, updateProfile, applyUserUpdate }}>
      {children}
    </AuthContext.Provider>
  );
}
export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
}
