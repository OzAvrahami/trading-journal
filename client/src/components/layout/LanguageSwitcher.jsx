import { useTranslation } from 'react-i18next';
import { applyDocumentLocale, SUPPORTED_LOCALES } from '../../i18n/index.js';
import { useOptionalPreferences } from '../../context/PreferencesContext.jsx';

export function LanguageSwitcher() {
  const { t, i18n } = useTranslation();
  const preferences = useOptionalPreferences();
  const current = i18n.resolvedLanguage === 'he' ? 'he' : 'en';

  async function selectLocale(locale) {
    if (locale === current) return;
    if (preferences) {
      try { await preferences.updatePreference('locale', locale); } catch {}
      return;
    }
    applyDocumentLocale(locale);
    await i18n.changeLanguage(locale);
  }

  return (
    <div
      role="group"
      aria-label={t('shell.languageLabel')}
      className="inline-flex min-h-11 items-stretch rounded-md border border-default bg-surface-raised p-0.5 adaptive:min-h-9"
    >
      {SUPPORTED_LOCALES.map((locale) => (
        <button
          key={locale}
          type="button"
          lang={locale}
          dir={locale === 'he' ? 'rtl' : 'ltr'}
          aria-pressed={current === locale}
          className={`min-h-10 rounded px-2.5 text-xs font-medium transition-colors adaptive:min-h-8 ${current === locale ? 'bg-action text-white' : 'text-secondary hover:bg-surface-sunken hover:text-primary'}`}
          onClick={() => selectLocale(locale)}
        >
          {locale === 'he' ? t('common.hebrew') : t('common.english')}
        </button>
      ))}
    </div>
  );
}
