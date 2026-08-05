import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import en from './locales/en.js';
import he from './locales/he.js';

export const LOCALE_STORAGE_KEY = 'trading-log.locale';
export const SUPPORTED_LOCALES = Object.freeze(['en', 'he']);

export function isSupportedLocale(value) {
  return SUPPORTED_LOCALES.includes(value);
}

export function resolveInitialLocale({ storage, browserLanguage } = {}) {
  let saved = null;
  try {
    saved = (storage ?? globalThis.localStorage)?.getItem(LOCALE_STORAGE_KEY);
  } catch {
    // Storage is optional; browser language and the English fallback remain deterministic.
  }
  if (isSupportedLocale(saved)) return saved;
  const language = browserLanguage ?? globalThis.navigator?.language ?? '';
  return String(language).toLowerCase().startsWith('he') ? 'he' : 'en';
}

export function directionForLocale(locale) {
  return locale === 'he' ? 'rtl' : 'ltr';
}

export function applyDocumentLocale(locale) {
  const nextLocale = isSupportedLocale(locale) ? locale : 'en';
  if (typeof document !== 'undefined') {
    document.documentElement.lang = nextLocale;
    document.documentElement.dir = directionForLocale(nextLocale);
  }
  try {
    globalThis.localStorage?.setItem(LOCALE_STORAGE_KEY, nextLocale);
  } catch {
    // The in-memory locale still changes when persistence is unavailable.
  }
  return nextLocale;
}

const initialLocale = resolveInitialLocale();

i18n
  .use(initReactI18next)
  .init({
    resources: { en: { translation: en }, he: { translation: he } },
    lng: initialLocale,
    fallbackLng: 'en',
    supportedLngs: SUPPORTED_LOCALES,
    load: 'languageOnly',
    interpolation: { escapeValue: false },
    react: { useSuspense: false },
    initImmediate: false,
  });

applyDocumentLocale(initialLocale);
i18n.on('languageChanged', applyDocumentLocale);

export function activeLocale() {
  return i18n.resolvedLanguage === 'he' ? 'he' : 'en';
}

export function formattingLocale(locale = activeLocale()) {
  return locale === 'he' ? 'he-IL' : 'en-US';
}

export default i18n;
