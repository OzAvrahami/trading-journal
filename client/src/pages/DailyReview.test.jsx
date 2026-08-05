import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ToastProvider } from '../components/ui/Toast.jsx';

vi.mock('../context/AuthContext.jsx', async (importOriginal) => ({
  ...(await importOriginal()),
  useAuth: () => ({ user: { email: 'review@example.com', timezone: 'Asia/Jerusalem' }, logout: vi.fn() }),
}));
vi.mock('../api/analytics.js', () => ({ analyticsApi: { daySummary: vi.fn() } }));
vi.mock('../api/accounts.js', () => ({ accountsApi: { list: vi.fn() } }));
vi.mock('../api/dailyReview.js', () => ({ dailyReviewApi: { get: vi.fn(), save: vi.fn() } }));
vi.mock('../api/rules.js', () => ({ rulesApi: { list: vi.fn(), listChecks: vi.fn(), adherence: vi.fn(), createCheck: vi.fn() } }));
vi.mock('../api/trades.js', () => ({ tradesApi: { list: vi.fn() } }));

import { analyticsApi } from '../api/analytics.js';
import { accountsApi } from '../api/accounts.js';
import { dailyReviewApi } from '../api/dailyReview.js';
import { rulesApi } from '../api/rules.js';
import { tradesApi } from '../api/trades.js';
import { AppShell } from '../components/layout/AppShell.jsx';
import DailyReview from './DailyReview.jsx';

const trade = { id: 'trade-1', accountId: 'account-1', symbol: 'NQ', direction: 'long', status: 'closed', entryDatetime: '2026-08-04T06:00:00Z', exitDatetime: '2026-08-04T06:20:00Z', pnlNet: 125, strategy: 'Momentum', setup: 'Pullback' };
const rule = { id: 'rule-1', name: 'Define risk', scope: 'trade', isActive: true };
const check = { id: 'check-1', ruleId: rule.id, outcome: 'followed', notes: 'Plan followed.', checkDate: '2026-08-04' };

function renderPage(path = '/daily-review/2026-08-04') {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  return { queryClient, ...render(
    <MemoryRouter initialEntries={[path]}>
      <QueryClientProvider client={queryClient}><ToastProvider><Routes><Route path="/daily-review/:date" element={<AppShell><DailyReview /></AppShell>} /></Routes></ToastProvider></QueryClientProvider>
    </MemoryRouter>,
  ) };
}

beforeEach(() => {
  vi.clearAllMocks();
  document.documentElement.dir = 'ltr';
  analyticsApi.daySummary.mockResolvedValue({ date: '2026-08-04', timezone: 'Asia/Jerusalem', closedTrades: 1, openTrades: 0, winners: 1, losers: 0, breakeven: 0, pnlNet: 125, totalFees: 4, winRate: 100, bestTrade: { ...trade }, worstTrade: { ...trade } });
  accountsApi.list.mockResolvedValue([{ id: 'account-1', accountName: 'Demo account' }]);
  tradesApi.list.mockResolvedValue({ data: [trade], pagination: { page: 1, limit: 100, total: 1, totalPages: 1 } });
  rulesApi.list.mockResolvedValue({ rules: [rule] });
  rulesApi.listChecks.mockResolvedValue({ checks: [check, { ...check, id: 'check-2', outcome: 'not_applicable' }], pagination: { total: 2 } });
  rulesApi.adherence.mockResolvedValue({ summary: { adherenceRate: 100 } });
  rulesApi.createCheck.mockResolvedValue({ check });
  dailyReviewApi.get.mockResolvedValue({ date: '2026-08-04', timezone: 'Asia/Jerusalem', review: null });
  dailyReviewApi.save.mockResolvedValue({ date: '2026-08-04', timezone: 'Asia/Jerusalem', review: { id: 'journal-1', content: 'Notes', wentWell: null, improve: null, nextSessionPlan: null, emotions: [], mistakes: [], isComplete: false } });
});

describe('Daily Review page composition', () => {
  it('renders one H1, timezone, real metrics, trade links, and multiple Rule checks', async () => {
    renderPage();
    expect(await screen.findByRole('heading', { level: 1, name: 'Daily Review' })).toBeInTheDocument();
    await screen.findByText('Define risk');
    expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1);
    expect(screen.getByText(/Calendar timezone:/)).toHaveTextContent('Asia/Jerusalem');
    expect(document.body.textContent).toContain('$125.00');
    expect(screen.getAllByText('100.0%')).toHaveLength(2);
    expect(screen.getAllByRole('link', { name: /NQ/ })[0]).toHaveAttribute('href', '/trades/trade-1');
    expect(screen.getByText('Latest of 2 checks')).toBeInTheDocument();
    expect(screen.getAllByText(/Not applicable/).length).toBeGreaterThan(0);
  });

  it('requests the exact selected date for summary, trades, checks, and adherence', async () => {
    renderPage();
    await screen.findByText('Define risk');
    expect(analyticsApi.daySummary).toHaveBeenCalledWith('2026-08-04');
    expect(tradesApi.list).toHaveBeenCalledWith(expect.objectContaining({ from: '2026-08-04', to: '2026-08-04', limit: 100 }));
    expect(rulesApi.listChecks).toHaveBeenCalledWith(expect.objectContaining({ from: '2026-08-04', to: '2026-08-04' }));
    expect(rulesApi.adherence).toHaveBeenCalledWith({ from: '2026-08-04', to: '2026-08-04' });
  });

  it('renders unavailable metrics and no-trades state truthfully', async () => {
    analyticsApi.daySummary.mockResolvedValue({ closedTrades: 0, openTrades: 0, winners: 0, losers: 0, breakeven: 0, pnlNet: null, totalFees: 0, winRate: null, bestTrade: null, worstTrade: null });
    tradesApi.list.mockResolvedValue({ data: [], pagination: { total: 0 } });
    rulesApi.adherence.mockResolvedValue({ summary: { adherenceRate: null } });
    renderPage();
    expect(await screen.findByText('No trades on this date')).toBeInTheDocument();
    expect(screen.getAllByText('—').length).toBeGreaterThan(2);
  });

  it('keeps review editing available when Rules fail', async () => {
    rulesApi.list.mockRejectedValue(new Error('rules down'));
    renderPage();
    expect(await screen.findByText('Rules could not be loaded')).toBeInTheDocument();
    expect(screen.getByLabelText(/Session notes/)).toBeEnabled();
  });

  it('pre-fills Record Check with selected rule and exact date', async () => {
    const user = userEvent.setup();
    renderPage();
    await user.click(await screen.findByRole('button', { name: 'Record Check' }));
    const dialog = screen.getByRole('dialog', { name: 'Record Rule Check' });
    expect(within(dialog).getByRole('combobox', { name: /Rule/ })).toHaveValue('rule-1');
    expect(within(dialog).getByLabelText(/Check date/)).toHaveValue('2026-08-04');
  });

  it('saves the canonical payload and invalidates Journal queries', async () => {
    const user = userEvent.setup();
    const { queryClient } = renderPage();
    const invalidate = vi.spyOn(queryClient, 'invalidateQueries');
    await user.type(await screen.findByLabelText(/Session notes/), 'Notes');
    await user.click(screen.getByRole('button', { name: 'Save Daily Review' }));
    await waitFor(() => expect(dailyReviewApi.save).toHaveBeenCalledWith('2026-08-04', expect.objectContaining({ content: 'Notes', isComplete: false })));
    expect(invalidate).toHaveBeenCalledWith({ queryKey: ['daily-review', '2026-08-04'] });
    expect(invalidate).toHaveBeenCalledWith({ queryKey: ['journal'] });
  });

  it('preserves entered values when save fails', async () => {
    const user = userEvent.setup();
    dailyReviewApi.save.mockRejectedValue(new Error('save failed'));
    renderPage();
    const notes = await screen.findByLabelText(/Session notes/);
    await user.type(notes, 'Keep these notes');
    await user.click(screen.getByRole('button', { name: 'Save Daily Review' }));
    expect(await screen.findByText(/could not be saved/i)).toBeInTheDocument();
    expect(notes).toHaveValue('Keep these notes');
  });

  it('shows invalid route dates without issuing source requests', () => {
    renderPage('/daily-review/2026-02-30');
    expect(screen.getByText('Invalid Daily Review date')).toBeInTheDocument();
    expect(analyticsApi.daySummary).not.toHaveBeenCalled();
    expect(dailyReviewApi.get).not.toHaveBeenCalled();
  });

  it('does not render Goals, screenshots, AI, notifications, or account scope controls', async () => {
    renderPage();
    await screen.findByText('Define risk');
    expect(screen.queryByText(/AI observations|notifications|screenshots|Goals integration/i)).not.toBeInTheDocument();
    expect(screen.queryByLabelText(/account scope/i)).not.toBeInTheDocument();
  });
});
