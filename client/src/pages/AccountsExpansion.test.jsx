import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import i18n from '../i18n/index.js';
import { ToastProvider } from '../components/ui/Toast.jsx';

const api = vi.hoisted(() => ({ list: vi.fn(), get: vi.fn(), create: vi.fn(), update: vi.fn(), link: vi.fn(), portfolioList: vi.fn(), trades: vi.fn() }));
vi.mock('../api/accounts.js', () => ({ accountsApi: { list: api.list, get: api.get, create: api.create, update: api.update, linkInvestmentPortfolio: api.link } }));
vi.mock('../api/portfolio.js', () => ({ portfolioApi: { list: api.portfolioList } }));
vi.mock('../api/trades.js', () => ({ tradesApi: { list: api.trades } }));

import Accounts from './Accounts.jsx';
import AccountDetail from './AccountDetail.jsx';
import Portfolio from './Portfolio.jsx';
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
    api.portfolioList.mockResolvedValue({ portfolios: [] });
  });

  it('normalizes user-editable fields without changing internal account type keys', () => {
    expect(normalizeAccountForm({ company: ' Broker ', accountNumber: ' A-1 ', accountName: ' Main ', accountType: 'funded', baseCurrency: 'usd', openingBalance: '-5.25', isDefault: true })).toEqual({
      company: 'Broker', accountNumber: 'A-1', accountName: 'Main', accountType: 'funded', baseCurrency: 'USD', openingBalance: -5.25, isDefault: true,
      accountGroup: undefined, includeInInvestmentValue: false, includeInNetWorth: false, includeInTradingAnalytics: false,
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

  it('applies group defaults only for new Accounts and keeps explicit edit choices', async () => {
    await i18n.changeLanguage('en');
    const onCreate = vi.fn();
    const { unmount } = providers(<AccountForm initialValues={{ company: 'Broker', accountNumber: 'A-2' }} onSubmit={onCreate} />);
    await userEvent.selectOptions(screen.getByLabelText('Account group'), 'personal_investment');
    expect(screen.getByRole('checkbox', { name: 'Portfolio value' })).toBeChecked();
    expect(screen.getByRole('checkbox', { name: 'Personal net worth' })).toBeChecked();
    expect(screen.getByRole('checkbox', { name: 'Trading analytics' })).not.toBeChecked();
    await userEvent.click(screen.getByRole('button', { name: 'Create account' }));
    expect(onCreate).toHaveBeenCalledWith(expect.objectContaining({
      accountGroup: 'personal_investment', includeInInvestmentValue: true, includeInNetWorth: true, includeInTradingAnalytics: false,
    }));
    unmount();

    providers(<AccountForm account={{ ...account, accountGroup: 'active_trading', includeInInvestmentValue: true, includeInNetWorth: false, includeInTradingAnalytics: true }} onSubmit={vi.fn()} />);
    await userEvent.selectOptions(screen.getByLabelText('Account group'), 'personal_investment');
    expect(screen.getByRole('checkbox', { name: 'Portfolio value' })).toBeChecked();
    expect(screen.getByRole('checkbox', { name: 'Personal net worth' })).not.toBeChecked();
    expect(screen.getByRole('checkbox', { name: 'Trading analytics' })).toBeChecked();
  });

  it('groups Accounts and rolls a failed participation change back visibly', async () => {
    await i18n.changeLanguage('en');
    api.list.mockResolvedValue([{ ...account, accountGroup: 'active_trading', includeInTradingAnalytics: true }]);
    api.update.mockRejectedValue(new Error('offline'));
    providers(<Accounts />);
    expect(await screen.findByRole('heading', { name: 'Active Trading' })).toBeInTheDocument();
    const analytics = screen.getByRole('checkbox', { name: 'Trading analytics' });
    expect(analytics).toBeChecked();
    await userEvent.click(analytics);
    await waitFor(() => expect(api.update).toHaveBeenCalledWith(account.id, { includeInTradingAnalytics: false }));
    expect(analytics).toBeChecked();
  });

  it('presents enabled linked Accounts, keeps unlinked data visible, and groups currencies without FX', async () => {
    await i18n.changeLanguage('en');
    const linked = {
      id: 'portfolio-1', name: 'Internal ledger name', baseCurrency: 'USD', status: 'active', tradingAccountId: account.id,
      tradingAccount: { id: account.id, accountName: 'Main', company: 'Interactive Brokers', accountNumber: 'IL-001', status: 'active', includeInInvestmentValue: true },
      positionCount: 2, cashBalance: 100, marketValue: 900, totalValue: 1000, realizedPnl: 25, unrealizedPnl: 50,
      dividendIncome: 5, valuationAvailable: true, missingPriceCount: 0, lastTransactionDate: '2026-08-01',
    };
    api.portfolioList.mockResolvedValue({ portfolios: [
      linked,
      { ...linked, id: 'portfolio-2', baseCurrency: 'ILS', tradingAccountId: archived.id, tradingAccount: { ...linked.tradingAccount, id: archived.id, accountName: 'Israel', accountNumber: 'ILS-002', baseCurrency: 'ILS' } },
      { ...linked, id: 'legacy-portfolio', name: 'Historical ledger', tradingAccountId: null, tradingAccount: null },
      { ...linked, id: 'disabled-portfolio', tradingAccountId: 'disabled-account', tradingAccount: { ...linked.tradingAccount, id: 'disabled-account', accountName: 'Disabled', includeInInvestmentValue: false } },
    ] });
    providers(<Portfolio />, '/portfolio');
    expect(await screen.findByRole('link', { name: 'Main' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Israel' })).toBeInTheDocument();
    expect(screen.queryByText('Disabled')).not.toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Investment data not linked to an Account' })).toBeInTheDocument();
    expect(screen.getByText('Historical ledger')).toBeInTheDocument();
    expect(screen.getAllByText('No FX conversion').length).toBeGreaterThanOrEqual(2);
    expect(screen.getByText('IL-001')).toHaveAttribute('dir', 'ltr');
  });
});
