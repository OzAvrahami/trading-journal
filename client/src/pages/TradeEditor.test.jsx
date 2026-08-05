import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ToastProvider } from '../components/ui/Toast.jsx';

const api = vi.hoisted(() => ({ accounts: vi.fn(), get: vi.fn(), create: vi.fn(), update: vi.fn(), strategies: vi.fn(), setups: vi.fn() }));
vi.mock('../api/accounts.js', () => ({ accountsApi: { list: api.accounts } }));
vi.mock('../api/trades.js', () => ({ tradesApi: { get: api.get, create: api.create, update: api.update } }));
vi.mock('../api/strategies.js', () => ({ strategiesApi: { list: api.strategies, listSetups: api.setups } }));
vi.mock('../hooks/useUserTimezone.js', () => ({ useUserTimezone: () => 'Asia/Jerusalem' }));
vi.mock('../hooks/useDirection.js', () => ({ useDirection: () => ({ isRtl: false }) }));
vi.mock('../components/trades/TradeForm.jsx', () => ({
  TradeForm: (props) => (
    <div data-testid="editor-form">
      <span>{props.isEdit ? `Editing ${props.defaultValues?.symbol}` : 'Creating trade'}</span>
      <button onClick={() => props.onDirtyChange(true)}>Make dirty</button>
      <button onClick={() => props.onSubmit({ quantity: 2 }, 'save', { accountId: 'a1' })}>Save mocked</button>
      {!props.isEdit && <button onClick={() => props.onSubmit({ accountId: 'a1' }, 'addAnother', { accountId: 'a1' })}>Save another mocked</button>}
    </div>
  ),
}));

import TradeEditor from './TradeEditor.jsx';

const id = '550e8400-e29b-41d4-a716-446655440000';
const account = { id: 'a1', company: 'Broker', accountNumber: '100', accountName: 'Main', status: 'active' };
const trade = { id, accountId: 'a1', symbol: 'MNQ', market: 'futures', direction: 'long', status: 'open', entryDatetime: '2026-08-04T07:00:00Z', entryPrice: 22000, quantity: 1, fees: 0 };

function renderEditor(path = '/trades/new') {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}><ToastProvider><MemoryRouter initialEntries={[path]}><Routes>
      <Route path="/trades/new" element={<TradeEditor />} />
      <Route path="/trades/:tradeId/edit" element={<TradeEditor />} />
      <Route path="/trades/:tradeId" element={<p>Trade detail destination</p>} />
      <Route path="/trades" element={<p>Trades destination</p>} />
      <Route path="/accounts" element={<p>Accounts destination</p>} />
    </Routes></MemoryRouter></ToastProvider></QueryClientProvider>,
  );
}

describe('TradeEditor', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    api.accounts.mockResolvedValue([account]);
    api.get.mockResolvedValue(trade);
    api.create.mockResolvedValue(trade);
    api.update.mockResolvedValue(trade);
    api.strategies.mockResolvedValue({ strategies: [] });
    api.setups.mockResolvedValue({ setups: [] });
  });

  it('loads real accounts and creates once before navigating to Trade Detail', async () => {
    renderEditor();
    expect(await screen.findByText('Creating trade')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Save mocked' }));
    await waitFor(() => expect(api.create).toHaveBeenCalledTimes(1));
    expect(api.update).not.toHaveBeenCalled();
    expect(await screen.findByText('Trade detail destination')).toBeInTheDocument();
  });

  it('save and add another remains in create mode and does not duplicate', async () => {
    renderEditor();
    await screen.findByText('Creating trade');
    await userEvent.click(screen.getByRole('button', { name: 'Save another mocked' }));
    await waitFor(() => expect(api.create).toHaveBeenCalledTimes(1));
    expect(screen.getByText('Creating trade')).toBeInTheDocument();
  });

  it('loads an existing trade and updates instead of creating', async () => {
    renderEditor(`/trades/${id}/edit`);
    expect(await screen.findByText('Editing MNQ')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Save mocked' }));
    await waitFor(() => expect(api.update).toHaveBeenCalledWith(id, { quantity: 2 }));
    expect(api.create).not.toHaveBeenCalled();
    expect(await screen.findByText('Trade detail destination')).toBeInTheDocument();
  });

  it('does not render create mode for invalid or missing edit targets', async () => {
    const invalid = renderEditor('/trades/not-a-uuid/edit');
    expect(screen.getByText('Invalid trade address')).toBeInTheDocument();
    expect(screen.queryByText('Creating trade')).not.toBeInTheDocument();
    invalid.unmount();
    api.get.mockRejectedValue({ response: { status: 404, data: { error: { code: 'TRADE_NOT_FOUND' } } } });
    renderEditor(`/trades/${id}/edit`);
    expect(await screen.findByRole('heading', { name: 'Trade not found' })).toBeInTheDocument();
    expect(screen.queryByText('Creating trade')).not.toBeInTheDocument();
  });

  it('provides a real Accounts action when no accounts exist', async () => {
    api.accounts.mockResolvedValue([]);
    renderEditor();
    expect(await screen.findByRole('heading', { name: 'No accounts yet' })).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Open Accounts' }));
    expect(screen.getByText('Accounts destination')).toBeInTheDocument();
  });

  it('preserves the editor after a failed save', async () => {
    api.create.mockRejectedValue(new Error('offline'));
    renderEditor();
    await screen.findByText('Creating trade');
    await userEvent.click(screen.getByRole('button', { name: 'Save mocked' }));
    expect(await screen.findByText('Failed to create trade.', { selector: '[role="alert"]' })).toBeInTheDocument();
    expect(screen.getByText('Creating trade')).toBeInTheDocument();
  });

  it('protects dirty Cancel navigation and registers beforeunload only while dirty', async () => {
    const addListener = vi.spyOn(window, 'addEventListener');
    vi.spyOn(window, 'confirm').mockReturnValueOnce(false).mockReturnValueOnce(true);
    renderEditor();
    await screen.findByText('Creating trade');
    await userEvent.click(screen.getByRole('button', { name: 'Make dirty' }));
    expect(addListener).toHaveBeenCalledWith('beforeunload', expect.any(Function));
    await userEvent.click(screen.getByRole('button', { name: 'Back to trades' }));
    expect(screen.getByText('Creating trade')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Back to trades' }));
    expect(screen.getByText('Trades destination')).toBeInTheDocument();
  });
});
