import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import i18n from '../i18n/index.js';
import { ToastProvider } from '../components/ui/Toast.jsx';

const api = vi.hoisted(() => ({ list: vi.fn(), get: vi.fn(), create: vi.fn(), update: vi.fn(), trades: vi.fn() }));
vi.mock('../api/accounts.js', () => ({ accountsApi: { list: api.list, get: api.get, create: api.create, update: api.update } }));
vi.mock('../api/trades.js', () => ({ tradesApi: { list: api.trades } }));

import Accounts from './Accounts.jsx';
import AccountDetail from './AccountDetail.jsx';
import { AccountForm, normalizeAccountForm } from '../components/accounts/AccountForm.jsx';
import { SummaryCards } from '../components/analytics/SummaryCards.jsx';

const account = {
  id: '550e8400-e29b-41d4-a716-446655440000', company: 'Interactive Brokers', accountNumber: 'IL-001', accountName: 'Main',
  accountType: 'live', status: 'active', baseCurrency: 'USD', openingBalance: 10000, isDefault: true, archived: false,
  tradesCount: 4, closedTrades: 3, openTrades: 1, winners: 2, losers: 1, breakeven: 0, pnlNet: 750, totalFees: 25,
  winRate: 2 / 3, averageR: 1.2, profitFactor: 2.5, trackedBalance: 10750, lastTradeAt: '2026-08-04T10:00:00Z',
};
const archived = { ...account, id: '660e8400-e29b-41d4-a716-446655440000', accountName: 'Historical', status: 'archived', isDefault: false };

function providers(children, path = '/accounts') {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  return render(<QueryClientProvider client={queryClient}><ToastProvider><MemoryRouter initialEntries={[path]}>{children}</MemoryRouter></ToastProvider></QueryClientProvider>);
}

describe('Accounts expansion UI', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    api.list.mockResolvedValue([account, archived]);
    api.get.mockResolvedValue(account);
    api.trades.mockResolvedValue({ data: [{ id: 'trade-1', symbol: 'NQ', entryDatetime: '2026-08-04T10:00:00Z', pnlNet: 100 }], pagination: { total: 1 } });
    api.create.mockResolvedValue(account);
    api.update.mockResolvedValue(account);
  });

  it('normalizes user-editable fields without changing internal account type keys', () => {
    expect(normalizeAccountForm({ company: ' Broker ', accountNumber: ' A-1 ', accountName: ' Main ', accountType: 'funded', baseCurrency: 'usd', openingBalance: '-5.25', isDefault: true })).toEqual({
      company: 'Broker', accountNumber: 'A-1', accountName: 'Main', accountType: 'funded', baseCurrency: 'USD', openingBalance: -5.25, isDefault: true,
    });
  });

  it('validates currency, keeps values after failure, and renders Hebrew labels', async () => {
    await i18n.changeLanguage('he');
    const onSubmit = vi.fn();
    providers(<AccountForm onSubmit={onSubmit} />);
    const currency = screen.getByLabelText('מטבע בסיס');
    await userEvent.clear(currency);
    await userEvent.type(currency, 'US');
    await userEvent.click(screen.getByRole('button', { name: 'יצירת חשבון' }));
    expect(await screen.findByText('יש להזין קוד מטבע בן שלוש אותיות.')).toBeInTheDocument();
    expect(currency).toHaveValue('US');
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('separates active and archived accounts and exposes real default/performance states', async () => {
    providers(<Accounts />);
    expect((await screen.findAllByText('Main')).length).toBeGreaterThan(0);
    expect(screen.getByText('Historical')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Inactive and archived accounts' })).toBeInTheDocument();
    expect(screen.getAllByText('Default account').length).toBeGreaterThan(0);
    expect(screen.getAllByText('3 / 1').length).toBeGreaterThan(0);
    expect(api.list).toHaveBeenCalledWith({ includeArchived: 'true' });
  });

  it('never combines mixed-currency Account totals', async () => {
    api.list.mockResolvedValue([account, { ...archived, baseCurrency: 'ILS', trackedBalance: 99999 }]);
    providers(<Accounts />);
    expect(await screen.findByText('These accounts use multiple currencies. Monetary totals are unavailable because no FX conversion is performed.')).toBeInTheDocument();
    expect(screen.queryByText('$110,749.00')).not.toBeInTheDocument();
  });

  it('renders owned detail, tracked-balance disclaimer, LTR account number, and safe Trade preselection', async () => {
    providers(<Routes><Route path="/accounts/:accountId" element={<AccountDetail />} /><Route path="/trades/new" element={<p>New trade destination</p>} /></Routes>, `/accounts/${account.id}`);
    expect(await screen.findByText('Opening balance plus realized net PnL recorded in TradingLog. This is not a live broker balance.')).toBeInTheDocument();
    expect(screen.getByText('IL-001')).toHaveAttribute('dir', 'ltr');
    await userEvent.click(screen.getByRole('button', { name: 'Create trade for this account' }));
    expect(await screen.findByText('New trade destination')).toBeInTheDocument();
  });

  it('sets default and archives through owned PATCH mutations', async () => {
    api.list.mockResolvedValue([{ ...account, isDefault: false }]);
    providers(<Accounts />);
    await screen.findByText('Main');
    await userEvent.click(screen.getByRole('button', { name: 'Set as default' }));
    await waitFor(() => expect(api.update).toHaveBeenCalledWith(account.id, { isDefault: true }));
    await userEvent.click(screen.getByRole('button', { name: 'Archive account' }));
    const dialog = screen.getByRole('dialog', { name: 'Confirm account change' });
    await userEvent.click(within(dialog).getByRole('button', { name: 'Update' }));
    await waitFor(() => expect(api.update).toHaveBeenCalledWith(account.id, { status: 'archived' }));
  });

  it('keeps non-monetary summary metrics while mixed-currency money is unavailable', () => {
    providers(<SummaryCards data={{ isMixedCurrency: true, monetaryTotalsAvailable: false, currencies: ['ILS', 'USD'], totals: { tradesClosed: 3, winners: 2, losers: 1, winRate: 2 / 3, profitFactor: 2, avgRMultiple: 1 }, today: { tradesCount: 1 }, wtd: { tradesCount: 2 }, mtd: { tradesCount: 3 } }} />);
    expect(screen.getByText((content) => content.includes('66.7%'))).toBeInTheDocument();
    expect(screen.getAllByLabelText('Not available').length).toBeGreaterThanOrEqual(4);
  });
});
