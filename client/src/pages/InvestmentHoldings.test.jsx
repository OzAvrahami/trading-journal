import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ToastProvider } from '../components/ui/Toast.jsx';

const api = vi.hoisted(() => ({
  scope: vi.fn(),
  holdings: vi.fn(),
  quotes: vi.fn(),
  instruments: vi.fn(),
  upsertPrice: vi.fn(),
}));

vi.mock('../api/investments.js', () => ({
  investmentsApi: { scope: api.scope, holdings: api.holdings },
}));
vi.mock('../api/marketData.js', () => ({
  MARKET_DATA_BATCH_SIZE: 25,
  marketDataApi: { quotes: api.quotes },
}));
vi.mock('../api/portfolio.js', () => ({
  portfolioApi: { instruments: api.instruments, upsertPrice: api.upsertPrice },
}));

import InvestmentHoldings from './InvestmentHoldings.jsx';

const account = {
  accountId: '11111111-1111-4111-8111-111111111111',
  accountName: 'Main investments',
  company: 'Broker',
  accountNumber: 'A-100',
  accountStatus: 'active',
  includeInInvestmentValue: true,
  baseCurrency: 'USD',
  portfolioId: '22222222-2222-4222-8222-222222222222',
  portfolioStatus: 'active',
};

const scope = {
  mode: 'all',
  selectedAccount: null,
  accounts: [account],
  historicalScope: false,
  unlinkedPortfolios: [],
};

function holding(overrides = {}) {
  return {
    accountId: account.accountId,
    accountName: account.accountName,
    accountCompany: account.company,
    portfolioId: account.portfolioId,
    instrumentId: '33333333-3333-4333-8333-333333333333',
    symbol: 'AAPL',
    name: 'Apple position',
    assetType: 'stock',
    currency: 'USD',
    quantity: 2,
    averageCost: 100,
    costBasis: 200,
    latestPrice: 110,
    marketValue: 220,
    unrealizedPnl: 20,
    unrealizedReturnPercent: 0.1,
    dividendIncome: 4,
    latestPriceDate: '2026-08-01',
    valuationAvailable: true,
    ...overrides,
  };
}

function quote(symbol, price, overrides = {}) {
  return {
    symbol,
    price,
    change: 1.46,
    changePercent: 0.4695,
    dayHigh: price + 2,
    dayLow: price - 2,
    open: price - 1,
    previousClose: price - 1.46,
    asOf: '2026-08-06T19:08:24.000Z',
    ...overrides,
  };
}

function renderPage() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <ToastProvider>
        <MemoryRouter initialEntries={['/portfolio/holdings']}>
          <InvestmentHoldings />
        </MemoryRouter>
      </ToastProvider>
    </QueryClientProvider>,
  );
}

function positionCard(name) {
  return screen.getByText(name).closest('article');
}

describe('Investment Holdings live market quotes', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    api.scope.mockResolvedValue({ scope });
    api.instruments.mockResolvedValue({ instruments: [] });
    api.upsertPrice.mockResolvedValue({});
  });

  it('normalizes and deduplicates batch symbols, then associates quotes by symbol', async () => {
    api.holdings.mockResolvedValue({
      holdings: [
        holding({ symbol: ' msft ', name: 'Microsoft position', instrumentId: 'instrument-msft', marketValue: 840 }),
        holding(),
        holding({ symbol: 'aapl', name: 'Apple second account', instrumentId: 'instrument-aapl-2', accountId: 'account-2' }),
      ],
    });
    api.quotes.mockResolvedValue({
      quotes: [quote('MSFT', 420.25, { change: -2.5, changePercent: -0.5913 }), quote('AAPL', 312.46)],
    });

    renderPage();

    expect(await screen.findByText('Apple position')).toBeInTheDocument();
    await waitFor(() => expect(api.quotes).toHaveBeenCalledWith(['AAPL', 'MSFT']));
    expect(api.quotes).toHaveBeenCalledOnce();

    const apple = positionCard('Apple position');
    const microsoft = positionCard('Microsoft position');
    expect(within(apple).getByRole('region', { name: 'Live market data' })).toHaveTextContent('+0.47%');
    expect(within(apple).getByText('Current market price').parentElement).toHaveTextContent('$312.46');
    expect(apple).toHaveTextContent('$624.92');
    expect(apple).toHaveTextContent('+$424.92');
    expect(within(apple).getByText('Holding daily PnL').parentElement).toHaveTextContent('+$2.92');
    expect(within(microsoft).getByText('Current market price').parentElement).toHaveTextContent('$420.25');
    expect(within(microsoft).getByRole('region', { name: 'Live market data' })).toHaveTextContent('-0.59%');
    expect(screen.getAllByRole('button', { name: 'Update price' })).toHaveLength(3);
  });

  it('keeps stored holdings and manual-price controls available when market data fails', async () => {
    api.holdings.mockResolvedValue({ holdings: [holding()] });
    api.quotes.mockRejectedValue(new Error('market data unavailable'));

    renderPage();

    expect(await screen.findByText('Live market quotes are unavailable. Stored and manual valuations remain available.')).toBeInTheDocument();
    const apple = positionCard('Apple position');
    expect(apple).toHaveTextContent('$220.00');
    expect(within(apple).getByRole('button', { name: 'Update price' })).toBeInTheDocument();
    expect(screen.queryByText('Holdings could not be loaded')).not.toBeInTheDocument();
  });

  it('falls back to the stored valuation when one symbol has no matching quote', async () => {
    api.holdings.mockResolvedValue({
      holdings: [
        holding(),
        holding({ symbol: 'MSFT', name: 'Microsoft position', instrumentId: 'instrument-msft', marketValue: 840 }),
      ],
    });
    api.quotes.mockResolvedValue({ quotes: [quote('AAPL', 312.46)] });

    renderPage();

    expect(await screen.findByText('No live quote is available for this symbol. Stored valuation is shown.')).toBeInTheDocument();
    const microsoft = positionCard('Microsoft position');
    expect(microsoft).toHaveTextContent('$840.00');
    expect(within(microsoft).queryByRole('region', { name: 'Live market data' })).not.toBeInTheDocument();
    expect(within(positionCard('Apple position')).getByText('Current market price').parentElement).toHaveTextContent('$312.46');
  });

  it('does not request market data when there are no holdings', async () => {
    api.holdings.mockResolvedValue({ holdings: [] });

    renderPage();

    expect(await screen.findByText('No current Holdings')).toBeInTheDocument();
    expect(api.quotes).not.toHaveBeenCalled();
  });

  it('renders holdings and manual controls while live quotes are still loading', async () => {
    api.holdings.mockResolvedValue({ holdings: [holding()] });
    let resolveQuotes;
    api.quotes.mockReturnValue(new Promise((resolve) => { resolveQuotes = resolve; }));

    renderPage();

    expect(await screen.findByText('Apple position')).toBeInTheDocument();
    expect(screen.getByText('Loading live market quotes…')).toBeInTheDocument();
    expect(positionCard('Apple position')).toHaveTextContent('$220.00');
    expect(screen.getByRole('button', { name: 'Update price' })).toBeInTheDocument();
    expect(screen.queryByRole('status', { name: 'Loading Holdings' })).not.toBeInTheDocument();

    resolveQuotes({ quotes: [quote('AAPL', 312.46)] });
    await waitFor(() => expect(within(positionCard('Apple position')).getByRole('region', { name: 'Live market data' })).toBeInTheDocument());
  });
});
