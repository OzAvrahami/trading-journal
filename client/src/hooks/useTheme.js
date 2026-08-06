import { useCallback, useEffect, useState } from 'react';

export const THEME_STORAGE_KEY = 'tradinglog-theme';
export const THEME_PREFERENCES = Object.freeze(['system', 'light', 'dark']);

function readPreference() {
  try {
    const value = window.localStorage.getItem(THEME_STORAGE_KEY);
    return THEME_PREFERENCES.includes(value) ? value : 'dark';
  } catch { return 'dark'; }
}

function resolveTheme(preference) {
  if (preference === 'system') return window.matchMedia?.('(prefers-color-scheme: light)').matches ? 'light' : 'dark';
  return preference === 'light' ? 'light' : 'dark';
}

function readTheme() {
  if (typeof document === 'undefined') return 'dark';
  return document.documentElement.dataset.theme === 'light' ? 'light' : 'dark';
}

export function applyTheme(theme) {
  const preference = THEME_PREFERENCES.includes(theme) ? theme : 'dark';
  const nextTheme = resolveTheme(preference);
  document.documentElement.dataset.theme = nextTheme;
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', nextTheme === 'dark' ? '#0A0E13' : '#F3F4F1');
  try {
    window.localStorage.setItem(THEME_STORAGE_KEY, preference);
  } catch {
    // Theme remains applied for the current page when storage is unavailable.
  }
  window.dispatchEvent(new CustomEvent('tradinglog-theme-change', { detail: { preference, theme: nextTheme } }));
  return nextTheme;
}

export function useTheme() {
  const [theme, setTheme] = useState(readTheme);
  const [preference, setPreference] = useState(readPreference);

  useEffect(() => {
    const handleChange = (event) => {
      setTheme(event.detail?.theme || readTheme());
      setPreference(event.detail?.preference || readPreference());
    };
    window.addEventListener('tradinglog-theme-change', handleChange);
    const media = window.matchMedia?.('(prefers-color-scheme: light)');
    const handleSystemChange = () => { if (readPreference() === 'system') applyTheme('system'); };
    media?.addEventListener?.('change', handleSystemChange);
    return () => {
      window.removeEventListener('tradinglog-theme-change', handleChange);
      media?.removeEventListener?.('change', handleSystemChange);
    };
  }, []);

  const toggleTheme = useCallback(() => {
    const nextTheme = readTheme() === 'dark' ? 'light' : 'dark';
    applyTheme(nextTheme);
  }, []);

  return { theme, preference, setTheme: applyTheme, toggleTheme };
}
