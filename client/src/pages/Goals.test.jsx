import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ToastProvider } from '../components/ui/Toast.jsx';

vi.mock('../context/AuthContext.jsx', async (importOriginal) => ({
  ...(await importOriginal()),
  useAuth: () => ({ user: { email: 'goal.user@example.com' }, logout: vi.fn() }),
}));

vi.mock('../api/goals.js', () => ({
  goalsApi: {
    list: vi.fn(), get: vi.fn(), create: vi.fn(), update: vi.fn(), remove: vi.fn(),
  },
}));

import { goalsApi } from '../api/goals.js';
import { AppShell } from '../components/layout/AppShell.jsx';
import Goals from './Goals.jsx';

const base = {
  description: null,
  comparison: 'at_least',
  startDate: '2026-08-01',
  endDate: '2026-08-31',
  status: 'active',
  hasData: true,
  targetSatisfied: false,
  differenceToTarget: -1,
  sourceDataCount: 1,
  unavailableReason: null,
  createdAt: '2026-08-01T00:00:00Z',
  updatedAt: '2026-08-01T00:00:00Z',
};

const goals = [
  { ...base, id: 'goal-pnl', name: 'PnL target', description: 'Use real closed trades.', metricKey: 'net_pnl', unit: 'currency', targetValue: 1000, currentValue: 1500, progressPercent: 150, differenceToTarget: 500, targetSatisfied: true, derivedState: 'achieved' },
  { ...base, id: 'goal-count', name: 'Trade cadence', metricKey: 'closed_trades', unit: 'count', targetValue: 10, currentValue: 0, progressPercent: 0, differenceToTarget: -10, derivedState: 'in_progress', sourceDataCount: 0 },
  { ...base, id: 'goal-win', name: 'Win rate target', metricKey: 'win_rate', unit: 'percent', targetValue: 60, currentValue: 50, progressPercent: 83.3, differenceToTarget: -10, derivedState: 'upcoming', startDate: '2026-09-01', endDate: '2026-09-30' },
  { ...base, id: 'goal-r', name: 'R quality', metricKey: 'average_r', unit: 'r_multiple', targetValue: 1.5, currentValue: null, progressPercent: null, differenceToTarget: null, derivedState: 'in_progress', hasData: false, sourceDataCount: 0, unavailableReason: 'no_r_data' },
  { ...base, id: 'goal-adherence', name: 'Process consistency', metricKey: 'rule_adherence', unit: 'percent', targetValue: 80, currentValue: 50, progressPercent: 62.5, differenceToTarget: -30, derivedState: 'missed', endDate: '2026-08-02' },
  { ...base, id: 'goal-journal', name: 'Review habit', metricKey: 'journal_entries', unit: 'count', targetValue: 5, currentValue: 2, progressPercent: 40, differenceToTarget: -3, derivedState: 'paused', status: 'paused' },
  { ...base, id: 'goal-broken', name: 'Protect discipline', metricKey: 'broken_rule_checks', comparison: 'at_most', unit: 'count', targetValue: 2, currentValue: 1, progressPercent: null, differenceToTarget: -1, targetSatisfied: true, derivedState: 'archived', status: 'archived' },
];

const summary = { total: 7, active: 5, paused: 1, archived: 1, upcoming: 1, inProgress: 2, achieved: 1, missed: 1 };
const response = { goals, summary };

function renderGoals(initialEntry = '/insights/goals') {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  const view = render(
    <MemoryRouter initialEntries={[initialEntry]}>
      <QueryClientProvider client={queryClient}>
        <ToastProvider>
          <AppShell><Goals /></AppShell>
        </ToastProvider>
      </QueryClientProvider>
    </MemoryRouter>,
  );
  return { ...view, queryClient };
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.restoreAllMocks();
  document.documentElement.dir = 'ltr';
  goalsApi.list.mockResolvedValue(response);
  goalsApi.create.mockResolvedValue({ goal: goals[0] });
  goalsApi.update.mockResolvedValue({ goal: goals[0] });
  goalsApi.remove.mockResolvedValue({ deleted: true, id: goals[0].id });
});

describe('Goals page', () => {
  it('renders one shell H1, real summary counts, real states, and no unsupported controls', async () => {
    renderGoals();
    expect(await screen.findByRole('heading', { level: 1, name: 'Goals' })).toBeInTheDocument();
    await screen.findByRole('heading', { name: 'PnL target' });
    expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1);
    const summaryRegion = screen.getByRole('heading', { name: 'Goals summary', hidden: true }).parentElement;
    expect(within(summaryRegion).getByText('5')).toBeInTheDocument();
    for (const state of ['Achieved', 'Missed', 'Upcoming', 'Paused', 'Archived', 'In progress']) {
      expect(screen.getAllByText(state).length).toBeGreaterThan(0);
    }
    expect(screen.queryByLabelText(/account/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/manual progress|AI advice|Notifications/i)).not.toBeInTheDocument();
  });

  it('formats currency, count, percentage, R target, neutral zero, and unavailable values truthfully', async () => {
    renderGoals();
    const pnlCard = (await screen.findByRole('heading', { name: 'PnL target' })).closest('article');
    expect(pnlCard.textContent).toContain('$1,500.00');
    const countCard = screen.getByRole('heading', { name: 'Trade cadence' }).closest('article');
    expect(countCard.querySelector('dd')).toHaveClass('text-primary');
    expect(countCard.querySelector('dd').textContent).toContain('0');
    const winCard = screen.getByRole('heading', { name: 'Win rate target' }).closest('article');
    expect(winCard.textContent).toContain('50%');
    const rCard = screen.getByRole('heading', { name: 'R quality' }).closest('article');
    expect(rCard.textContent).toContain('+1.50R');
    expect(within(rCard).getByText('—')).toBeInTheDocument();
    expect(within(rCard).getByText('No trades with R data in this goal period.')).toBeInTheDocument();
  });

  it('keeps Net PnL unavailable and neutral when no closed trades qualify', async () => {
    const unavailablePnl = {
      ...goals[0],
      id: 'goal-pnl-empty',
      name: 'No-trade PnL target',
      currentValue: null,
      hasData: false,
      sourceDataCount: 0,
      progressPercent: null,
      differenceToTarget: null,
      targetSatisfied: false,
      derivedState: 'in_progress',
      unavailableReason: 'no_closed_trades',
    };
    goalsApi.list.mockResolvedValueOnce({ goals: [unavailablePnl], summary: { ...summary, total: 1 } });
    renderGoals();
    const card = (await screen.findByRole('heading', { name: 'No-trade PnL target' })).closest('article');
    const current = card.querySelector('dd');
    expect(current).toHaveTextContent('—');
    expect(current).toHaveClass('text-muted');
    expect(current).not.toHaveClass('text-negative');
    expect(within(card).getByText('No closed trades in this goal period.')).toBeInTheDocument();
  });

  it('renders accessible capped at-least progress and no at-most progress bar', async () => {
    renderGoals();
    const pnlCard = (await screen.findByRole('heading', { name: 'PnL target' })).closest('article');
    const progress = within(pnlCard).getByRole('progressbar');
    expect(progress).toHaveAttribute('aria-valuenow', '100');
    expect(progress).toHaveAccessibleName(/current.*target.*100% displayed.*Achieved/i);
    const atMostCard = screen.getByRole('heading', { name: 'Protect discipline' }).closest('article');
    expect(within(atMostCard).queryByRole('progressbar')).not.toBeInTheDocument();
    expect(within(atMostCard).getByText(/Remaining allowance/)).toBeInTheDocument();
  });

  it('shows initial loading, keeps stale content during refresh, and handles full errors', async () => {
    let resolveFirst;
    goalsApi.list.mockReturnValueOnce(new Promise((resolve) => { resolveFirst = resolve; }));
    const { unmount } = renderGoals();
    expect(screen.getByLabelText('Loading Goals summary')).toBeInTheDocument();
    resolveFirst(response);
    expect(await screen.findByRole('heading', { name: 'PnL target' })).toBeInTheDocument();
    goalsApi.list.mockReturnValueOnce(new Promise(() => {}));
    await userEvent.selectOptions(screen.getByLabelText('Goal status'), 'active');
    expect(screen.getByRole('heading', { name: 'PnL target' })).toBeInTheDocument();
    expect(screen.getByText('Refreshing Goals…')).toBeInTheDocument();
    unmount();

    goalsApi.list.mockRejectedValueOnce(new Error('failed'));
    renderGoals();
    expect(await screen.findByText('Goals could not be loaded')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Try again' })).toBeInTheDocument();
  });

  it('shows truthful no-goals and filtered-empty states with a real clear action', async () => {
    goalsApi.list.mockResolvedValueOnce({ goals: [], summary: { total: 0, active: 0, paused: 0, archived: 0, upcoming: 0, inProgress: 0, achieved: 0, missed: 0 } });
    const { unmount } = renderGoals();
    expect(await screen.findByText('No goals yet')).toBeInTheDocument();
    expect(screen.getByText('Create a measurable goal to begin tracking progress from your trading activity.')).toBeInTheDocument();
    unmount();

    goalsApi.list.mockResolvedValue({ goals: [], summary: { total: 0, active: 0, paused: 0, archived: 0, upcoming: 0, inProgress: 0, achieved: 0, missed: 0 } });
    renderGoals();
    await userEvent.type(screen.getByPlaceholderText('Search goals'), 'missing');
    expect(await screen.findByText('No goals match the current filters')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Clear filters' }));
    expect(screen.getByPlaceholderText('Search goals')).toHaveValue('');
  });

  it('sends stored status, metric, and search filters as stable query parameters', async () => {
    renderGoals();
    await screen.findByRole('heading', { name: 'PnL target' });
    await userEvent.selectOptions(screen.getByLabelText('Goal status'), 'paused');
    await userEvent.selectOptions(screen.getByLabelText('Goal metric'), 'average_r');
    await userEvent.type(screen.getByPlaceholderText('Search goals'), 'quality');
    await waitFor(() => expect(goalsApi.list).toHaveBeenLastCalledWith({ status: 'paused', metric: 'average_r', search: 'quality' }));
  });

  it('opens New Goal from the real header command query and restores focus on Escape', async () => {
    renderGoals('/insights/goals?action=new-goal');
    expect(await screen.findByRole('dialog', { name: 'New goal' })).toBeInTheDocument();
    await userEvent.keyboard('{Escape}');
    expect(screen.queryByRole('dialog', { name: 'New goal' })).not.toBeInTheDocument();

    const trigger = await screen.findByRole('button', { name: 'New Goal' });
    trigger.focus();
    await userEvent.click(trigger);
    expect(screen.getByRole('dialog', { name: 'New goal' })).toBeInTheDocument();
    await userEvent.keyboard('{Escape}');
    expect(trigger).toHaveFocus();
  });

  it('derives comparison and validation from metric and creates the exact stable payload', async () => {
    renderGoals();
    await userEvent.click(await screen.findByRole('button', { name: 'New Goal' }));
    const dialog = screen.getByRole('dialog', { name: 'New goal' });
    await userEvent.click(within(dialog).getByRole('button', { name: 'Create goal' }));
    expect(within(dialog).getByText('Enter a goal name.')).toBeInTheDocument();
    expect(within(dialog).getByText('Enter a target value.')).toBeInTheDocument();

    await userEvent.type(within(dialog).getByLabelText(/Goal name/), 'Protect discipline');
    await userEvent.selectOptions(within(dialog).getByLabelText(/Metric/), 'broken_rule_checks');
    expect(within(dialog).getByText('At most')).toBeInTheDocument();
    const target = within(dialog).getByLabelText(/Target \(count\)/);
    await userEvent.type(target, '2.5');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Create goal' }));
    expect(within(dialog).getByText('Count targets must be whole numbers.')).toBeInTheDocument();
    await userEvent.clear(target);
    await userEvent.type(target, '2');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Create goal' }));
    await waitFor(() => expect(goalsApi.create).toHaveBeenCalled());
    expect(goalsApi.create.mock.calls[0][0]).toEqual(expect.objectContaining({
      name: 'Protect discipline', metricKey: 'broken_rule_checks', comparison: 'at_most', targetValue: 2, status: 'active',
    }));
  });

  it('enforces percentage bounds and reversed dates without silently swapping them', async () => {
    renderGoals();
    await userEvent.click(await screen.findByRole('button', { name: 'New Goal' }));
    const dialog = screen.getByRole('dialog', { name: 'New goal' });
    await userEvent.type(within(dialog).getByLabelText(/Goal name/), 'Win quality');
    await userEvent.selectOptions(within(dialog).getByLabelText(/Metric/), 'win_rate');
    await userEvent.type(within(dialog).getByLabelText(/Target \(%\)/), '101');
    fireEvent.change(within(dialog).getByLabelText(/Start date/), { target: { value: '2026-09-02' } });
    fireEvent.change(within(dialog).getByLabelText(/End date/), { target: { value: '2026-09-01' } });
    await userEvent.click(within(dialog).getByRole('button', { name: 'Create goal' }));
    expect(within(dialog).getByText(/Enter a value from 0 to 100/)).toBeInTheDocument();
    expect(within(dialog).getByText('End date must not precede start date.')).toBeInTheDocument();
    expect(goalsApi.create).not.toHaveBeenCalled();
  });

  it('pre-populates edit, clears an invalid target on metric change, and updates real fields', async () => {
    renderGoals();
    const card = (await screen.findByRole('heading', { name: 'PnL target' })).closest('article');
    await userEvent.click(within(card).getByRole('button', { name: 'Edit' }));
    const dialog = screen.getByRole('dialog', { name: 'Edit goal' });
    expect(within(dialog).getByLabelText(/Goal name/)).toHaveValue('PnL target');
    expect(within(dialog).getByLabelText(/Target \(USD\)/)).toHaveValue(1000);
    await userEvent.selectOptions(within(dialog).getByLabelText(/Metric/), 'journal_entries');
    expect(within(dialog).getByText('At least')).toBeInTheDocument();
    expect(within(dialog).getByLabelText(/Target \(count\)/)).toHaveValue(null);
    await userEvent.type(within(dialog).getByLabelText(/Target \(count\)/), '8');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Save goal' }));
    await waitFor(() => expect(goalsApi.update).toHaveBeenCalledWith('goal-pnl', expect.objectContaining({ metricKey: 'journal_entries', comparison: 'at_least', targetValue: 8 })));
  });

  it('pauses, resumes, archives, restores, and invalidates Goals queries', async () => {
    const { queryClient } = renderGoals();
    const invalidate = vi.spyOn(queryClient, 'invalidateQueries');
    await userEvent.click(within((await screen.findByRole('heading', { name: 'Trade cadence' })).closest('article')).getByRole('button', { name: 'Pause' }));
    await waitFor(() => expect(goalsApi.update).toHaveBeenCalledWith('goal-count', { status: 'paused' }));
    await userEvent.click(within(screen.getByRole('heading', { name: 'Review habit' }).closest('article')).getByRole('button', { name: 'Resume' }));
    await userEvent.click(within(screen.getByRole('heading', { name: 'Win rate target' }).closest('article')).getByRole('button', { name: 'Archive' }));
    await userEvent.click(within(screen.getByRole('heading', { name: 'Protect discipline' }).closest('article')).getByRole('button', { name: 'Restore' }));
    await waitFor(() => {
      expect(goalsApi.update).toHaveBeenCalledWith('goal-journal', { status: 'active' });
      expect(goalsApi.update).toHaveBeenCalledWith('goal-win', { status: 'archived' });
      expect(goalsApi.update).toHaveBeenCalledWith('goal-broken', { status: 'active' });
      expect(invalidate).toHaveBeenCalledWith({ queryKey: ['goals'] });
    });
  });

  it('confirms deletion, preserves the goal on failure, and invalidates after success', async () => {
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    goalsApi.remove.mockRejectedValueOnce(new Error('failed')).mockResolvedValueOnce({ deleted: true, id: 'goal-pnl' });
    const { queryClient } = renderGoals();
    const invalidate = vi.spyOn(queryClient, 'invalidateQueries');
    const card = (await screen.findByRole('heading', { name: 'PnL target' })).closest('article');
    await userEvent.click(within(card).getByRole('button', { name: 'Delete' }));
    expect(await screen.findByText('Goal could not be deleted. It remains available.')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'PnL target' })).toBeInTheDocument();
    await userEvent.click(within(card).getByRole('button', { name: 'Delete' }));
    await waitFor(() => expect(invalidate).toHaveBeenCalledWith({ queryKey: ['goals'] }));
  });

  it('keeps dates and numeric values LTR-safe in RTL and exposes text with every state', async () => {
    document.documentElement.dir = 'rtl';
    renderGoals();
    const card = (await screen.findByRole('heading', { name: 'PnL target' })).closest('article');
    expect(within(card).getAllByText(/Aug/).every((node) => node.closest('[dir="ltr"]'))).toBe(true);
    expect(within(card).getByText(/Achieved/)).toBeInTheDocument();
    expect(within(card).getByRole('progressbar')).toHaveAccessibleName(/current.*target/i);
    expect(screen.queryByLabelText(/manual progress/i)).not.toBeInTheDocument();
  });
});
