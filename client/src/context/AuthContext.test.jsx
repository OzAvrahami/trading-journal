import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  refresh: vi.fn(),
  logout: vi.fn(),
  getMe: vi.fn(),
  clearAccessToken: vi.fn(),
  setAccessToken: vi.fn(),
}));

vi.mock('axios', () => ({ default: { post: mocks.refresh } }));
vi.mock('../api/auth.js', () => ({ authApi: {
  logout: mocks.logout,
  getMe: mocks.getMe,
  login: vi.fn(),
  signup: vi.fn(),
  updateMe: vi.fn(),
} }));
vi.mock('../api/client.js', () => ({
  clearAccessToken: mocks.clearAccessToken,
  setAccessToken: mocks.setAccessToken,
}));

import { AuthProvider, useAuth } from './AuthContext.jsx';

function LogoutControl() {
  const { loading, logout } = useAuth();
  return <button type="button" disabled={loading} onClick={logout}>Log out</button>;
}

describe('AuthProvider cache isolation', () => {
  beforeEach(() => {
    mocks.refresh.mockReset().mockRejectedValue(new Error('no session'));
    mocks.logout.mockReset().mockResolvedValue({});
    mocks.clearAccessToken.mockReset();
  });

  it('clears all authenticated query data when logging out', async () => {
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    queryClient.setQueryData(['trades'], [{ id: 'owned-by-first-user' }]);
    queryClient.setQueryData(['portfolio', 'portfolio-1'], { name: 'Private portfolio' });
    render(
      <QueryClientProvider client={queryClient}>
        <AuthProvider><LogoutControl /></AuthProvider>
      </QueryClientProvider>,
    );

    const button = screen.getByRole('button', { name: 'Log out' });
    await waitFor(() => expect(button).toBeEnabled());
    await userEvent.click(button);

    await waitFor(() => expect(mocks.logout).toHaveBeenCalledOnce());
    expect(mocks.clearAccessToken).toHaveBeenCalledOnce();
    expect(queryClient.getQueryCache().getAll()).toHaveLength(0);
  });
});
