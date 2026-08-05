import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/react';
import { afterEach } from 'vitest';
import i18n from '../i18n/index.js';

afterEach(async () => {
  cleanup();
  await i18n.changeLanguage('en');
  document.documentElement.removeAttribute('data-theme');
  document.documentElement.removeAttribute('dir');
  document.documentElement.removeAttribute('lang');
  window.localStorage.clear();
});
