import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ToastProvider } from '../components/ui/Toast.jsx';

const apiMocks = vi.hoisted(() => ({ get: vi.fn(), update: vi.fn(), remove: vi.fn(), accounts: vi.fn() }));
vi.mock('../api/trades.js', () => ({ tradesApi: { get: apiMocks.get, update: apiMocks.update, remove: apiMocks.remove } }));
vi.mock('../api/accounts.js', () => ({ accountsApi: { list: apiMocks.accounts } }));
vi.mock('../components/trades/TradeForm.jsx', () => ({
  TradeForm: ({ defaultValues, onSubmit }) => (
    <div>
      <span>Editing {defaultValues.symbol}</span>
      <button type="button" onClick={() => onSubmit({ notes: 'Updated note' })}>Save mocked trade</button>
    </div>
  ),
}));

import TradeDetail from './TradeDetail.jsx';
import { Header } from '../components/layout/Header.jsx';
import { HeaderControlsProvider } from '../components/layout/HeaderControls.jsx';
import { resolveRouteMetadata } from '../routeMetadata.js';

const closedTrade = {
  id: 't1', accountId: 'a1', symbol: 'AAPL', market: 'stocks', direction: 'long', status: 'closed',
  entryDatetime: '2026-07-01T12:00:00Z', exitDatetime: '2026-07-01T13:30:00Z',
  entryPrice: 100, exitPrice: 110, quantity: 2, fees: 5, pnlGross: 130, pnlNet: 125,
  rMultiple: 2.5, durationMinutes: 90, riskAmount: 50, stopLoss: 95, takeProfit: 112,
  strategy: 'Breakout', setup: 'Opening range', timeframe: '15m', notes: 'Waited for confirmation.',
  emotions: { before: ['focused', 'patient'], after: 'calm' },
  screenshotLinks: ['https://example.com/chart.png', 'javascript:alert(1)', '', 'not-a-url'],
};

function renderDetail() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } });
  const metadata = resolveRouteMetadata('/trades/t1');
  return render(
    <QueryClientProvider client={client}>
      <ToastProvider>
        <MemoryRouter initialEntries={['/trades/t1']}>
          <HeaderControlsProvider metadata={metadata}>
            <Header metadata={metadata} />
            <Routes>
              <Route path="/trades/:id" element={<TradeDetail />} />
              <Route path="/trades" element={<p>Trades route</p>} />
            </Routes>
          </HeaderControlsProvider>
        </MemoryRouter>
      </ToastProvider>
    </QueryClientProvider>,
  );
}

describe('TradeDetail', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    apiMocks.accounts.mockResolvedValue([{ id: 'a1', company: 'Broker', accountNumber: '100', accountName: 'Main account' }]);
    apiMocks.update.mockResolvedValue({});
    apiMocks.remove.mockResolvedValue({});
  });

  it('renders a closed trade from real API fields without prototype-only panels', async () => {
    apiMocks.get.mockResolvedValue(closedTrade);
    renderDetail();

    expect(await screen.findByRole('heading', { name: 'AAPL' })).toHaveAttribute('dir', 'ltr');
    expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1);
    const summary = screen.getByRole('heading', { name: 'Financial result' }).parentElement;
    expect(within(summary).getAllByText(/\+\$125\.00/).length).toBeGreaterThan(0);
    expect(within(summary).getByText(/\+\$130\.00/)).toBeInTheDocument();
    expect(within(summary).getByText(/\$5\.00/)).toBeInTheDocument();
    expect(within(summary).getByText(/\+2\.50R/)).toBeInTheDocument();
    expect(within(summary).getByText(/1h 30m/)).toBeInTheDocument();
    expect(screen.getByText('Waited for confirmation.')).toBeInTheDocument();
    expect(screen.getByText('focused, patient')).toBeInTheDocument();
    expect(screen.getByText('calm')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Open trade attachment 1 from example\.com/ })).toHaveAttribute('rel', 'noreferrer noopener');
    expect(screen.getAllByRole('link')).toHaveLength(1);
    expect(screen.queryByText(/execution timeline/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/rule adherence/i)).not.toBeInTheDocument();
  });

  it('handles an open trade and missing optional plan values without fake zeroes', async () => {
    apiMocks.get.mockResolvedValue({
      ...closedTrade,
      status: 'open', exitDatetime: null, exitPrice: null, pnlGross: null, pnlNet: null,
      rMultiple: null, durationMinutes: null, riskAmount: null, stopLoss: null, takeProfit: null,
      notes: null, emotions: {}, screenshotLinks: [],
    });
    renderDetail();
    await screen.findByRole('heading', { name: 'AAPL' });
    expect(screen.getByRole('button', { name: 'Back to trades' }).closest('header')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Edit trade' }).closest('header')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Delete' }).closest('header')).toBeInTheDocument();
    expect(screen.getAllByRole('button', { name: 'Edit trade' })).toHaveLength(1);

    const summary = screen.getByRole('heading', { name: 'Financial result' }).parentElement;
    expect(within(summary).getByText('Net PnL').parentElement).toHaveTextContent('—');
    expect(within(summary).getByText('Duration').parentElement).toHaveTextContent('—');
    const plan = screen.getByRole('heading', { name: 'Plan versus outcome' }).parentElement;
    expect(within(plan).getByText('Risk amount').parentElement).toHaveTextContent('—');
    expect(screen.queryByRole('heading', { name: 'Notes' })).not.toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Emotions' })).not.toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Screenshot links' })).not.toBeInTheDocument();
  });

  it('keeps edit and delete mutations wired to the existing API behavior', async () => {
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    apiMocks.get.mockResolvedValue(closedTrade);
    renderDetail();
    await screen.findByRole('heading', { name: 'AAPL' });

    await userEvent.click(screen.getByRole('button', { name: 'Edit trade' }));
    expect(screen.getByText('Editing AAPL')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Save mocked trade' }));
    await waitFor(() => expect(apiMocks.update).toHaveBeenCalledWith('t1', { notes: 'Updated note' }));

    await userEvent.click(screen.getByRole('button', { name: 'Delete' }));
    expect(window.confirm).toHaveBeenCalledWith('Delete this trade permanently?');
    await waitFor(() => expect(apiMocks.remove).toHaveBeenCalledWith('t1'));
    expect(await screen.findByText('Trades route')).toBeInTheDocument();
  });

  it('renders deterministic loading and retryable error states', async () => {
    apiMocks.get.mockReturnValueOnce(new Promise(() => {}));
    const first = renderDetail();
    expect(screen.getByLabelText('Loading trade details')).toBeInTheDocument();
    first.unmount();

    apiMocks.get.mockRejectedValueOnce(new Error('network'));
    renderDetail();
    expect(await screen.findByText('Trade details could not be loaded')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Try again' })).toBeInTheDocument();
  });
});
