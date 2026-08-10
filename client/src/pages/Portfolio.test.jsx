import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const api = vi.hoisted(() => ({ scope: vi.fn(), overview: vi.fn(), holdings: vi.fn(), quotes: vi.fn() }));
vi.mock('../api/investments.js', () => ({
  investmentsApi: { scope: api.scope, overview: api.overview, holdings: api.holdings },
}));
vi.mock('../api/marketData.js', () => ({
  MARKET_DATA_BATCH_SIZE: 25,
  marketDataApi: { quotes: api.quotes },
}));
vi.mock('../components/portfolio/InvestmentValueChart.jsx', () => ({
  InvestmentValueChart: () => <div aria-label="Recorded value history" />,
}));

import Portfolio from './Portfolio.jsx';

const accountId = '11111111-1111-4111-8111-111111111111';
const account = {
  accountId,
  accountName: 'Main investments',
  company: 'Broker',
  accountNumber: 'A-100',
  accountStatus: 'active',
  includeInInvestmentValue: true,
  baseCurrency: 'USD',
  portfolioId: '22222222-2222-4222-8222-222222222222',
  portfolioStatus: 'active',
};
const position = {
  ...account,
  instrumentId: '33333333-3333-4333-8333-333333333333',
  symbol: 'AAPL',
  name: 'Apple position',
  assetType: 'stock',
  currency: 'USD',
  quantity: 10,
  averageCost: 250,
  costBasis: 2500,
  realizedPnl: 100,
  dividendIncome: 20,
  latestPrice: 275,
  latestPriceDate: '2026-08-01',
  marketValue: 2750,
  unrealizedPnl: 250,
  unrealizedReturnPercent: 0.1,
  valuationAvailable: true,
};
const group = {
  currency: 'USD', accountCount: 1, positionCount: 1, cashBalance: 500,
  totalCostBasis: 2500, realizedPnl: 100, dividendIncome: 20, totalFees: 5,
  netContributions: 3000, marketValue: 2750, unrealizedPnl: 250, totalValue: 3250,
  missingPriceCount: 0, valuationAvailable: true,
};
const overview = {
  currencyGroups: [group],
  topHoldings: [position],
  recentTransactions: [],
  dividendSummary: { paymentCount: 0, currencies: [] },
  allocationPreview: [{ currency: 'USD', valuationAvailable: true, cashVersusInvested: [] }],
  valueHistory: [],
};

function renderPage() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={[`/portfolio?accountId=${accountId}`]}>
        <Portfolio />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe('Portfolio current live valuation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    api.scope.mockResolvedValue({ scope: { mode: 'account', selectedAccount: account, accounts: [account], historicalScope: false, unlinkedPortfolios: [] } });
    api.overview.mockResolvedValue(overview);
    api.holdings.mockResolvedValue({ holdings: [position] });
  });

  it('uses all scoped holdings and live quotes for current portfolio totals', async () => {
    api.quotes.mockResolvedValue({ quotes: [{
      symbol: 'AAPL', price: 312, change: 1.5, changePercent: 0.4831,
      previousClose: 310.5, asOf: '2026-08-10T18:30:00.000Z',
    }] });

    renderPage();

    const summary = (await screen.findByRole('heading', { name: 'Investment summary' })).closest('section');
    await waitFor(() => expect(api.quotes).toHaveBeenCalledWith(['AAPL']));
    expect(api.holdings).toHaveBeenCalledWith({ accountId });
    expect(within(summary).getByText('Total value').parentElement).toHaveTextContent('$3,620.00');
    expect(within(summary).getByText('Market value').parentElement).toHaveTextContent('$3,120.00');
    expect(within(summary).getByText('Unrealized PnL').parentElement).toHaveTextContent('+$620.00');
    expect(within(summary).getByText('Unrealized return').parentElement).toHaveTextContent('24.8%');
    expect(within(summary).getByText('Portfolio daily PnL').parentElement).toHaveTextContent('+$15.00');
    expect(within(summary).getByText('Realized PnL').parentElement).toHaveTextContent('+$100.00');
    expect(screen.getByText('Live valuation')).toBeInTheDocument();
  });

  it('keeps the stored portfolio usable when the quote API fails', async () => {
    api.quotes.mockRejectedValue(new Error('provider unavailable'));

    renderPage();

    expect(await screen.findByText('Live valuation is unavailable. Stored manual valuation remains visible where available.')).toBeInTheDocument();
    const summary = screen.getByRole('heading', { name: 'Investment summary' }).closest('section');
    expect(within(summary).getByText('Total value').parentElement).toHaveTextContent('$3,250.00');
    expect(within(summary).getByText('Market value').parentElement).toHaveTextContent('$2,750.00');
    expect(screen.queryByText('Investment Overview could not be loaded')).not.toBeInTheDocument();
  });
});
