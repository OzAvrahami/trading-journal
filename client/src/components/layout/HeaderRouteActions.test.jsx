import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, useLocation } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ToastProvider } from '../ui/Toast.jsx';

const apiMocks = vi.hoisted(() => ({ accounts: vi.fn(), create: vi.fn(), update: vi.fn(), remove: vi.fn() }));
vi.mock('../../api/accounts.js', () => ({ accountsApi: {
  list: apiMocks.accounts,
  create: apiMocks.create,
  update: apiMocks.update,
  remove: apiMocks.remove,
} }));

import Accounts from '../../pages/Accounts.jsx';
import Import from '../../pages/Import.jsx';
import { resolveRouteMetadata } from '../../routeMetadata.js';
import { Header } from './Header.jsx';
import { HeaderControlsProvider } from './HeaderControls.jsx';

function renderRoute(pathname, Page) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } });
  const metadata = resolveRouteMetadata(pathname);
  return render(
    <QueryClientProvider client={client}>
      <ToastProvider>
        <MemoryRouter initialEntries={[pathname]}>
          <HeaderControlsProvider metadata={metadata}>
            <Header metadata={metadata} />
            <Page />
          </HeaderControlsProvider>
        </MemoryRouter>
      </ToastProvider>
    </QueryClientProvider>,
  );
}

describe('route-specific header actions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    apiMocks.accounts.mockResolvedValue([]);
  });

  it('moves the existing New Account action into the Accounts header', async () => {
    renderRoute('/accounts', Accounts);
    expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1);
    const action = await screen.findByRole('button', { name: 'New account' });
    expect(action.closest('header')).toBeInTheDocument();
    await userEvent.click(action);
    expect(screen.getByRole('dialog', { name: 'New Account' })).toBeInTheDocument();
  });

  it('uses shell identity on Import without inventing a global import action', async () => {
    renderRoute('/import', Import);
    expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1);
    expect(screen.getByRole('heading', { level: 1, name: 'Import' })).toBeInTheDocument();
    expect(screen.getByText('Bring broker trade files into an existing account.')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /New import/i })).not.toBeInTheDocument();
    expect(await screen.findByText('Select & Upload')).toBeInTheDocument();
  });

  it('exposes the canonical full-page New Trade command globally', async () => {
    function Location() { return <output>{useLocation().pathname}</output>; }
    const metadata = resolveRouteMetadata('/accounts');
    render(
      <MemoryRouter initialEntries={['/accounts']}>
        <HeaderControlsProvider metadata={metadata}>
          <Header metadata={metadata} />
          <Location />
        </HeaderControlsProvider>
      </MemoryRouter>,
    );
    await userEvent.click(screen.getByRole('button', { name: 'Search or run a command' }));
    await userEvent.type(screen.getByRole('searchbox', { name: 'Search commands' }), 'New Trade');
    await userEvent.click(screen.getByRole('option', { name: /New Trade/ }));
    expect(screen.getByText('/trades/new')).toBeInTheDocument();
  });
});
