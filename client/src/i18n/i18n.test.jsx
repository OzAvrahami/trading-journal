import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, useLocation } from 'react-router-dom';
import { afterEach, describe, expect, it } from 'vitest';
import { LanguageSwitcher } from '../components/layout/LanguageSwitcher.jsx';
import { formatCurrency, formatPct, formatR } from '../utils/formatters.js';
import { formatDateKey } from '../utils/dateOnly.js';
import i18n, {
  LOCALE_STORAGE_KEY,
  applyDocumentLocale,
  directionForLocale,
  resolveInitialLocale,
} from './index.js';

function storageWith(value) {
  return { getItem: () => value };
}

function CurrentLocation() {
  const location = useLocation();
  return <output data-testid="location">{location.pathname}{location.search}</output>;
}

afterEach(async () => {
  localStorage.clear();
  await i18n.changeLanguage('en');
});

describe('locale initialization and document direction', () => {
  it('uses a valid saved locale before the browser language', () => {
    expect(resolveInitialLocale({ storage: storageWith('en'), browserLanguage: 'he-IL' })).toBe('en');
    expect(resolveInitialLocale({ storage: storageWith('he'), browserLanguage: 'en-US' })).toBe('he');
  });

  it('uses Hebrew browser language and safely ignores unsupported saved values', () => {
    expect(resolveInitialLocale({ storage: storageWith('fr'), browserLanguage: 'he-IL' })).toBe('he');
    expect(resolveInitialLocale({ storage: storageWith('fr'), browserLanguage: 'fr-FR' })).toBe('en');
    expect(resolveInitialLocale({ storage: storageWith(null), browserLanguage: '' })).toBe('en');
  });

  it('updates lang, dir, and persistence without a reload', async () => {
    applyDocumentLocale('he');
    await i18n.changeLanguage('he');
    expect(document.documentElement).toHaveAttribute('lang', 'he');
    expect(document.documentElement).toHaveAttribute('dir', 'rtl');
    expect(localStorage.getItem(LOCALE_STORAGE_KEY)).toBe('he');
    expect(directionForLocale('en')).toBe('ltr');
  });
});

describe('language switcher', () => {
  it('exposes both languages, selected state, and preserves the current route', async () => {
    render(
      <MemoryRouter initialEntries={['/insights/goals?status=active']}>
        <LanguageSwitcher />
        <CurrentLocation />
      </MemoryRouter>,
    );

    expect(screen.getByRole('button', { name: 'English' })).toHaveAttribute('aria-pressed', 'true');
    fireEvent.click(screen.getByRole('button', { name: 'עברית' }));

    await waitFor(() => expect(document.documentElement).toHaveAttribute('dir', 'rtl'));
    expect(screen.getByRole('button', { name: 'עברית' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByTestId('location')).toHaveTextContent('/insights/goals?status=active');
  });
});

describe('localized production labels and formatting', () => {
  it('provides representative Hebrew labels for every production domain', async () => {
    await i18n.changeLanguage('he');
    expect([
      i18n.t('navigation.dashboard'), i18n.t('navigation.trades'), i18n.t('navigation.dailyReview'),
      i18n.t('navigation.analytics'), i18n.t('navigation.journal'), i18n.t('navigation.rules'),
      i18n.t('navigation.goals'), i18n.t('navigation.accounts'), i18n.t('navigation.import'),
      i18n.t('auth.signIn'), i18n.t('auth.createAccount'),
    ].join(' ')).toContain('לוח בקרה');
    expect(i18n.t('status.in_progress')).toBe('בתהליך');
    expect(i18n.t('status.not_applicable')).toBe('לא רלוונטי');
  });

  it('keeps date-only values exact and numeric values LTR-isolated in both locales', async () => {
    const date = '2026-08-04';
    expect(formatDateKey(date, { year: 'numeric', month: '2-digit', day: '2-digit' })).toContain('2026');
    await i18n.changeLanguage('he');
    expect(formatDateKey(date, { year: 'numeric', month: '2-digit', day: '2-digit' })).toContain('2026');
    expect(formatCurrency(-7486)).toMatch(/\u2066.*-.*7.*486.*\u2069/u);
    expect(formatPct(0.585)).toContain('58.5');
    expect(formatR(-1.25)).toContain('-1.25R');
  });

  it('keeps stable data keys untranslated', async () => {
    await i18n.changeLanguage('he');
    const payload = { direction: 'long', status: 'closed', metricKey: 'net_pnl', comparison: 'at_least' };
    expect(payload).toEqual({ direction: 'long', status: 'closed', metricKey: 'net_pnl', comparison: 'at_least' });
    expect(i18n.t(`status.${payload.direction}`)).toBe('לונג');
  });

  it('provides matching bilingual Trade Editor labels', async () => {
    const english = i18n.getResourceBundle('en', 'translation');
    const hebrew = i18n.getResourceBundle('he', 'translation');
    const paths = [
      ['routes', 'tradeNew', 'title'], ['routes', 'tradeEdit', 'title'], ['trades', 'newTrade'],
      ['trades', 'quickAdd'], ['trades', 'saveAndAddAnother'], ['trades', 'sections', 'risk'],
      ['trades', 'validation', 'exitBeforeEntry'],
    ];
    paths.forEach((path) => {
      expect(path.reduce((value, key) => value?.[key], english)).toBeTruthy();
      expect(path.reduce((value, key) => value?.[key], hebrew)).toBeTruthy();
    });
  });

  it('provides matching bilingual Settings navigation, metadata, controls, and feedback', () => {
    const english = i18n.getResourceBundle('en', 'translation');
    const hebrew = i18n.getResourceBundle('he', 'translation');
    const paths = [
      ['navigation', 'settings'], ['routes', 'settings', 'title'], ['settings', 'languageDirection'],
      ['settings', 'themeOptions', 'system'], ['settings', 'timezone'], ['settings', 'defaultAccount'],
      ['settings', 'defaultTradeMode'], ['settings', 'syncFailedDeviceOnly'],
    ];
    paths.forEach((path) => {
      expect(path.reduce((value, key) => value?.[key], english)).toBeTruthy();
      expect(path.reduce((value, key) => value?.[key], hebrew)).toBeTruthy();
    });
  });
});
