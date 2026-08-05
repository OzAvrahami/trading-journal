import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import i18n from '../i18n/index.js';
import { ToastProvider } from '../components/ui/Toast.jsx';

const api = vi.hoisted(() => ({
  list: vi.fn(), listSetups: vi.fn(), legacy: vi.fn(),
  create: vi.fn(), update: vi.fn(), createSetup: vi.fn(), updateSetup: vi.fn(),
}));

vi.mock('../api/strategies.js', () => ({ strategiesApi: api }));
vi.mock('../context/AuthContext.jsx', async (importOriginal) => ({
  ...(await importOriginal()),
  useAuth: () => ({ user: { email: 'owner@example.com' }, logout: vi.fn() }),
}));

import { AppShell } from '../components/layout/AppShell.jsx';
import Strategies from './Strategies.jsx';

const strategy = {
  id: 'strategy-1', name: 'Opening Range Breakout', description: 'Wait for confirmation.', isActive: true,
  setupCount: 1, activeSetupCount: 1, closedTrades: 4, openTrades: 1, winners: 3, losers: 1, breakeven: 0, pnlNet: 420,
  winRate: 0.75, averageR: 1.25, profitFactor: 2.4,
};
const archived = {
  ...strategy, id: 'strategy-2', name: 'Mean Reversion', description: null, isActive: false,
  setupCount: 0, activeSetupCount: 0, closedTrades: 0, openTrades: 0, winners: 0, losers: 0, breakeven: 0, pnlNet: 0,
  winRate: null, averageR: null, profitFactor: null,
};
const setup = {
  id: 'setup-1', strategyId: strategy.id, strategyName: strategy.name, name: 'Confirmed breakout',
  description: 'Retest holds.', isActive: true, closedTrades: 3, openTrades: 0, winners: 2, losers: 1, breakeven: 0, pnlNet: 300,
  winRate: 0.6667, averageR: 1.1, profitFactor: 1.8,
};

function setSuccess() {
  api.list.mockResolvedValue({ strategies: [strategy, archived], summary: { activeStrategies: 1, activeSetups: 1, managedClosedTrades: 4, unlinkedClosedTrades: 2 } });
  api.listSetups.mockResolvedValue({ setups: [setup] });
  api.legacy.mockResolvedValue({
    strategies: [{ value: 'Legacy ORB', tradeCount: 2, closedTrades: 2, pnlNet: -25, winRate: 0.5 }],
    setups: [{ value: null, tradeCount: 1, closedTrades: 1, pnlNet: 0, winRate: 0 }],
  });
  api.create.mockResolvedValue({ strategy });
  api.update.mockResolvedValue({ strategy });
  api.createSetup.mockResolvedValue({ setup });
  api.updateSetup.mockResolvedValue({ setup });
}

function renderPage() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  return {
    queryClient,
    ...render(
      <MemoryRouter initialEntries={['/strategies']}>
        <QueryClientProvider client={queryClient}>
          <ToastProvider><AppShell><Strategies /></AppShell></ToastProvider>
        </QueryClientProvider>
      </MemoryRouter>,
    ),
  };
}

describe('Strategies & Setups page', () => {
  beforeEach(() => { vi.clearAllMocks(); setSuccess(); });

  it('renders one shell H1, real managed metrics, archive state, and separated legacy values', async () => {
    renderPage();
    expect(await screen.findByRole('heading', { level: 1, name: 'Strategies & Setups' })).toBeInTheDocument();
    expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1);
    expect((await screen.findAllByText('Opening Range Breakout'))[0]).toHaveAttribute('dir', 'auto');
    expect(screen.getByText('Mean Reversion').closest('button')).toHaveTextContent('Archived');
    expect(screen.getByText('Legacy ORB')).toBeInTheDocument();
    expect(screen.getByText('Unclassified')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Historical unlinked values' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /map|link legacy/i })).not.toBeInTheDocument();
    const selectedRegion = screen.getByRole('region', { name: 'Opening Range Breakout' });
    expect(selectedRegion.querySelectorAll('dd[dir="ltr"].font-mono').length).toBeGreaterThan(5);
  });

  it('selects a Strategy, shows its owned Setups, and archives without unlinking UI data', async () => {
    renderPage();
    expect(await screen.findByText('Confirmed breakout')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: /Opening Range Breakout.*1 setup.*4 closed/i }));
    await userEvent.click(screen.getAllByRole('button', { name: 'Archive' })[0]);
    await waitFor(() => expect(api.update).toHaveBeenCalledWith(strategy.id, { isActive: false }));
    expect(screen.getByText('Confirmed breakout')).toBeInTheDocument();
  });

  it('validates and creates a trimmed Strategy while guarding duplicate submission', async () => {
    renderPage();
    await screen.findAllByText('Opening Range Breakout');
    await userEvent.click(screen.getByRole('button', { name: 'Create Strategy' }));
    const dialog = screen.getByRole('dialog', { name: 'Create Strategy' });
    await userEvent.click(within(dialog).getByRole('button', { name: 'Create Strategy' }));
    expect(await within(dialog).findByText('Enter a name.')).toBeInTheDocument();
    await userEvent.type(within(dialog).getByLabelText(/Strategy/), '  Momentum  ');
    await userEvent.type(within(dialog).getByLabelText('Description'), '  Confirmed continuation  ');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Create Strategy' }));
    await waitFor(() => expect(api.create).toHaveBeenCalledTimes(1));
    expect(api.create).toHaveBeenCalledWith({ name: 'Momentum', description: 'Confirmed continuation' });
  });

  it('preselects the parent for Setup creation and keeps it immutable while editing', async () => {
    renderPage();
    await screen.findByText('Confirmed breakout');
    await userEvent.click(screen.getByRole('button', { name: 'Create Setup' }));
    let dialog = screen.getByRole('dialog', { name: 'Create Setup' });
    expect(within(dialog).getByLabelText(/Strategy/)).toHaveValue(strategy.id);
    await userEvent.keyboard('{Escape}');
    await userEvent.click(screen.getAllByRole('button', { name: 'Edit' }).at(-1));
    dialog = screen.getByRole('dialog', { name: 'Edit Setup' });
    expect(within(dialog).getByLabelText(/Strategy/)).toBeDisabled();
    expect(within(dialog).getByText('A Setup cannot be moved to another Strategy after creation.')).toBeInTheDocument();
  });

  it('keeps a failed create form open and maps a stable duplicate error truthfully', async () => {
    api.create.mockRejectedValue({ response: { data: { error: { code: 'STRATEGY_NAME_EXISTS' } } } });
    renderPage();
    await screen.findAllByText('Opening Range Breakout');
    await userEvent.click(screen.getByRole('button', { name: 'Create Strategy' }));
    const dialog = screen.getByRole('dialog', { name: 'Create Strategy' });
    await userEvent.type(within(dialog).getByLabelText(/Strategy/), 'Opening Range Breakout');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Create Strategy' }));
    expect(await screen.findByText('A Strategy with this name already exists.')).toBeInTheDocument();
    expect(within(dialog).getByLabelText(/Strategy/)).toHaveValue('Opening Range Breakout');
  });

  it('localizes navigation and content in Hebrew while keeping user text direction automatic', async () => {
    await i18n.changeLanguage('he');
    document.documentElement.dir = 'rtl';
    renderPage();
    expect(await screen.findByRole('heading', { level: 1, name: 'אסטרטגיות וסטאפים' })).toBeInTheDocument();
    expect(screen.getAllByRole('link', { name: 'אסטרטגיות וסטאפים' }).length).toBeGreaterThan(0);
    expect((await screen.findAllByText('Opening Range Breakout'))[0]).toHaveAttribute('dir', 'auto');
    expect(screen.getByRole('heading', { name: 'Opening Range Breakout' }).closest('section').querySelector('dd[dir="ltr"]')).toBeInTheDocument();
  });

  it('shows truthful loading and full-error states', async () => {
    api.list.mockImplementation(() => new Promise(() => {}));
    const loading = renderPage();
    expect(screen.getAllByLabelText('Loading Strategies and Setups').length).toBeGreaterThan(0);
    loading.unmount();
    api.list.mockRejectedValue(new Error('failed'));
    api.listSetups.mockRejectedValue(new Error('failed'));
    api.legacy.mockRejectedValue(new Error('failed'));
    renderPage();
    expect(await screen.findByText('Strategies and Setups could not be loaded')).toBeInTheDocument();
  });
});
