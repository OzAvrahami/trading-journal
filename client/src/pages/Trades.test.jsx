import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ToastProvider } from '../components/ui/Toast.jsx';

const apiMocks = vi.hoisted(() => ({ list: vi.fn(), remove: vi.fn(), exportCsv: vi.fn(), accounts: vi.fn(), download: vi.fn() }));
vi.mock('../api/trades.js', () => ({ tradesApi: { list: apiMocks.list, remove: apiMocks.remove, exportCsv: apiMocks.exportCsv } }));
vi.mock('../api/accounts.js', () => ({ accountsApi: { list: apiMocks.accounts } }));
vi.mock('../utils/csvExport.js', () => ({ downloadBlob: apiMocks.download }));
vi.mock('../components/trades/QuickAddModal.jsx', () => ({ QuickAddModal: ({ open }) => open ? <div role="dialog">Existing Add Trade flow</div> : null }));

import Trades from './Trades.jsx';
import { Header } from '../components/layout/Header.jsx';
import { HeaderControlsProvider } from '../components/layout/HeaderControls.jsx';
import { resolveRouteMetadata } from '../routeMetadata.js';

const trade = { id: 't1', accountId: 'a1', symbol: 'AAPL', market: 'stocks', direction: 'long', status: 'closed', entryDatetime: '2026-07-01T12:00:00Z', exitDatetime: '2026-07-01T13:00:00Z', entryPrice: 100, exitPrice: 110, quantity: 2, pnlNet: 20, rMultiple: 2, durationMinutes: 60 };

function response(data = [], overrides = {}) {
  return { data, pagination: { page: 1, limit: 50, total: data.length, totalPages: 1, ...overrides } };
}

function renderTrades() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } });
  const metadata = resolveRouteMetadata('/trades');
  return render(
    <QueryClientProvider client={client}>
      <ToastProvider>
        <MemoryRouter>
          <HeaderControlsProvider metadata={metadata}>
            <Header metadata={metadata} />
            <Trades />
          </HeaderControlsProvider>
        </MemoryRouter>
      </ToastProvider>
    </QueryClientProvider>,
  );
}

describe('Trades page', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    apiMocks.accounts.mockResolvedValue([{ id: 'a1', company: 'Broker', accountNumber: '100', accountName: 'Main' }]);
    apiMocks.remove.mockResolvedValue({});
    apiMocks.exportCsv.mockResolvedValue(new Blob(['csv']));
  });

  it('renders table-shaped and card-shaped skeletons without a duplicate H1', () => {
    apiMocks.list.mockReturnValue(new Promise(() => {}));
    renderTrades();
    expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1);
    expect(screen.getByLabelText('Loading trades')).toBeInTheDocument();
    expect(screen.getAllByLabelText('Loading trade row').length).toBeGreaterThan(0);
    expect(screen.getAllByLabelText('Loading trade card')).toHaveLength(3);
  });

  it('distinguishes no trades from filtered-empty and clears real filter state', async () => {
    apiMocks.list.mockResolvedValue(response());
    renderTrades();
    expect(await screen.findByRole('heading', { name: 'No trades recorded yet' })).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'More filters' }));
    fireEvent.change(screen.getByLabelText('Symbol'), { target: { value: 'ZZZZ' } });
    expect(await screen.findByRole('heading', { name: 'No trades match the current filters' })).toBeInTheDocument();
    await userEvent.click(screen.getAllByRole('button', { name: 'Clear filters' }).at(-1));

    await waitFor(() => expect(apiMocks.list).toHaveBeenLastCalledWith(expect.objectContaining({ page: 1, limit: 50, sort: 'entry_datetime', order: 'desc' })));
    expect(apiMocks.list.mock.calls.at(-1)[0]).not.toHaveProperty('symbol');
  });

  it('shows a retryable API error while preserving the filter UI', async () => {
    apiMocks.list.mockRejectedValue(new Error('network'));
    renderTrades();
    expect(await screen.findByText('Trades could not be loaded')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Try again' })).toBeInTheDocument();
    expect(screen.getByRole('region', { name: 'Trade filters' })).toBeInTheDocument();
  });

  it('renders real response fields and omits unsupported design concepts', async () => {
    apiMocks.list.mockResolvedValue(response([trade]));
    renderTrades();
    expect((await screen.findAllByText('AAPL')).length).toBeGreaterThan(0);
    expect(screen.getAllByText('Main').length).toBeGreaterThan(0);
    expect(screen.queryByText(/review status/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/execution timeline/i)).not.toBeInTheDocument();
    expect(screen.getByText('Showing 1–1 of 1 trades')).toBeInTheDocument();
  });

  it('preserves paging, export scope, and the existing Add Trade flow', async () => {
    apiMocks.list.mockImplementation((filters) => Promise.resolve(response([trade], { page: filters.page, total: 75, totalPages: 2 })));
    renderTrades();
    await screen.findByText('Showing 1–1 of 75 trades');
    expect(screen.getByRole('button', { name: 'Export CSV' }).closest('header')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Add trade' }).closest('header')).toBeInTheDocument();
    expect(screen.getAllByRole('button', { name: 'Export CSV' })).toHaveLength(1);
    expect(screen.getAllByRole('button', { name: 'Add trade' })).toHaveLength(1);

    await userEvent.click(screen.getByRole('button', { name: 'Next' }));
    await waitFor(() => expect(apiMocks.list).toHaveBeenLastCalledWith(expect.objectContaining({ page: 2, limit: 50 })));

    await userEvent.click(screen.getByRole('button', { name: 'Export CSV' }));
    await waitFor(() => expect(apiMocks.exportCsv).toHaveBeenCalledWith(expect.objectContaining({ page: 2, limit: 50, sort: 'entry_datetime', order: 'desc' })));
    expect(apiMocks.download).toHaveBeenCalledWith(expect.any(Blob), expect.stringMatching(/^trades-\d{4}-\d{2}-\d{2}\.csv$/));

    await userEvent.click(screen.getByRole('button', { name: 'Add trade' }));
    expect(screen.getByRole('dialog')).toHaveTextContent('Existing Add Trade flow');
  });
});
