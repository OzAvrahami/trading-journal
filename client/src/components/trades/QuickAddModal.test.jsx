import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ToastProvider } from '../ui/Toast.jsx';

const api = vi.hoisted(() => ({ accounts: vi.fn(), create: vi.fn() }));
vi.mock('../../api/accounts.js', () => ({ accountsApi: { list: api.accounts } }));
vi.mock('../../api/trades.js', () => ({ tradesApi: { create: api.create } }));
vi.mock('../../hooks/useUserTimezone.js', () => ({ useUserTimezone: () => 'Asia/Jerusalem' }));
vi.mock('./TradeForm.jsx', () => ({ TradeForm: (props) => <div><span>{props.variant}</span><button onClick={() => props.onDirtyChange(true)}>Dirty</button><button onClick={() => props.onSubmit({ symbol: 'MNQ' })}>Submit</button><button onClick={() => props.onOpenFullForm(true)}>Open full form</button></div> }));

import { QuickAddModal } from './QuickAddModal.jsx';

function renderModal(onClose = vi.fn()) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  return { onClose, ...render(<QueryClientProvider client={queryClient}><ToastProvider><MemoryRouter><Routes><Route path="*" element={<><QuickAddModal open onClose={onClose} /><p>Current route</p></>} /><Route path="/trades/new" element={<p>Full editor destination</p>} /></Routes></MemoryRouter></ToastProvider></QueryClientProvider>) };
}

describe('QuickAddModal', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    api.accounts.mockResolvedValue([{ id: 'a1', status: 'active' }]);
    api.create.mockResolvedValue({ id: 'trade-1' });
  });

  it('uses the compact shared form and closes only after successful creation', async () => {
    const { onClose } = renderModal();
    expect(await screen.findByText('quick')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Submit' }));
    await waitFor(() => expect(api.create).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(onClose).toHaveBeenCalled());
  });

  it('stays open and preserves the form after failure', async () => {
    api.create.mockRejectedValue(new Error('offline'));
    const { onClose } = renderModal();
    await screen.findByText('quick');
    await userEvent.click(screen.getByRole('button', { name: 'Submit' }));
    await waitFor(() => expect(api.create).toHaveBeenCalled());
    expect(onClose).not.toHaveBeenCalled();
    expect(screen.getByText('quick')).toBeInTheDocument();
  });

  it('requires explicit confirmation before discarding dirty Quick Add values for the full editor', async () => {
    vi.spyOn(window, 'confirm').mockReturnValueOnce(false).mockReturnValueOnce(true);
    const { onClose } = renderModal();
    await screen.findByText('quick');
    await userEvent.click(screen.getByRole('button', { name: 'Dirty' }));
    await userEvent.click(screen.getByRole('button', { name: 'Open full form' }));
    expect(onClose).not.toHaveBeenCalled();
    await userEvent.click(screen.getByRole('button', { name: 'Open full form' }));
    expect(onClose).toHaveBeenCalled();
    expect(screen.getByText('Full editor destination')).toBeInTheDocument();
  });
});
