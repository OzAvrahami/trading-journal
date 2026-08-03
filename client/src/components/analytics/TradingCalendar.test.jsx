import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

const calendarMock = vi.hoisted(() => vi.fn());
vi.mock('../../api/analytics.js', () => ({ analyticsApi: { calendar: calendarMock } }));

import { TradingCalendar, buildCalendarDays, buildCalendarGrid } from './TradingCalendar.jsx';

function deferred() {
  let resolve;
  let reject;
  const promise = new Promise((res, rej) => { resolve = res; reject = rej; });
  return { promise, resolve, reject };
}

describe('TradingCalendar', () => {
  it('keeps hook order stable through disabled, loading, success, and error states', async () => {
    const august = deferred();
    calendarMock.mockImplementation(params => params.from === '2026-08-01' ? august.promise : Promise.reject(new Error('calendar failed')));
    const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } });
    const view = render(<QueryClientProvider client={client}><TradingCalendar /></QueryClientProvider>);

    expect(screen.getByRole('status', { name: 'Loading trading calendar' })).toBeInTheDocument();
    view.rerender(<QueryClientProvider client={client}><TradingCalendar qParams={{ from: '2026-08-03', to: '2026-08-10' }} /></QueryClientProvider>);
    august.resolve({ days: [{ date: '2026-08-03T00:00:00.000Z', pnlNet: 50, tradesCount: 1 }] });

    expect(await screen.findByRole('gridcell', { name: /Aug 3, 2026, \$50\.00, 1 trade/ })).toBeInTheDocument();
    view.rerender(<QueryClientProvider client={client}><TradingCalendar qParams={{ from: '2026-09-03', to: '2026-09-10' }} /></QueryClientProvider>);
    expect(await screen.findByText('Trading calendar could not be loaded')).toBeInTheDocument();
  });

  it('builds a Sunday-first month grid without shifting date keys', () => {
    const days = buildCalendarDays('2026-08-01', '2026-08-03', new Map());
    expect(days.map(day => day.date)).toEqual(['2026-08-01', '2026-08-02', '2026-08-03']);
    const grid = buildCalendarGrid(days, '2026-08-01');
    expect(grid.slice(0, 6)).toEqual([null, null, null, null, null, null]);
    expect(grid[6].date).toBe('2026-08-01');
  });

  it('can suppress normal calendar content while still surfacing errors', async () => {
    calendarMock.mockResolvedValue({ days: [] });
    const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } });
    const view = render(
      <QueryClientProvider client={client}>
        <TradingCalendar qParams={{ from: '2026-10-03', to: '2026-10-10' }} errorsOnly />
      </QueryClientProvider>,
    );
    expect(screen.queryByRole('status', { name: 'Loading trading calendar' })).not.toBeInTheDocument();
    await waitFor(() => expect(calendarMock).toHaveBeenCalled());
    expect(screen.queryByRole('grid')).not.toBeInTheDocument();

    calendarMock.mockRejectedValue(new Error('calendar failed'));
    view.rerender(
      <QueryClientProvider client={client}>
        <TradingCalendar qParams={{ from: '2026-11-03', to: '2026-11-10' }} errorsOnly />
      </QueryClientProvider>,
    );
    expect(await screen.findByText('Trading calendar could not be loaded')).toBeInTheDocument();
  });
});
