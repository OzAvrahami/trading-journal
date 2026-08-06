import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import i18n from '../i18n/index.js';

const mocks = vi.hoisted(() => ({
  get: vi.fn(), update: vi.fn(), toastError: vi.fn(), applyUserUpdate: vi.fn(),
}));
vi.mock('../api/preferences.js', () => ({ preferencesApi: { get: mocks.get, update: mocks.update } }));
vi.mock('./AuthContext.jsx', () => ({ useAuth: () => ({ user: { id: 'user-1', timezone: 'Asia/Jerusalem' }, applyUserUpdate: mocks.applyUserUpdate }) }));
vi.mock('../components/ui/Toast.jsx', () => ({ useToast: () => ({ error: mocks.toastError }) }));

import { applyLocalPreference, PreferencesProvider, usePreferences } from './PreferencesContext.jsx';

function Probe() {
  const preferences = usePreferences();
  return <div>
    <output data-testid="sync">{preferences.syncState}</output>
    <button type="button" onClick={() => preferences.updatePreference('locale', 'he').catch(() => {})}>Hebrew</button>
    <button type="button" onClick={() => preferences.saveTimezone('America/New_York')}>Timezone</button>
  </div>;
}

function renderProvider() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  return render(<QueryClientProvider client={queryClient}><PreferencesProvider><Probe /></PreferencesProvider></QueryClientProvider>);
}

describe('preference bootstrap and synchronization', () => {
  beforeEach(() => {
    mocks.get.mockResolvedValue({ locale: 'he', theme: 'system', tradeFormMode: 'simple', timezone: 'Asia/Jerusalem', defaultAccount: null });
    mocks.update.mockResolvedValue({ locale: 'he', theme: 'system', tradeFormMode: 'simple', timezone: 'America/New_York', defaultAccount: null });
  });

  it('applies non-null server preferences without a reload and mirrors existing local keys', async () => {
    renderProvider();
    await waitFor(() => expect(screen.getByTestId('sync')).toHaveTextContent('synced'));
    expect(document.documentElement).toHaveAttribute('lang', 'he');
    expect(document.documentElement).toHaveAttribute('dir', 'rtl');
    expect(localStorage.getItem('trading-log.locale')).toBe('he');
    expect(localStorage.getItem('tradinglog-theme')).toBe('system');
    expect(localStorage.getItem('trading-log.trade-form.mode')).toBe('simple');
  });

  it('keeps valid local fallbacks when server preferences are null', async () => {
    applyLocalPreference('locale', 'he');
    applyLocalPreference('theme', 'light');
    applyLocalPreference('tradeFormMode', 'simple');
    mocks.get.mockResolvedValue({ locale: null, theme: null, tradeFormMode: null, timezone: 'Asia/Jerusalem', defaultAccount: null });
    renderProvider();
    await waitFor(() => expect(screen.getByTestId('sync')).toHaveTextContent('local'));
    expect(i18n.resolvedLanguage).toBe('he');
    expect(localStorage.getItem('tradinglog-theme')).toBe('light');
    expect(localStorage.getItem('trading-log.trade-form.mode')).toBe('simple');
  });

  it('keeps an immediate local choice and reports device-only state when server sync fails', async () => {
    mocks.get.mockResolvedValue({ locale: null, theme: null, tradeFormMode: null, timezone: 'Asia/Jerusalem', defaultAccount: null });
    mocks.update.mockRejectedValueOnce(new Error('offline'));
    renderProvider();
    await waitFor(() => expect(screen.getByTestId('sync')).toHaveTextContent('local'));
    await userEvent.click(screen.getByRole('button', { name: 'Hebrew' }));
    await waitFor(() => expect(screen.getByTestId('sync')).toHaveTextContent('local-only'));
    expect(document.documentElement).toHaveAttribute('dir', 'rtl');
    expect(localStorage.getItem('trading-log.locale')).toBe('he');
    expect(mocks.toastError).toHaveBeenCalled();
  });

  it('updates canonical timezone and merges only the returned user timezone', async () => {
    renderProvider();
    await waitFor(() => expect(screen.getByTestId('sync')).toHaveTextContent('synced'));
    await userEvent.click(screen.getByRole('button', { name: 'Timezone' }));
    await waitFor(() => expect(mocks.update).toHaveBeenCalledWith({ timezone: 'America/New_York' }));
    expect(mocks.applyUserUpdate).toHaveBeenCalledWith({ timezone: 'America/New_York' });
  });
});
