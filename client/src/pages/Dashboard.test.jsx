import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import { currentDateKey, mondayForDateKey } from '../utils/dateOnly.js';

const apiMocks = vi.hoisted(() => ({
  accounts: vi.fn(),
  summary: vi.fn(),
  equityCurve: vi.fn(),
  distribution: vi.fn(),
  breakdown: vi.fn(),
}));

vi.mock('../api/accounts.js', () => ({ accountsApi: { list: apiMocks.accounts } }));
vi.mock('../api/analytics.js', () => ({ analyticsApi: {
  summary: apiMocks.summary,
  equityCurve: apiMocks.equityCurve,
  distribution: apiMocks.distribution,
  breakdown: apiMocks.breakdown,
} }));
vi.mock('../components/analytics/EquityCurve.jsx', () => ({ EquityCurve: ({ isLoading, error }) => <div>{isLoading ? 'Equity loading' : error ? 'Equity error' : 'Equity ready'}</div> }));
vi.mock('../components/analytics/PnLHistogram.jsx', () => ({ PnLHistogram: ({ isLoading, error }) => <div>{isLoading ? 'Distribution loading' : error ? 'Distribution error' : 'Distribution ready'}</div> }));
vi.mock('../components/analytics/BreakdownChart.jsx', () => ({ BreakdownChart: ({ isLoading, error, onByChange }) => <button type="button" onClick={() => onByChange('symbol')}>{isLoading ? 'Breakdown loading' : error ? 'Breakdown error' : 'Breakdown ready'}</button> }));
vi.mock('../components/analytics/TradingCalendar.jsx', () => ({ TradingCalendar: ({ errorsOnly }) => errorsOnly ? null : <div>Calendar widget</div> }));
vi.mock('../components/trades/QuickAddModal.jsx', () => ({ QuickAddModal: ({ open, onClose }) => open ? <div role="dialog"><span>Add trade flow</span><button onClick={onClose}>Close</button></div> : null }));

import Dashboard from './Dashboard.jsx';
import { Header } from '../components/layout/Header.jsx';
import { HeaderControlsProvider } from '../components/layout/HeaderControls.jsx';
import { AuthContext } from '../context/AuthContext.jsx';
import { resolveRouteMetadata } from '../routeMetadata.js';

const successSummary = {
  today: { pnlNet: 125, tradesCount: 1 },
  wtd: { pnlNet: 200, tradesCount: 2 },
  mtd: { pnlNet: -50, tradesCount: 4 },
  totals: {
    pnlNet: 275, tradesClosed: 3, winners: 2, losers: 1, winRate: 2 / 3,
    avgWin: 200, avgLoss: -125, expectancy: 91.67, profitFactor: 3.2, avgRMultiple: 1.25,
  },
};

function setSuccess(summary = successSummary) {
  apiMocks.accounts.mockResolvedValue([
    { id: 'account-1', company: 'Broker A', accountNumber: 'A-100', accountName: 'Primary' },
    { id: 'account-2', company: 'Broker B', accountNumber: 'B-200' },
  ]);
  apiMocks.summary.mockResolvedValue(summary);
  apiMocks.equityCurve.mockResolvedValue({ data: [] });
  apiMocks.distribution.mockResolvedValue({ buckets: [] });
  apiMocks.breakdown.mockResolvedValue({ data: [] });
}

function renderDashboard(timezone = null) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } });
  const metadata = resolveRouteMetadata('/dashboard');
  return render(
    <AuthContext.Provider value={timezone ? { user: { timezone } } : null}>
      <QueryClientProvider client={client}>
        <MemoryRouter>
          <HeaderControlsProvider metadata={metadata}>
            <Header metadata={metadata} />
            <Dashboard />
          </HeaderControlsProvider>
        </MemoryRouter>
      </QueryClientProvider>
    </AuthContext.Provider>,
  );
}

describe('Dashboard', () => {
  beforeEach(() => vi.clearAllMocks());

  it('shows layout-mirroring skeletons without a duplicate page heading', () => {
    const never = new Promise(() => {});
    apiMocks.accounts.mockReturnValue(never);
    apiMocks.summary.mockReturnValue(never);
    apiMocks.equityCurve.mockReturnValue(never);
    apiMocks.distribution.mockReturnValue(never);
    apiMocks.breakdown.mockReturnValue(never);
    renderDashboard();

    expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1);
    expect(screen.getByRole('region', { name: 'Loading Dashboard metrics' })).toBeInTheDocument();
    expect(screen.getByText('Equity loading')).toBeInTheDocument();
  });

  it('renders production API values, all analytics widgets, and keeps Add Trade wired', async () => {
    setSuccess();
    renderDashboard();

    expect(await screen.findByText('Period net PnL')).toBeInTheDocument();
    expect(screen.getByText(/\+\$275\.00/)).toBeInTheDocument();
    expect(screen.getByText('3 closed trades')).toBeInTheDocument();
    expect(screen.getByText('Average net PnL per closed trade')).toBeInTheDocument();
    expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1);
    expect(screen.getByText('Equity ready')).toBeInTheDocument();
    expect(screen.getByText('Distribution ready')).toBeInTheDocument();
    expect(screen.getByText('Breakdown ready')).toBeInTheDocument();
    expect(screen.getByText('Calendar widget')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Add Trade' }).closest('header')).toBeInTheDocument();
    expect(screen.queryByText(/balance/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/included accounts/i)).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'Add Trade' }));
    expect(screen.getByRole('dialog')).toHaveTextContent('Add trade flow');
  });

  it('uses one restrained empty state while keeping real zeroes and unavailable ratios distinct', async () => {
    setSuccess({
      today: { pnlNet: 0, tradesCount: 0 }, wtd: { pnlNet: 0, tradesCount: 0 }, mtd: { pnlNet: 0, tradesCount: 0 },
      totals: { pnlNet: 0, tradesClosed: 0, winners: 0, losers: 0, winRate: 0, avgWin: 0, avgLoss: 0, expectancy: null, profitFactor: null, avgRMultiple: null },
    });
    renderDashboard();

    expect(await screen.findByRole('heading', { name: 'No closed trades in this period' })).toBeInTheDocument();
    expect(screen.getAllByRole('heading', { name: 'No closed trades in this period' })).toHaveLength(1);
    expect(screen.getByText('Period net PnL').parentElement).toHaveTextContent('$0.00');
    expect(screen.getByText('Period net PnL').parentElement).toHaveTextContent('No change:');
    expect(screen.getByText('Win rate').parentElement).toHaveTextContent('—');
    expect(screen.getByText('Expectancy').parentElement).toHaveTextContent('—');
    expect(screen.queryByText('Equity ready')).not.toBeInTheDocument();
    expect(screen.queryByText('Distribution ready')).not.toBeInTheDocument();
    expect(screen.queryByText('Breakdown ready')).not.toBeInTheDocument();
    expect(screen.queryByText('Calendar widget')).not.toBeInTheDocument();
    expect(screen.getAllByRole('button', { name: 'Add Trade' })).toHaveLength(1);

    await userEvent.click(screen.getByRole('button', { name: 'Add Trade' }));
    expect(screen.getByRole('dialog')).toHaveTextContent('Add trade flow');
  });

  it('shows a retryable full-dashboard error when every analytics query fails', async () => {
    apiMocks.accounts.mockResolvedValue([]);
    apiMocks.summary.mockRejectedValue(new Error('summary failed'));
    apiMocks.equityCurve.mockRejectedValue(new Error('equity failed'));
    apiMocks.distribution.mockRejectedValue(new Error('distribution failed'));
    apiMocks.breakdown.mockRejectedValue(new Error('breakdown failed'));
    renderDashboard();

    expect(await screen.findByText('Dashboard analytics could not be loaded')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Try again' })).toBeInTheDocument();
    expect(screen.getByText(/independently loaded calendar/i)).toBeInTheDocument();
  });

  it('keeps successful widgets visible when one query fails', async () => {
    setSuccess();
    apiMocks.distribution.mockRejectedValue(new Error('distribution failed'));
    renderDashboard();

    expect(await screen.findByText('Period net PnL')).toBeInTheDocument();
    expect(screen.getByText('Equity ready')).toBeInTheDocument();
    expect(screen.getByText('Distribution error')).toBeInTheDocument();
    expect(screen.queryByText('Dashboard analytics could not be loaded')).not.toBeInTheDocument();
  });

  it('preserves account and date query parameters', async () => {
    setSuccess();
    renderDashboard();
    const user = userEvent.setup();
    await screen.findByRole('option', { name: 'Broker A — A-100 (Primary)' });
    expect(screen.getByLabelText('Account').parentElement).toHaveClass('adaptive:w-56');

    await user.selectOptions(screen.getByLabelText('Account'), 'account-1');
    await user.click(screen.getByRole('button', { name: 'Custom' }));
    fireEvent.change(screen.getByLabelText('Start date'), { target: { value: '2026-07-01' } });
    fireEvent.change(screen.getByLabelText('End date'), { target: { value: '2026-07-31' } });

    await waitFor(() => expect(apiMocks.summary).toHaveBeenLastCalledWith({ from: '2026-07-01', to: '2026-07-31', accountId: 'account-1' }));
  });

  it('maps Today and WTD presets to the existing from/to query shape', async () => {
    setSuccess();
    renderDashboard();
    const user = userEvent.setup();
    const now = new Date();
    const today = currentDateKey('Asia/Jerusalem', now);
    const weekStart = mondayForDateKey(today);

    await user.click(screen.getByRole('button', { name: 'Today' }));
    await waitFor(() => expect(apiMocks.summary).toHaveBeenLastCalledWith({ from: today, to: today }));

    await user.click(screen.getByRole('button', { name: 'WTD' }));
    await waitFor(() => expect(apiMocks.summary).toHaveBeenLastCalledWith({ from: weekStart, to: today }));
  });

  it('maps Dashboard presets from the authenticated user timezone', () => {
    vi.useFakeTimers();
    try {
      vi.setSystemTime(new Date('2026-08-01T21:30:00.000Z'));
      setSuccess();
      renderDashboard('UTC');
      fireEvent.click(screen.getByRole('button', { name: 'Today' }));
      expect(apiMocks.summary).toHaveBeenLastCalledWith({ from: '2026-08-01', to: '2026-08-01' });
      fireEvent.click(screen.getByRole('button', { name: 'WTD' }));
      expect(apiMocks.summary).toHaveBeenLastCalledWith({ from: '2026-07-27', to: '2026-08-01' });
    } finally {
      vi.useRealTimers();
    }
  });
});
