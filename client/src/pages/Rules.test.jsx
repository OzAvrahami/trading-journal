import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const apiMocks = vi.hoisted(() => ({
  list: vi.fn(), get: vi.fn(), create: vi.fn(), update: vi.fn(), remove: vi.fn(),
  adherence: vi.fn(), listChecks: vi.fn(), createCheck: vi.fn(), updateCheck: vi.fn(), removeCheck: vi.fn(),
  trades: vi.fn(), journal: vi.fn(), accounts: vi.fn(),
}));

vi.mock('../api/rules.js', () => ({ rulesApi: {
  list: apiMocks.list,
  get: apiMocks.get,
  create: apiMocks.create,
  update: apiMocks.update,
  remove: apiMocks.remove,
  adherence: apiMocks.adherence,
  listChecks: apiMocks.listChecks,
  createCheck: apiMocks.createCheck,
  updateCheck: apiMocks.updateCheck,
  removeCheck: apiMocks.removeCheck,
} }));
vi.mock('../api/trades.js', () => ({ tradesApi: { list: apiMocks.trades } }));
vi.mock('../api/journal.js', () => ({ journalApi: { list: apiMocks.journal } }));
vi.mock('../api/accounts.js', () => ({ accountsApi: { list: apiMocks.accounts } }));

import Rules from './Rules.jsx';
import { Header } from '../components/layout/Header.jsx';
import { HeaderControlsProvider } from '../components/layout/HeaderControls.jsx';
import { ToastProvider } from '../components/ui/Toast.jsx';
import { resolveRouteMetadata } from '../routeMetadata.js';
import { formatDateKey, localTodayKey } from '../utils/dateOnly.js';

const ruleId = '11111111-1111-4111-8111-111111111111';
const inactiveRuleId = '22222222-2222-4222-8222-222222222222';
const checkIds = [
  '33333333-3333-4333-8333-333333333333',
  '44444444-4444-4444-8444-444444444444',
  '55555555-5555-4555-8555-555555555555',
];
const tradeId = '66666666-6666-4666-8666-666666666666';
const entryId = '77777777-7777-4777-8777-777777777777';
const today = localTodayKey();

const rules = [
  { id: ruleId, name: 'Wait for confirmation', description: 'Require a confirmed setup.', scope: 'trade', isActive: true, sortOrder: 0, checkCount: 3 },
  { id: inactiveRuleId, name: 'Prepare before the open', description: null, scope: 'daily', isActive: false, sortOrder: 1, checkCount: 1 },
];
const adherence = {
  summary: { activeRules: 1, totalChecks: 4, eligibleChecks: 3, followed: 2, broken: 1, notApplicable: 1, adherenceRate: 66.7 },
  rules: [
    { ruleId, name: rules[0].name, scope: 'trade', isActive: true, totalChecks: 3, eligibleChecks: 2, followed: 2, broken: 0, notApplicable: 1, adherenceRate: 100, lastCheckDate: today },
    { ruleId: inactiveRuleId, name: rules[1].name, scope: 'daily', isActive: false, totalChecks: 1, eligibleChecks: 1, followed: 0, broken: 1, notApplicable: 0, adherenceRate: 0, lastCheckDate: today },
  ],
};
const trade = { id: tradeId, accountId: 'account-1', symbol: 'ES', entryDatetime: `${today}T09:00:00Z`, exitDatetime: null, status: 'open', pnlNet: null, accountLabel: 'Primary' };
const journalEntry = { id: entryId, entryType: 'trade_review', entryDate: today, title: 'Opening review', isComplete: true };
const checks = [
  { id: checkIds[0], ruleId, checkDate: today, outcome: 'followed', notes: 'Waited for the signal.', rule: { id: ruleId, name: rules[0].name, scope: 'trade', isActive: true }, trade, journalEntry, createdAt: `${today}T10:00:00Z` },
  { id: checkIds[1], ruleId: inactiveRuleId, checkDate: today, outcome: 'broken', notes: null, rule: { id: inactiveRuleId, name: rules[1].name, scope: 'daily', isActive: false }, trade: null, journalEntry: null, createdAt: `${today}T09:00:00Z` },
  { id: checkIds[2], ruleId, checkDate: today, outcome: 'not_applicable', notes: null, rule: { id: ruleId, name: rules[0].name, scope: 'trade', isActive: true }, trade: null, journalEntry: null, createdAt: `${today}T08:00:00Z` },
];

function setSuccess() {
  apiMocks.list.mockResolvedValue({ rules });
  apiMocks.get.mockResolvedValue({ rule: rules[0] });
  apiMocks.create.mockResolvedValue({ rule: rules[0] });
  apiMocks.update.mockResolvedValue({ rule: rules[0] });
  apiMocks.remove.mockResolvedValue({ deleted: true, id: ruleId });
  apiMocks.adherence.mockResolvedValue(adherence);
  apiMocks.listChecks.mockResolvedValue({ checks, pagination: { page: 1, limit: 25, total: 3, totalPages: 1 } });
  apiMocks.createCheck.mockResolvedValue({ check: checks[0] });
  apiMocks.updateCheck.mockResolvedValue({ check: checks[0] });
  apiMocks.removeCheck.mockResolvedValue({ deleted: true, id: checkIds[0] });
  apiMocks.trades.mockResolvedValue({ data: [trade], pagination: { page: 1, limit: 20, total: 1, totalPages: 1 } });
  apiMocks.journal.mockResolvedValue({ entries: [journalEntry], pagination: { page: 1, limit: 20, total: 1, totalPages: 1 } });
  apiMocks.accounts.mockResolvedValue([{ id: 'account-1', company: 'broker', accountNumber: 'A1', accountName: 'Primary' }]);
}

function renderRules(initialEntry = '/insights/rules') {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 }, mutations: { retry: false } } });
  const metadata = resolveRouteMetadata('/insights/rules');
  const result = render(
    <QueryClientProvider client={client}>
      <ToastProvider>
        <MemoryRouter initialEntries={[initialEntry]}>
          <HeaderControlsProvider metadata={metadata}>
            <Header metadata={metadata} />
            <main><Rules /></main>
          </HeaderControlsProvider>
        </MemoryRouter>
      </ToastProvider>
    </QueryClientProvider>,
  );
  return { ...result, client };
}

describe('Rules & Adherence page', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    window.confirm = vi.fn(() => true);
    setSuccess();
  });

  it('renders one H1, MTD controls, real server summary, and no Goals content', async () => {
    renderRules();
    expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1);
    expect(screen.getByRole('heading', { level: 1, name: 'Rules & Adherence' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'MTD' })).toHaveAttribute('aria-pressed', 'true');
    expect(await screen.findByText('66.7%')).toHaveAttribute('dir', 'ltr');
    expect(screen.getByText('Eligible checks').nextElementSibling).toHaveTextContent('3');
    expect(screen.getByText('Followed', { selector: 'dt' }).nextElementSibling).toHaveTextContent('2');
    expect(screen.getByText('Broken', { selector: 'dt' }).nextElementSibling).toHaveTextContent('1');
    expect(screen.getByText('Not applicable', { selector: 'dt' }).nextElementSibling).toHaveTextContent('1');
    expect(screen.getByText('Active rules').nextElementSibling).toHaveTextContent('1');
    expect(screen.queryByText(/Goals/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/Discipline score/i)).not.toBeInTheDocument();
  });

  it('uses the server adherence value and renders null adherence as an em dash', async () => {
    apiMocks.adherence.mockResolvedValue({
      summary: { ...adherence.summary, eligibleChecks: 0, followed: 0, broken: 0, notApplicable: 4, adherenceRate: null },
      rules: [{ ...adherence.rules[0], eligibleChecks: 0, followed: 0, broken: 0, notApplicable: 4, adherenceRate: null }],
    });
    renderRules();
    expect(await screen.findByText('All checks in this period are not applicable, so they are excluded from the adherence denominator.')).toBeInTheDocument();
    expect(screen.getAllByText('—').length).toBeGreaterThan(0);
    expect(screen.queryByText('0.0%')).not.toBeInTheDocument();
  });

  it('renders per-rule history, distinct outcomes, notes, and truthful context links', async () => {
    renderRules();
    expect(await screen.findAllByText('Wait for confirmation')).not.toHaveLength(0);
    expect(screen.getByText('Waited for the signal.')).toBeInTheDocument();
    expect(screen.getAllByText('Followed').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Broken').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Not applicable').length).toBeGreaterThan(0);
    expect(screen.getByRole('link', { name: 'ES' })).toHaveAttribute('href', `/trades/${tradeId}`);
    expect(screen.getByRole('link', { name: 'Opening review' })).toHaveAttribute('href', '/insights/journal');
    expect(screen.getByText('ES')).toHaveAttribute('dir', 'ltr');
  });

  it('switches Today, WTD, MTD, and Custom into real API date parameters', async () => {
    renderRules();
    await screen.findByText('66.7%');
    await userEvent.click(screen.getByRole('button', { name: 'Today' }));
    await waitFor(() => expect(apiMocks.adherence).toHaveBeenLastCalledWith(expect.objectContaining({ from: today, to: today })));
    await userEvent.click(screen.getByRole('button', { name: 'WTD' }));
    await waitFor(() => expect(apiMocks.adherence).toHaveBeenLastCalledWith(expect.objectContaining({ to: today })));
    await userEvent.click(screen.getByRole('button', { name: 'Custom' }));
    expect(screen.getByLabelText('Start date')).toBeInTheDocument();
    expect(screen.getByLabelText('End date')).toBeInTheDocument();
  });

  it('validates and creates a real rule payload, invalidates data, closes, and restores focus', async () => {
    const { client } = renderRules();
    const invalidate = vi.spyOn(client, 'invalidateQueries');
    const trigger = screen.getByRole('button', { name: 'New Rule' });
    await userEvent.click(trigger);
    const dialog = screen.getByRole('dialog', { name: 'New trading rule' });
    await userEvent.click(within(dialog).getByRole('button', { name: 'Create rule' }));
    expect(await within(dialog).findByText('Enter a rule name.')).toBeInTheDocument();
    await userEvent.type(within(dialog).getByLabelText(/Rule name/), '  Respect the stop  ');
    await userEvent.type(within(dialog).getByLabelText('Description'), '  Exit when invalidated  ');
    await userEvent.selectOptions(within(dialog).getByLabelText(/Scope/), 'general');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Create rule' }));
    await waitFor(() => expect(apiMocks.create.mock.calls[0][0]).toEqual({ name: 'Respect the stop', description: 'Exit when invalidated', scope: 'general', isActive: true }));
    await waitFor(() => expect(screen.queryByRole('dialog', { name: 'New trading rule' })).not.toBeInTheDocument());
    expect(invalidate).toHaveBeenCalledWith({ queryKey: ['rules'] });
    expect(await screen.findByText('Trading rule created.')).toBeInTheDocument();
    expect(trigger).toHaveFocus();
  });

  it('opens New Rule and Record Check from truthful command query instructions', async () => {
    const first = renderRules('/insights/rules?action=new-rule');
    expect(await screen.findByRole('dialog', { name: 'New trading rule' })).toBeInTheDocument();
    first.unmount();
    renderRules('/insights/rules?action=record-check');
    expect(await screen.findByRole('dialog', { name: 'Record rule check' })).toBeInTheDocument();
  });

  it('records followed, broken, or not-applicable via accessible radios with real context IDs', async () => {
    renderRules();
    await userEvent.click(screen.getByRole('button', { name: 'Record Check' }));
    const dialog = screen.getByRole('dialog', { name: 'Record rule check' });
    await userEvent.selectOptions(within(dialog).getByLabelText(/Rule/), ruleId);
    const followed = within(dialog).getByRole('radio', { name: 'Followed' });
    await userEvent.click(followed);
    expect(followed).toBeChecked();
    const tradeOption = await within(dialog).findByRole('radio', { name: /ES.*open/i });
    await userEvent.click(tradeOption);
    const journalOption = await within(dialog).findByRole('radio', { name: /Opening review.*trade review/i });
    await userEvent.click(journalOption);
    await userEvent.type(within(dialog).getByLabelText('Notes'), '  Followed the plan  ');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Record check' }));
    await waitFor(() => expect(apiMocks.createCheck.mock.calls[0][0]).toEqual({
      ruleId,
      checkDate: today,
      outcome: 'followed',
      notes: 'Followed the plan',
      tradeId,
      journalEntryId: entryId,
    }));
    expect(await screen.findByText('Rule check recorded.')).toBeInTheDocument();
  });

  it('requires rule, date, and outcome in the check form and normalizes optional notes', async () => {
    renderRules();
    await userEvent.click(screen.getByRole('button', { name: 'Record Check' }));
    const dialog = screen.getByRole('dialog', { name: 'Record rule check' });
    await userEvent.clear(within(dialog).getByLabelText(/Check date/));
    await userEvent.click(within(dialog).getByRole('button', { name: 'Record check' }));
    expect(await within(dialog).findByText('Choose a rule.')).toBeInTheDocument();
    expect(within(dialog).getByText('Choose a check date.')).toBeInTheDocument();
    expect(within(dialog).getByText('Choose an outcome.')).toBeInTheDocument();
    expect(apiMocks.createCheck).not.toHaveBeenCalled();
  });

  it('pre-populates and updates an existing historical check including inactive rule', async () => {
    renderRules();
    expect(await screen.findByText('Waited for the signal.')).toBeInTheDocument();
    const card = screen.getByText('Waited for the signal.').closest('section');
    await userEvent.click(within(card).getByRole('button', { name: 'Edit' }));
    const dialog = screen.getByRole('dialog', { name: 'Edit rule check' });
    expect(within(dialog).getByLabelText(/Rule/)).toHaveValue(ruleId);
    expect(within(dialog).getByRole('radio', { name: 'Followed' })).toBeChecked();
    await userEvent.click(within(dialog).getByRole('radio', { name: 'Broken' }));
    await userEvent.click(within(dialog).getByRole('button', { name: 'Save check' }));
    await waitFor(() => expect(apiMocks.updateCheck).toHaveBeenCalledWith(checkIds[0], expect.objectContaining({ outcome: 'broken', tradeId, journalEntryId: entryId })));
  });

  it('filters rule management, edits, deactivates, and preserves a rule on delete conflict', async () => {
    apiMocks.remove.mockRejectedValue({ response: { data: { error: { code: 'RULE_HAS_CHECKS' } } } });
    renderRules();
    await userEvent.click(screen.getByRole('tab', { name: 'Rules' }));
    expect(await screen.findByText('Require a confirmed setup.')).toBeInTheDocument();
    await userEvent.selectOptions(screen.getByLabelText('Rule status'), 'inactive');
    await waitFor(() => expect(apiMocks.list).toHaveBeenCalledWith(expect.objectContaining({ status: 'inactive' })));
    await userEvent.selectOptions(screen.getByLabelText('Rule status'), 'all');
    const ruleCard = screen.getByText('Require a confirmed setup.').closest('section');
    await userEvent.click(within(ruleCard).getByRole('button', { name: 'Edit' }));
    expect(screen.getByRole('dialog', { name: 'Edit trading rule' })).toBeInTheDocument();
    await userEvent.keyboard('{Escape}');
    await userEvent.click(within(ruleCard).getByRole('button', { name: 'Deactivate' }));
    await waitFor(() => expect(apiMocks.update).toHaveBeenCalledWith(ruleId, { isActive: false }));
    await userEvent.click(within(ruleCard).getByRole('button', { name: 'Delete' }));
    expect(window.confirm).toHaveBeenCalled();
    expect(screen.getByText('Wait for confirmation')).toBeInTheDocument();
    expect(await screen.findByText('This rule has historical checks. Deactivate it instead.')).toBeInTheDocument();
  });

  it('pre-populates rule editing, sends the update payload, and reactivates an inactive rule', async () => {
    renderRules();
    await userEvent.click(screen.getByRole('tab', { name: 'Rules' }));
    const activeCard = (await screen.findByText('Require a confirmed setup.')).closest('section');
    await userEvent.click(within(activeCard).getByRole('button', { name: 'Edit' }));
    const dialog = screen.getByRole('dialog', { name: 'Edit trading rule' });
    expect(within(dialog).getByLabelText(/Rule name/)).toHaveValue('Wait for confirmation');
    expect(within(dialog).getByLabelText('Description')).toHaveValue('Require a confirmed setup.');
    expect(within(dialog).getByLabelText(/Scope/)).toHaveValue('trade');
    await userEvent.clear(within(dialog).getByLabelText(/Rule name/));
    await userEvent.type(within(dialog).getByLabelText(/Rule name/), 'Wait for the close');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Save rule' }));
    await waitFor(() => expect(apiMocks.update.mock.calls[0][0]).toBe(ruleId));
    expect(apiMocks.update.mock.calls[0][1]).toEqual(expect.objectContaining({ name: 'Wait for the close', scope: 'trade', isActive: true }));
    const inactiveCard = screen.getByText('Prepare before the open').closest('section');
    await userEvent.click(within(inactiveCard).getByRole('button', { name: 'Reactivate' }));
    await waitFor(() => expect(apiMocks.update).toHaveBeenCalledWith(inactiveRuleId, { isActive: true }));
  });

  it('applies history rule/outcome filters while preserving period parameters', async () => {
    renderRules();
    await userEvent.click(screen.getByRole('tab', { name: 'Check History' }));
    await userEvent.selectOptions(screen.getByLabelText('History rule'), ruleId);
    await userEvent.selectOptions(screen.getByLabelText('History outcome'), 'broken');
    await waitFor(() => expect(apiMocks.listChecks).toHaveBeenLastCalledWith(expect.objectContaining({ ruleId, outcome: 'broken', page: 1, limit: 25 })));
  });

  it('preserves history filters during pagination and deletes only after confirmation', async () => {
    apiMocks.listChecks.mockResolvedValue({ checks, pagination: { page: 1, limit: 25, total: 30, totalPages: 2 } });
    renderRules();
    await userEvent.click(screen.getByRole('tab', { name: 'Check History' }));
    await userEvent.selectOptions(screen.getByLabelText('History outcome'), 'broken');
    await userEvent.click(await screen.findByRole('button', { name: 'Next' }));
    await waitFor(() => expect(apiMocks.listChecks).toHaveBeenLastCalledWith(expect.objectContaining({ outcome: 'broken', page: 2, limit: 25 })));
    const checkCard = screen.getByText('Waited for the signal.').closest('section');
    await userEvent.click(within(checkCard).getByRole('button', { name: 'Delete' }));
    expect(window.confirm).toHaveBeenCalled();
    await waitFor(() => expect(apiMocks.removeCheck.mock.calls[0][0]).toBe(checkIds[0]));
    expect(await screen.findByText('Rule check deleted.')).toBeInTheDocument();
  });

  it('searches recent owned trades and Journal entries without loading full histories', async () => {
    renderRules();
    await userEvent.click(screen.getByRole('button', { name: 'Record Check' }));
    const dialog = screen.getByRole('dialog', { name: 'Record rule check' });
    await userEvent.type(within(dialog).getByLabelText('Search trades by symbol'), 'NQ');
    await waitFor(() => expect(apiMocks.trades).toHaveBeenLastCalledWith(expect.objectContaining({ symbol: 'NQ', page: 1, limit: 20 })));
    await userEvent.type(within(dialog).getByLabelText('Search Journal entries'), 'review');
    await waitFor(() => expect(apiMocks.journal).toHaveBeenLastCalledWith(expect.objectContaining({ search: 'review', page: 1, limit: 20 })));
  });

  it('closes the check form on Escape and restores focus to the header action', async () => {
    renderRules();
    const trigger = screen.getByRole('button', { name: 'Record Check' });
    await userEvent.click(trigger);
    expect(screen.getByRole('dialog', { name: 'Record rule check' })).toBeInTheDocument();
    await userEvent.keyboard('{Escape}');
    expect(screen.queryByRole('dialog', { name: 'Record rule check' })).not.toBeInTheDocument();
    expect(trigger).toHaveFocus();
  });

  it('keeps successful adherence visible when history fails', async () => {
    apiMocks.listChecks.mockRejectedValue(new Error('history failed'));
    renderRules();
    expect(await screen.findByText('66.7%')).toBeInTheDocument();
    expect(await screen.findByText('Recent checks could not be loaded')).toBeInTheDocument();
    expect(screen.getByText('Per-rule adherence')).toBeInTheDocument();
  });

  it('keeps Rules and history available when only adherence fails', async () => {
    apiMocks.adherence.mockRejectedValue(new Error('adherence failed'));
    renderRules();
    expect(await screen.findByText('Adherence summary could not be loaded')).toBeInTheDocument();
    expect(screen.getByText('Waited for the signal.')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('tab', { name: 'Rules' }));
    expect(await screen.findByText('Require a confirmed setup.')).toBeInTheDocument();
  });

  it('shows a full-page error only when every primary Rules request fails', async () => {
    apiMocks.list.mockRejectedValue(new Error('rules failed'));
    apiMocks.adherence.mockRejectedValue(new Error('adherence failed'));
    apiMocks.listChecks.mockRejectedValue(new Error('history failed'));
    renderRules();
    expect(await screen.findByText('Rules & Adherence could not be loaded')).toBeInTheDocument();
    expect(screen.getByText('Still available: Period controls and forms')).toBeInTheDocument();
  });

  it('keeps percentages, dates, and symbols LTR-safe when the interface is RTL', async () => {
    document.documentElement.setAttribute('dir', 'rtl');
    renderRules();
    expect(await screen.findByText('66.7%')).toHaveAttribute('dir', 'ltr');
    expect(screen.getByRole('link', { name: 'ES' }).firstElementChild).toHaveAttribute('dir', 'ltr');
    expect(screen.getAllByText(formatDateKey(today)).every((node) => node.getAttribute('dir') === 'ltr' || node.closest('[dir="ltr"]'))).toBe(true);
  });

  it('shows truthful no-rules and filtered-empty states without duplicate body CTAs', async () => {
    apiMocks.list.mockResolvedValue({ rules: [] });
    apiMocks.adherence.mockResolvedValue({ summary: { activeRules: 0, totalChecks: 0, eligibleChecks: 0, followed: 0, broken: 0, notApplicable: 0, adherenceRate: null }, rules: [] });
    apiMocks.listChecks.mockResolvedValue({ checks: [], pagination: { page: 1, limit: 25, total: 0, totalPages: 0 } });
    renderRules();
    expect(await screen.findByText('No trading rules yet')).toBeInTheDocument();
    expect(screen.getAllByRole('button', { name: 'New Rule' })).toHaveLength(1);
    await userEvent.click(screen.getByRole('tab', { name: 'Rules' }));
    await userEvent.type(screen.getByPlaceholderText('Search rules'), 'missing');
    expect(await screen.findByText('No rules match the current filters')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Clear filters' })).toBeInTheDocument();
  });
});
