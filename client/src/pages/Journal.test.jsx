import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const apiMocks = vi.hoisted(() => ({
  list: vi.fn(), calendar: vi.fn(), get: vi.fn(), create: vi.fn(), update: vi.fn(), remove: vi.fn(),
  trades: vi.fn(), accounts: vi.fn(),
}));

vi.mock('../api/journal.js', () => ({ journalApi: {
  list: apiMocks.list,
  calendar: apiMocks.calendar,
  get: apiMocks.get,
  create: apiMocks.create,
  update: apiMocks.update,
  remove: apiMocks.remove,
} }));
vi.mock('../api/trades.js', () => ({ tradesApi: { list: apiMocks.trades } }));
vi.mock('../api/accounts.js', () => ({ accountsApi: { list: apiMocks.accounts } }));

import Journal from './Journal.jsx';
import { Header } from '../components/layout/Header.jsx';
import { HeaderControlsProvider } from '../components/layout/HeaderControls.jsx';
import { ToastProvider } from '../components/ui/Toast.jsx';
import { resolveRouteMetadata } from '../routeMetadata.js';
import { addMonthsToKey, buildJournalCalendarGrid } from '../components/journal/JournalCalendar.jsx';
import { localTodayKey } from '../utils/dateOnly.js';

const ids = ['11111111-1111-4111-8111-111111111111', '22222222-2222-4222-8222-222222222222', '33333333-3333-4333-8333-333333333333', '44444444-4444-4444-8444-444444444444'];
const today = localTodayKey();
const currentMonth = today.slice(0, 7);
const entry = {
  id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
  entryType: 'trade_review',
  entryDate: today,
  title: 'Opening range review',
  content: 'Waited for confirmation.\n<img src=x onerror=alert(1)>',
  tags: ['Process', 'Patience'],
  isComplete: false,
  createdAt: `${today}T10:00:00.000Z`,
  updatedAt: `${today}T10:00:00.000Z`,
  trades: [
    { id: ids[0], accountId: 'account-1', symbol: 'ES', entryDatetime: `${today}T09:00:00Z`, status: 'closed', pnlNet: 25 },
    { id: ids[1], accountId: 'account-1', symbol: 'NQ', entryDatetime: `${today}T09:10:00Z`, status: 'closed', pnlNet: -10 },
    { id: ids[2], accountId: 'account-1', symbol: 'YM', entryDatetime: `${today}T09:20:00Z`, status: 'closed', pnlNet: 0 },
    { id: ids[3], accountId: 'account-1', symbol: 'RTY', entryDatetime: `${today}T09:30:00Z`, status: 'open', pnlNet: null },
  ],
};
const successList = { entries: [entry], pagination: { page: 1, limit: 25, total: 1, totalPages: 1 } };
const recentTrades = { data: entry.trades, pagination: { page: 1, limit: 20, total: 4, totalPages: 1 } };

function setSuccess() {
  apiMocks.list.mockResolvedValue(successList);
  apiMocks.calendar.mockResolvedValue({ month: currentMonth, days: [{ date: today, total: 1, complete: 0, incomplete: 1, entryTypes: ['trade_review'] }] });
  apiMocks.create.mockResolvedValue(entry);
  apiMocks.update.mockResolvedValue({ ...entry, title: 'Updated review' });
  apiMocks.remove.mockResolvedValue({ deleted: true, id: entry.id });
  apiMocks.trades.mockResolvedValue(recentTrades);
  apiMocks.accounts.mockResolvedValue([{ id: 'account-1', company: 'broker', accountNumber: 'A1', accountName: 'Primary' }]);
}

function renderJournal(initialEntry = '/insights/journal') {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 }, mutations: { retry: false } } });
  const metadata = resolveRouteMetadata('/insights/journal');
  const result = render(
    <QueryClientProvider client={client}>
      <ToastProvider>
        <MemoryRouter initialEntries={[initialEntry]}>
          <HeaderControlsProvider metadata={metadata}>
            <Header metadata={metadata} />
            <main><Journal /></main>
          </HeaderControlsProvider>
        </MemoryRouter>
      </ToastProvider>
    </QueryClientProvider>,
  );
  return { ...result, client };
}

describe('Journal timeline and filters', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setSuccess();
  });

  it('shows the initial timeline skeleton', () => {
    apiMocks.list.mockReturnValue(new Promise(() => {}));
    renderJournal();
    expect(screen.getByLabelText('Loading journal timeline')).toBeInTheDocument();
  });

  it('renders real plain-text entries, conditional tags, trade links, and every PnL state', async () => {
    renderJournal();
    expect(await screen.findByText('Opening range review')).toBeInTheDocument();
    expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1);
    expect(screen.getByText((_, element) => element.tagName === 'P' && element.textContent.includes('<img src=x onerror=alert(1)>'))).toBeInTheDocument();
    expect(document.querySelector('img')).not.toBeInTheDocument();
    expect(screen.getByText('Process')).toBeInTheDocument();
    for (const symbol of ['ES', 'NQ', 'YM', 'RTY']) {
      expect(screen.getByRole('link', { name: new RegExp(symbol) })).toHaveAttribute('href', expect.stringContaining('/trades/'));
    }
    expect(screen.getByText(/\+\$25\.00/)).toBeInTheDocument();
    expect(screen.getByText(/-\$10\.00/)).toBeInTheDocument();
    expect(screen.getByText(/\$0\.00/)).toBeInTheDocument();
    expect(screen.getByText('—')).toBeInTheDocument();
    expect(screen.queryByLabelText(/Account filter/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/screenshot|upload file/i)).not.toBeInTheDocument();
  });

  it('shows truthful no-entry and filtered-empty states and clears filters', async () => {
    apiMocks.list.mockResolvedValue({ entries: [], pagination: { page: 1, limit: 25, total: 0, totalPages: 0 } });
    const { rerender } = renderJournal();
    expect(await screen.findByRole('heading', { name: 'No journal entries yet' })).toBeInTheDocument();
    expect(screen.getAllByRole('button', { name: 'New Entry' })).toHaveLength(1);

    await userEvent.type(screen.getByRole('searchbox', { name: 'Search journal entries' }), 'missing');
    expect(await screen.findByRole('heading', { name: 'No entries match the current filters' })).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Clear filters' }));
    expect(screen.getByRole('searchbox', { name: 'Search journal entries' })).toHaveValue('');
    rerender;
  });

  it('sends search, type, completion, and date-only filters without an account scope', async () => {
    renderJournal();
    await screen.findByText('Opening range review');
    await userEvent.type(screen.getByRole('searchbox', { name: 'Search journal entries' }), 'plan');
    await userEvent.selectOptions(screen.getByLabelText('Entry type'), 'daily_review');
    await userEvent.selectOptions(screen.getByLabelText('Completion status'), 'complete');
    fireEvent.change(screen.getByLabelText('From date'), { target: { value: '2026-08-01' } });
    fireEvent.change(screen.getByLabelText('To date'), { target: { value: '2026-08-04' } });
    await waitFor(() => expect(apiMocks.list).toHaveBeenLastCalledWith(expect.objectContaining({
      search: 'plan', type: 'daily_review', status: 'complete', from: '2026-08-01', to: '2026-08-04', page: 1, limit: 25,
    })));
    expect(apiMocks.list.mock.calls.at(-1)[0]).not.toHaveProperty('accountId');
  });

  it('rejects reversed date ranges without issuing a reversed request', async () => {
    renderJournal();
    await screen.findByText('Opening range review');
    const before = apiMocks.list.mock.calls.length;
    fireEvent.change(screen.getByLabelText('From date'), { target: { value: '2026-08-04' } });
    fireEvent.change(screen.getByLabelText('To date'), { target: { value: '2026-08-01' } });
    expect(screen.getByRole('alert')).toHaveTextContent('Date range is invalid');
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(apiMocks.list.mock.calls.slice(before).some(([params]) => params.from === '2026-08-04' && params.to === '2026-08-01')).toBe(false);
  });

  it('preserves filters in pagination and keeps stale content during refresh', async () => {
    let resolveSearch;
    apiMocks.list.mockImplementation((params) => params.search === 'wait'
      ? new Promise((resolve) => { resolveSearch = resolve; })
      : Promise.resolve({ ...successList, pagination: { ...successList.pagination, total: 30, totalPages: 2 } }));
    renderJournal();
    expect(await screen.findByText('Opening range review')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Next' }));
    await waitFor(() => expect(apiMocks.list).toHaveBeenCalledWith(expect.objectContaining({ page: 2, status: 'all', limit: 25 })));
    await userEvent.type(screen.getByRole('searchbox', { name: 'Search journal entries' }), 'wait');
    expect(await screen.findByText('Refreshing timeline…')).toBeInTheDocument();
    expect(screen.getByText('Opening range review')).toBeInTheDocument();
    resolveSearch(successList);
  });

  it('shows a retryable full timeline error', async () => {
    apiMocks.list.mockRejectedValue(new Error('failed'));
    renderJournal();
    expect(await screen.findByText('Journal entries could not be loaded')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Try again' })).toBeInTheDocument();
  });
});

describe('Journal calendar', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setSuccess();
  });

  it('loads real counts, selects a day, navigates months, and returns to today', async () => {
    renderJournal();
    await userEvent.click(screen.getByRole('button', { name: 'Calendar' }));
    expect(await screen.findByRole('grid', { name: new RegExp('Journal entries for') })).toBeInTheDocument();
    const day = screen.getByRole('gridcell', { name: new RegExp(`${Number(today.slice(-2))}.*1 entry`) });
    await userEvent.click(day);
    await waitFor(() => expect(apiMocks.list).toHaveBeenCalledWith({ from: today, to: today, status: 'all', page: 1, limit: 100 }));
    expect(screen.getAllByText('Opening range review').length).toBeGreaterThan(0);

    await userEvent.click(screen.getByRole('button', { name: 'Next month' }));
    await waitFor(() => expect(apiMocks.calendar).toHaveBeenCalledWith(addMonthsToKey(currentMonth, 1)));
    await userEvent.click(screen.getByRole('button', { name: 'Previous month' }));
    await userEvent.click(screen.getByRole('button', { name: 'Today' }));
    await waitFor(() => expect(apiMocks.calendar).toHaveBeenCalledWith(currentMonth));
  });

  it('distinguishes empty month and empty selected day', async () => {
    apiMocks.calendar.mockResolvedValue({ month: currentMonth, days: [] });
    apiMocks.list.mockImplementation((params) => params.from
      ? Promise.resolve({ entries: [], pagination: { page: 1, limit: 100, total: 0, totalPages: 0 } })
      : Promise.resolve(successList));
    renderJournal();
    await userEvent.click(screen.getByRole('button', { name: 'Calendar' }));
    expect(await screen.findByText('No journal entries this month')).toBeInTheDocument();
    expect(await screen.findByRole('heading', { name: 'No journal entries on this day' })).toBeInTheDocument();
  });

  it('shows calendar loading and isolated errors without removing timeline access', async () => {
    apiMocks.calendar.mockReturnValue(new Promise(() => {}));
    renderJournal();
    await userEvent.click(screen.getByRole('button', { name: 'Calendar' }));
    expect(screen.getByRole('status', { name: 'Loading journal calendar' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Timeline' })).toBeInTheDocument();
  });

  it('builds leap-month grids without date drift and retains logical RTL ordering', async () => {
    const grid = buildJournalCalendarGrid('2024-02', [{ date: '2024-02-29T00:00:00Z', total: 2, complete: 1, incomplete: 1, entryTypes: ['note'] }]);
    expect(grid.find((day) => day?.date === '2024-02-29')).toMatchObject({ total: 2 });
    expect(grid.filter(Boolean)).toHaveLength(29);
    document.documentElement.setAttribute('dir', 'rtl');
    renderJournal();
    await userEvent.click(screen.getByRole('button', { name: 'Calendar' }));
    const headers = within(await screen.findByRole('grid')).getAllByRole('columnheader');
    expect(headers.map((header) => header.textContent)).toEqual(['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']);
  });
});

describe('Journal create, edit, and delete', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setSuccess();
    vi.spyOn(window, 'confirm').mockReturnValue(true);
  });

  it('opens the real header form and validates required fields with stable type keys', async () => {
    renderJournal();
    const trigger = screen.getByRole('button', { name: 'New Entry' });
    expect(trigger.closest('header')).toBeInTheDocument();
    await userEvent.click(trigger);
    const dialog = screen.getByRole('dialog', { name: 'New journal entry' });
    const type = within(dialog).getByLabelText(/Entry type/);
    expect([...type.options].map((option) => option.value)).toEqual(['note', 'trade_review', 'daily_review', 'weekly_review']);
    await userEvent.clear(within(dialog).getByLabelText(/Title/));
    await userEvent.click(within(dialog).getByRole('button', { name: 'Create entry' }));
    expect(await within(dialog).findByText('Enter a title.')).toBeInTheDocument();
    expect(apiMocks.create).not.toHaveBeenCalled();
  });

  it('normalizes tags, preserves real trade selection, creates, invalidates, and closes', async () => {
    const { client } = renderJournal();
    const invalidate = vi.spyOn(client, 'invalidateQueries');
    await userEvent.click(screen.getByRole('button', { name: 'New Entry' }));
    const dialog = screen.getByRole('dialog', { name: 'New journal entry' });
    await userEvent.type(within(dialog).getByLabelText(/Title/), 'New note');
    await userEvent.type(within(dialog).getByLabelText(/Content/), 'Plain text');
    await userEvent.type(within(dialog).getByLabelText('Tags'), ' Process, process, Risk ');
    const tradeCheckbox = await within(dialog).findByRole('checkbox', { name: /ES.*closed/i });
    await userEvent.click(tradeCheckbox);
    await userEvent.click(within(dialog).getByRole('button', { name: 'Create entry' }));
    await waitFor(() => expect(apiMocks.create.mock.calls[0][0]).toEqual(expect.objectContaining({
      entryType: 'note', title: 'New note', content: 'Plain text', tags: ['Process', 'Risk'], tradeIds: [ids[0]],
    })));
    await waitFor(() => expect(screen.queryByRole('dialog', { name: 'New journal entry' })).not.toBeInTheDocument());
    expect(invalidate).toHaveBeenCalledWith({ queryKey: ['journal'] });
    expect(await screen.findByText('Journal entry created.')).toBeInTheDocument();
  });

  it('opens from the command query, pre-populates edit values, and updates the owned ID', async () => {
    renderJournal('/insights/journal?new=1');
    expect(await screen.findByRole('dialog', { name: 'New journal entry' })).toBeInTheDocument();
    await userEvent.keyboard('{Escape}');
    expect(await screen.findByText('Opening range review')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Edit Opening range review' }));
    const dialog = screen.getByRole('dialog', { name: 'Edit journal entry' });
    expect(within(dialog).getByLabelText(/Title/)).toHaveValue('Opening range review');
    expect(within(dialog).getByLabelText(/Content/)).toHaveValue(entry.content);
    await userEvent.clear(within(dialog).getByLabelText(/Title/));
    await userEvent.type(within(dialog).getByLabelText(/Title/), 'Updated review');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Save changes' }));
    await waitFor(() => expect(apiMocks.update).toHaveBeenCalledWith(entry.id, expect.objectContaining({
      title: 'Updated review', tradeIds: ids,
    })));
  });

  it('confirms deletion and leaves the entry visible on failure', async () => {
    apiMocks.remove.mockRejectedValue(new Error('failed'));
    renderJournal();
    expect(await screen.findByText('Opening range review')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Delete Opening range review' }));
    expect(window.confirm).toHaveBeenCalledWith('Delete “Opening range review”?');
    await waitFor(() => expect(apiMocks.remove.mock.calls[0][0]).toBe(entry.id));
    expect(screen.getByText('Opening range review')).toBeInTheDocument();
    expect(await screen.findByText('Journal entry could not be deleted.')).toBeInTheDocument();
  });

  it('closes on Escape and restores focus to New Entry', async () => {
    renderJournal();
    const trigger = screen.getByRole('button', { name: 'New Entry' });
    await userEvent.click(trigger);
    expect(screen.getByRole('dialog', { name: 'New journal entry' })).toBeInTheDocument();
    await userEvent.keyboard('{Escape}');
    expect(screen.queryByRole('dialog', { name: 'New journal entry' })).not.toBeInTheDocument();
    expect(trigger).toHaveFocus();
  });
});
