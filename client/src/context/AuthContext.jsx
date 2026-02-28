import React, { createContext, useContext, useEffect, useRef, useState, useCallback } from 'react';
import axios from 'axios';
import { authApi } from '../api/auth.js';
import { setAccessToken, clearAccessToken } from '../api/client.js';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  // Prevent double-fire in React StrictMode
  const didInit = useRef(false);

  // On mount, try to restore session via the httpOnly refresh token cookie.
  // Use a raw axios call so the response interceptor doesn't interfere.
  useEffect(() => {
    if (didInit.current) return;
    didInit.current = true;

    axios
      .post('/api/auth/refresh', {}, { withCredentials: true })
      .then(({ data }) => {
        setAccessToken(data.accessToken);
        return authApi.getMe();
      })
      .then(setUser)
      .catch(() => {
        // No valid session — stay logged out, this is expected
      })
      .finally(() => setLoading(false));
  }, []);

  const login = useCallback(async (credentials) => {
    const { user: u, accessToken } = await authApi.login(credentials);
    setAccessToken(accessToken);
    setUser(u);
    return u;
  }, []);

  const signup = useCallback(async (data) => {
    const { user: u, accessToken } = await authApi.signup(data);
    setAccessToken(accessToken);
    setUser(u);
    return u;
  }, []);

  const logout = useCallback(async () => {
    try { await authApi.logout(); } catch {}
    clearAccessToken();
    setUser(null);
  }, []);

  const updateProfile = useCallback(async (data) => {
    const updated = await authApi.updateMe(data);
    setUser(prev => ({ ...prev, ...updated }));
    return updated;
  }, []);

  return (
    <AuthContext.Provider value={{ user, loading, login, signup, logout, updateProfile }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
}
