import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { format, startOfMonth, startOfWeek } from 'date-fns';

const apiMocks = vi.hoisted(() => ({
  accounts: vi.fn(), summary: vi.fn(), breakdown: vi.fn(), rDistribution: vi.fn(),
}));

vi.mock('../api/accounts.js', () => ({ accountsApi: { list: apiMocks.accounts } }));
vi.mock('../api/analytics.js', () => ({ analyticsApi: {
  summary: apiMocks.summary,
  breakdown: apiMocks.breakdown,
  rDistribution: apiMocks.rDistribution,
} }));
vi.mock('recharts', () => {
  const Component = ({ children }) => <div>{children}</div>;
  return {
    ResponsiveContainer: Component, BarChart: Component, Bar: Component, XAxis: Component,
    YAxis: Component, CartesianGrid: Component, Tooltip: Component, Cell: Component, ReferenceLine: Component,
  };
});

import Analytics from './Analytics.jsx';
import { Header } from '../components/layout/Header.jsx';
import { HeaderControlsProvider } from '../components/layout/HeaderControls.jsx';
import { AuthContext } from '../context/AuthContext.jsx';
import { resolveRouteMetadata } from '../routeMetadata.js';

const accounts = [
  { id: 'account-1', company: 'Broker A', accountNumber: 'A-100', accountName: 'Primary' },
  { id: 'account-2', company: 'Broker B', accountNumber: 'B-200' },
];
const summary = { totals: { tradesClosed: 3 } };
const breakdown = { data: [
  { key: 'futures', label: 'futures', tradesCount: 3, winners: 2, losers: 1, winRate: 2 / 3, pnlNet: 275, avgRMultiple: 1.2 },
] };
const rDistribution = { totalTrades: 1, buckets: [
  { key: '0_to_0_5', label: '0R to 0.5R', min: 0, max: 0.5, count: 1 },
] };

function setSuccess() {
  apiMocks.accounts.mockResolvedValue(accounts);
  apiMocks.summary.mockResolvedValue(summary);
  apiMocks.breakdown.mockResolvedValue(breakdown);
  apiMocks.rDistribution.mockResolvedValue(rDistribution);
}

function renderAnalytics(timezone = null) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } });
  const metadata = resolveRouteMetadata('/insights/analytics');
  return render(
    <AuthContext.Provider value={timezone ? { user: { timezone } } : null}>
      <QueryClientProvider client={client}>
        <MemoryRouter initialEntries={['/insights/analytics']}>
          <HeaderControlsProvider metadata={metadata}>
            <Header metadata={metadata} />
            <main><Analytics /></main>
          </HeaderControlsProvider>
        </MemoryRouter>
      </QueryClientProvider>
    </AuthContext.Provider>,
  );
}

describe('Analytics page', () => {
  beforeEach(() => vi.clearAllMocks());

  it('renders real API data with exactly one H1 and header-owned scope controls', async () => {
    setSuccess();
    renderAnalytics();
    expect(await screen.findByText('Dimension analysis')).toBeInTheDocument();
    expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1);
    expect(screen.getByRole('heading', { level: 1, name: 'Analytics' })).toBeInTheDocument();
    expect(screen.getByText(/markets, direction, strategy, timing/i)).toBeInTheDocument();
    expect(screen.getByLabelText('Account').closest('header')).toBeInTheDocument();
    expect(screen.getByRole('group', { name: 'Analytics period' }).closest('header')).toBeInTheDocument();
    expect(screen.getAllByLabelText('Account')).toHaveLength(1);
    expect(within(await screen.findByRole('region', { name: 'Analytics scope summary' })).getByText('3')).toBeInTheDocument();
    expect(screen.getByText('Calendar timezone')).toBeInTheDocument();
    expect(screen.getByText('Asia/Jerusalem')).toBeInTheDocument();
    expect(screen.queryByRole('combobox', { name: /timezone/i })).not.toBeInTheDocument();
    expect(screen.getAllByText(/Futures/).length).toBeGreaterThan(0);
    expect(screen.queryByText(/account balance/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/observation/i)).not.toBeInTheDocument();
  });

  it('preserves account, company, preset, custom-date, and dimension query parameters', async () => {
    setSuccess();
    renderAnalytics();
    const user = userEvent.setup();
    await screen.findByRole('option', { name: 'Broker A — A-100 (Primary)' });

    await user.selectOptions(screen.getByLabelText('Company'), 'Broker B');
    await waitFor(() => expect(apiMocks.summary).toHaveBeenLastCalledWith(expect.objectContaining({ company: 'Broker B' })));
    await user.selectOptions(screen.getByLabelText('Account'), 'account-1');
    await user.click(screen.getByRole('button', { name: 'Custom' }));
    fireEvent.change(screen.getByLabelText('Start date'), { target: { value: '2026-07-01' } });
    fireEvent.change(screen.getByLabelText('End date'), { target: { value: '2026-07-31' } });
    await user.click(screen.getByRole('button', { name: 'Weekday' }));

    await waitFor(() => expect(apiMocks.breakdown).toHaveBeenLastCalledWith({
      from: '2026-07-01', to: '2026-07-31', accountId: 'account-1', by: 'weekday',
    }));
    expect(apiMocks.rDistribution).toHaveBeenLastCalledWith({ from: '2026-07-01', to: '2026-07-31', accountId: 'account-1' });

    const today = format(new Date(), 'yyyy-MM-dd');
    await user.click(screen.getByRole('button', { name: 'Today' }));
    await waitFor(() => expect(apiMocks.summary).toHaveBeenLastCalledWith({ from: today, to: today, accountId: 'account-1' }));
    await user.click(screen.getByRole('button', { name: 'WTD' }));
    await waitFor(() => expect(apiMocks.summary).toHaveBeenLastCalledWith({
      from: format(startOfWeek(new Date(), { weekStartsOn: 1 }), 'yyyy-MM-dd'), to: today, accountId: 'account-1',
    }));
  });

  it('uses the same deliberate MTD default as Dashboard', async () => {
    setSuccess();
    renderAnalytics();
    const today = format(new Date(), 'yyyy-MM-dd');
    await waitFor(() => expect(apiMocks.summary).toHaveBeenCalledWith({ from: format(startOfMonth(new Date()), 'yyyy-MM-dd'), to: today }));
    expect(screen.getByRole('button', { name: 'MTD' })).toHaveAttribute('aria-pressed', 'true');
  });

  it('initializes Analytics presets and timezone visibility from the authenticated user timezone', async () => {
    vi.useFakeTimers();
    try {
      vi.setSystemTime(new Date('2026-08-01T21:30:00.000Z'));
      setSuccess();
      renderAnalytics('UTC');
      expect(apiMocks.summary).toHaveBeenCalledWith({ from: '2026-08-01', to: '2026-08-01' });
    } finally {
      vi.useRealTimers();
    }
    expect(await screen.findByText('UTC')).toBeInTheDocument();
    expect(screen.getAllByText('Calendar timezone')).toHaveLength(1);
  });

  it('shows layout loading states', () => {
    const never = new Promise(() => {});
    apiMocks.accounts.mockReturnValue(never);
    apiMocks.summary.mockReturnValue(never);
    apiMocks.breakdown.mockReturnValue(never);
    apiMocks.rDistribution.mockReturnValue(never);
    renderAnalytics();
    expect(screen.getByRole('status', { name: 'Loading Analytics scope summary' })).toBeInTheDocument();
    expect(screen.getByRole('status', { name: 'Loading dimension analysis' })).toBeInTheDocument();
    expect(screen.getByRole('status', { name: 'Loading R-multiple distribution' })).toBeInTheDocument();
  });

  it('shows one truthful no-trades state', async () => {
    setSuccess();
    apiMocks.summary.mockResolvedValue({ totals: { tradesClosed: 0 } });
    apiMocks.breakdown.mockResolvedValue({ data: [] });
    apiMocks.rDistribution.mockResolvedValue({ totalTrades: 0, buckets: [] });
    renderAnalytics();
    expect(await screen.findByRole('heading', { name: 'No closed trades in this scope' })).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'R-multiple data is unavailable' })).not.toBeInTheDocument();
  });

  it('distinguishes trades with no stored R values from 0R performance', async () => {
    setSuccess();
    apiMocks.rDistribution.mockResolvedValue({ totalTrades: 0, buckets: [] });
    renderAnalytics();
    expect(await screen.findByRole('heading', { name: 'R-multiple data is unavailable' })).toBeInTheDocument();
    expect(screen.getByText(/not treated as 0R/i)).toBeInTheDocument();
  });

  it('keeps R results visible when the breakdown fails', async () => {
    setSuccess();
    apiMocks.breakdown.mockRejectedValue(new Error('breakdown failed'));
    renderAnalytics();
    expect(await screen.findByText('Dimension analysis could not be loaded')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'R-multiple distribution' })).toBeInTheDocument();
    expect(screen.queryByText('Analytics could not be loaded')).not.toBeInTheDocument();
  });

  it('keeps breakdown results visible when R distribution fails', async () => {
    setSuccess();
    apiMocks.rDistribution.mockRejectedValue(new Error('R failed'));
    renderAnalytics();
    expect(await screen.findByText('R-multiple distribution could not be loaded')).toBeInTheDocument();
    expect(screen.getByText('Dimension analysis')).toBeInTheDocument();
  });

  it('shows a single retryable full-page failure when every analytics widget fails', async () => {
    apiMocks.accounts.mockResolvedValue([]);
    apiMocks.summary.mockRejectedValue(new Error('summary failed'));
    apiMocks.breakdown.mockRejectedValue(new Error('breakdown failed'));
    apiMocks.rDistribution.mockRejectedValue(new Error('R failed'));
    renderAnalytics();
    expect(await screen.findByText('Analytics could not be loaded')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Try again' })).toBeInTheDocument();
    expect(screen.queryByText('Dimension analysis could not be loaded')).not.toBeInTheDocument();
  });

  it('preserves previous breakdown content during a dimension refresh', async () => {
    setSuccess();
    let resolveWeekday;
    apiMocks.breakdown.mockImplementation(({ by }) => by === 'weekday'
      ? new Promise((resolve) => { resolveWeekday = resolve; })
      : Promise.resolve(breakdown));
    renderAnalytics();
    expect((await screen.findAllByText(/Futures/)).length).toBeGreaterThan(0);
    await userEvent.click(screen.getByRole('button', { name: 'Weekday' }));
    expect(await screen.findByText('Refreshing dimension analysis…')).toBeInTheDocument();
    expect(screen.getAllByText(/Futures/).length).toBeGreaterThan(0);
    resolveWeekday({ data: [] });
  });
});
