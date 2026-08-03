import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const apiMocks = vi.hoisted(() => ({ accounts: vi.fn() }));
vi.mock('../../api/accounts.js', () => ({ accountsApi: { list: apiMocks.accounts } }));

import { DEFAULT_TRADE_FILTERS, FilterBar } from './FilterBar.jsx';

function StatefulFilterBar({ initial = DEFAULT_TRADE_FILTERS }) {
  const [filters, setFilters] = useState(initial);
  return (
    <>
      <FilterBar filters={filters} onChange={setFilters} />
      <output aria-label="Filter state">{JSON.stringify(filters)}</output>
    </>
  );
}

function renderFilters(initial) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } });
  return render(<QueryClientProvider client={client}><StatefulFilterBar initial={initial} /></QueryClientProvider>);
}

describe('FilterBar', () => {
  beforeEach(() => {
    apiMocks.accounts.mockResolvedValue([
      { id: 'account-1', company: 'Broker One', accountNumber: 'A-100', accountName: 'Primary' },
    ]);
    vi.useFakeTimers({ shouldAdvanceTime: true });
    vi.setSystemTime(new Date('2026-07-15T12:00:00'));
  });

  afterEach(() => vi.useRealTimers());

  it('preserves date preset behavior and resets paging', async () => {
    renderFilters({ ...DEFAULT_TRADE_FILTERS, page: 3 });
    await userEvent.click(screen.getByRole('button', { name: 'Today' }));

    expect(screen.getByLabelText('Filter state')).toHaveTextContent('"from":"2026-07-15"');
    expect(screen.getByLabelText('Filter state')).toHaveTextContent('"to":"2026-07-15"');
    expect(screen.getByLabelText('Filter state')).toHaveTextContent('"page":1');

    await userEvent.click(screen.getByRole('button', { name: 'All Time' }));
    expect(screen.getByLabelText('Filter state')).not.toHaveTextContent('"from"');
    expect(screen.getByLabelText('Filter state')).not.toHaveTextContent('"to"');
  });

  it('maps company-labelled account choices to accountId and preserves supported filters', async () => {
    renderFilters();
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    await user.click(screen.getByRole('button', { name: 'More filters' }));

    expect(await screen.findByRole('option', { name: 'Broker One — A-100 (Primary)' })).toHaveValue('account-1');
    await user.selectOptions(screen.getByLabelText('Account'), 'account-1');
    await user.selectOptions(screen.getByLabelText('Timeframe'), '15m');

    const state = screen.getByLabelText('Filter state');
    expect(state).toHaveTextContent('"accountId":"account-1"');
    expect(state).toHaveTextContent('"timeframe":"15m"');
    expect(state).toHaveTextContent('"limit":50');
    expect(state).toHaveTextContent('"sort":"entry_datetime"');
  });

  it('clears only user filters back to the production defaults', async () => {
    renderFilters({ ...DEFAULT_TRADE_FILTERS, symbol: 'AAPL', status: 'closed', page: 4 });
    await userEvent.click(screen.getByRole('button', { name: 'Clear all' }));
    expect(screen.getByLabelText('Filter state')).toHaveTextContent(JSON.stringify(DEFAULT_TRADE_FILTERS));
  });
});
