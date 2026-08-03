import { useCallback, useEffect, useState } from 'react';

export const THEME_STORAGE_KEY = 'tradinglog-theme';

function readTheme() {
  if (typeof document === 'undefined') return 'dark';
  return document.documentElement.dataset.theme === 'light' ? 'light' : 'dark';
}

export function applyTheme(theme) {
  const nextTheme = theme === 'light' ? 'light' : 'dark';
  document.documentElement.dataset.theme = nextTheme;
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', nextTheme === 'dark' ? '#0A0E13' : '#F3F4F1');
  try {
    window.localStorage.setItem(THEME_STORAGE_KEY, nextTheme);
  } catch {
    // Theme remains applied for the current page when storage is unavailable.
  }
  window.dispatchEvent(new CustomEvent('tradinglog-theme-change', { detail: nextTheme }));
  return nextTheme;
}

export function useTheme() {
  const [theme, setTheme] = useState(readTheme);

  useEffect(() => {
    const handleChange = (event) => setTheme(event.detail || readTheme());
    window.addEventListener('tradinglog-theme-change', handleChange);
    return () => window.removeEventListener('tradinglog-theme-change', handleChange);
  }, []);

  const toggleTheme = useCallback(() => {
    const nextTheme = readTheme() === 'dark' ? 'light' : 'dark';
    setTheme(applyTheme(nextTheme));
  }, []);

  return { theme, setTheme: (nextTheme) => setTheme(applyTheme(nextTheme)), toggleTheme };
}
