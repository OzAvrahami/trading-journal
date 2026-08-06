import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ToastProvider } from '../components/ui/Toast.jsx';
import i18n from '../i18n/index.js';

const state = vi.hoisted(() => ({
  updatePreference: vi.fn(), saveTimezone: vi.fn(), refetch: vi.fn(),
  preferences: {
    locale: 'en', theme: 'dark', tradeFormMode: 'advanced', timezone: 'Asia/Jerusalem',
    defaultAccount: { id: 'account-1', accountName: 'Main', company: 'Broker', accountNumber: 'A-1', status: 'active', baseCurrency: 'USD' },
  },
}));
const accountMocks = vi.hoisted(() => ({ list: vi.fn(), update: vi.fn() }));

vi.mock('../context/PreferencesContext.jsx', () => ({
  usePreferences: () => ({
    preferences: state.preferences, isLoading: false, isError: false, refetch: state.refetch,
    syncState: 'synced', updatePreference: state.updatePreference, saveTimezone: state.saveTimezone,
  }),
}));
vi.mock('../api/accounts.js', () => ({ accountsApi: accountMocks }));

import Settings from './Settings.jsx';

const accounts = [
  { id: 'account-1', accountName: 'Main', company: 'Broker', accountNumber: 'A-1', status: 'active', baseCurrency: 'USD', isDefault: true },
  { id: 'account-2', accountName: 'IRA', company: 'Fidelity', accountNumber: '77-2', status: 'active', baseCurrency: 'USD', isDefault: false },
  { id: 'account-3', accountName: 'Old', company: 'Broker', accountNumber: 'OLD-3', status: 'archived', baseCurrency: 'USD', isDefault: false },
];

function renderPage() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  return render(<MemoryRouter><QueryClientProvider client={queryClient}><ToastProvider><Settings /></ToastProvider></QueryClientProvider></MemoryRouter>);
}

describe('Settings page', () => {
  beforeEach(() => {
    accountMocks.list.mockResolvedValue(accounts);
    accountMocks.update.mockResolvedValue({ ...accounts[1], isDefault: true });
    state.updatePreference.mockResolvedValue(state.preferences);
    state.saveTimezone.mockResolvedValue({ ...state.preferences, timezone: 'America/New_York' });
  });

  it('renders accessible coordinated sections without adding a second page H1', async () => {
    renderPage();
    expect(await screen.findByRole('heading', { name: 'Language and direction' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Appearance' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Timezone' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Trading defaults' })).toBeInTheDocument();
    expect(screen.queryAllByRole('heading', { level: 1 })).toHaveLength(0);
    expect(screen.getByRole('button', { name: 'English' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('button', { name: 'Dark' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('button', { name: 'Advanced' })).toHaveAttribute('aria-pressed', 'true');
  });

  it('applies immediate preferences through one shared update abstraction', async () => {
    renderPage();
    await screen.findByRole('heading', { name: 'Language and direction' });
    await userEvent.click(screen.getByRole('button', { name: 'עברית' }));
    await userEvent.click(screen.getByRole('button', { name: 'Follow system' }));
    await userEvent.click(screen.getByRole('button', { name: 'Simple' }));
    expect(state.updatePreference).toHaveBeenCalledWith('locale', 'he');
    expect(state.updatePreference).toHaveBeenCalledWith('theme', 'system');
    expect(state.updatePreference).toHaveBeenCalledWith('tradeFormMode', 'simple');
  });

  it('validates and saves canonical timezone without changing the explicit route', async () => {
    renderPage();
    const input = await screen.findByRole('combobox', { name: 'Timezone' });
    await userEvent.clear(input);
    await userEvent.type(input, 'America/New_York');
    await userEvent.click(screen.getByRole('button', { name: 'Save timezone' }));
    await waitFor(() => expect(state.saveTimezone).toHaveBeenCalledWith('America/New_York'));
    expect(input).toHaveValue('America/New_York');
  });

  it('uses the existing Account update API and excludes archived Accounts', async () => {
    renderPage();
    const select = await screen.findByLabelText('Default Account');
    expect(select).not.toHaveTextContent('Old');
    await userEvent.selectOptions(select, 'account-2');
    await userEvent.click(screen.getByRole('button', { name: 'Apply default Account' }));
    await waitFor(() => expect(accountMocks.update).toHaveBeenCalledWith('account-2', { isDefault: true }));
    expect(screen.getByText(/77-2/).closest('option')).toBeTruthy();
  });

  it('renders natural Hebrew while technical settings remain direction-safe', async () => {
    await i18n.changeLanguage('he');
    renderPage();
    expect(await screen.findByRole('heading', { name: 'שפה וכיוון' })).toBeInTheDocument();
    expect(screen.getByRole('combobox', { name: 'אזור זמן' })).toHaveAttribute('dir', 'ltr');
    const select = await screen.findByLabelText('חשבון ברירת מחדל');
    expect(select.textContent).toContain('A-1');
  });
});
