import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ToastProvider } from '../ui/Toast.jsx';

const apiMocks = vi.hoisted(() => ({ remove: vi.fn() }));
vi.mock('../../api/trades.js', () => ({ tradesApi: { remove: apiMocks.remove } }));

import { TradeTable } from './TradeTable.jsx';

const trades = [
  { id: 't-positive', accountId: 'a1', symbol: 'AAPL', market: 'stocks', direction: 'long', status: 'closed', entryDatetime: '2026-07-01T12:00:00Z', exitDatetime: '2026-07-01T13:00:00Z', entryPrice: 100, exitPrice: 110, quantity: 2, pnlNet: 20, rMultiple: 2, durationMinutes: 60, strategy: 'Breakout', setup: 'Opening range' },
  { id: 't-negative', accountId: 'a1', symbol: 'MSFT', market: 'stocks', direction: 'short', status: 'closed', entryDatetime: '2026-07-02T12:00:00Z', exitDatetime: '2026-07-02T13:00:00Z', entryPrice: 200, exitPrice: 205, quantity: 1, pnlNet: -5, rMultiple: -0.5, durationMinutes: 60 },
  { id: 't-zero', accountId: 'a1', symbol: 'FLAT', market: 'stocks', direction: 'long', status: 'closed', entryDatetime: '2026-07-03T12:00:00Z', entryPrice: 10, exitPrice: 10, quantity: 1, pnlNet: 0, rMultiple: 0, durationMinutes: 0 },
  { id: 't-open', accountId: 'a1', symbol: 'OPEN', market: 'crypto', direction: 'short', status: 'open', entryDatetime: '2026-07-04T12:00:00Z', entryPrice: 50, exitPrice: null, quantity: 3, pnlNet: null, rMultiple: null, durationMinutes: null },
];

function renderTable(props = {}) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } });
  return render(
    <QueryClientProvider client={client}>
      <ToastProvider>
        <MemoryRouter initialEntries={['/']}>
          <Routes>
            <Route path="/" element={<TradeTable trades={trades} accounts={[{ id: 'a1', company: 'Broker', accountNumber: '100', accountName: 'Main' }]} sort="entry_datetime" order="desc" onSort={vi.fn()} {...props} />} />
            <Route path="/trades/:id" element={<p>Trade detail route</p>} />
          </Routes>
        </MemoryRouter>
      </ToastProvider>
    </QueryClientProvider>,
  );
}

describe('TradeTable', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    apiMocks.remove.mockResolvedValue({});
  });

  it('exposes only real sortable headers and calls the existing sort callback', async () => {
    const onSort = vi.fn();
    renderTable({ onSort });

    expect(screen.getByRole('columnheader', { name: /^Entry$/ })).toHaveAttribute('aria-sort', 'descending');
    expect(screen.getByRole('columnheader', { name: /^Symbol$/ })).toHaveAttribute('aria-sort', 'none');
    expect(screen.getByRole('columnheader', { name: 'Market' })).not.toHaveAttribute('aria-sort');

    await userEvent.click(screen.getByRole('button', { name: /Sort by Symbol/ }));
    expect(onSort).toHaveBeenCalledWith('symbol');
  });

  it('opens a trade by keyboard and provides a real mobile card link', async () => {
    renderTable();
    screen.getByRole('row', { name: 'Open AAPL trade details' }).focus();
    await userEvent.keyboard('{Enter}');
    expect(screen.getByText('Trade detail route')).toBeInTheDocument();
  });

  it('keeps deletion separate from navigation and preserves confirmation', async () => {
    const confirm = vi.spyOn(window, 'confirm').mockReturnValueOnce(false).mockReturnValueOnce(true);
    renderTable();
    const deleteButton = screen.getAllByRole('button', { name: 'Delete trade' })[0];

    await userEvent.click(deleteButton);
    expect(confirm).toHaveBeenCalledWith('Delete this trade?');
    expect(apiMocks.remove).not.toHaveBeenCalled();
    expect(screen.queryByText('Trade detail route')).not.toBeInTheDocument();

    await userEvent.click(deleteButton);
    await waitFor(() => expect(apiMocks.remove).toHaveBeenCalledWith('t-positive'));
    expect(screen.queryByText('Trade detail route')).not.toBeInTheDocument();
  });

  it('uses action/comparison direction semantics and distinct PnL states', () => {
    renderTable();
    expect(screen.getAllByText('Long')[0]).toHaveClass('text-action');
    expect(screen.getAllByText('Short')[0]).toHaveClass('text-comparison');
    expect(screen.getAllByText('Gain:').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Loss:').length).toBeGreaterThan(0);
    expect(screen.getAllByText('No change:').length).toBeGreaterThan(0);

    const pnlHeader = screen.getByRole('columnheader', { name: /Net PnL/ });
    expect(pnlHeader).toHaveClass('text-end');
    const aaplRow = screen.getByRole('row', { name: 'Open AAPL trade details' });
    expect(aaplRow.querySelector('[dir="ltr"]')).toBeInTheDocument();
    expect(aaplRow.querySelector('.tabular-nums')).toBeInTheDocument();
  });

  it('renders the same real fields in mobile cards without fabricating open values', () => {
    renderTable();
    expect(screen.getByRole('link', { name: 'Open AAPL trade details' })).toHaveAttribute('href', '/trades/t-positive');
    const openCard = screen.getByRole('link', { name: 'Open OPEN trade details' });
    expect(openCard).toHaveTextContent('OPEN');
    expect(openCard).toHaveTextContent('—');
    expect(openCard).not.toHaveTextContent('$0.00');
  });
});
