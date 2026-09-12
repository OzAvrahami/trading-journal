import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { invalidateSession, getAccessToken, setAccessToken } from '../api/session.js';

const mocks = vi.hoisted(() => ({ refresh: vi.fn(), logout: vi.fn(), getMe: vi.fn(), login: vi.fn(), signup: vi.fn(), updateMe: vi.fn() }));
vi.mock('../api/client.js', () => ({ refreshAccessToken: mocks.refresh }));
vi.mock('../api/auth.js', () => ({ authApi: { logout: mocks.logout, getMe: mocks.getMe, login: mocks.login, signup: mocks.signup, updateMe: mocks.updateMe } }));
import { AuthProvider, useAuth } from './AuthContext.jsx';
function Controls() {
  const { user, loading, logout, login, signup } = useAuth();
  return <><span>{user?.email || 'logged-out'}</span><button disabled={loading} onClick={logout}>Log out</button><button onClick={() => login({})}>Log in</button><button onClick={() => signup({})}>Register</button></>;
}
function mount() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(<QueryClientProvider client={queryClient}><AuthProvider><Controls /></AuthProvider></QueryClientProvider>);
  return queryClient;
}
beforeEach(() => {
  invalidateSession();
  mocks.refresh.mockReset().mockResolvedValue('valid-token');
  mocks.getMe.mockReset().mockResolvedValue({ email: 'old@example.test' });
  mocks.logout.mockReset().mockResolvedValue({});
  mocks.login.mockReset().mockResolvedValue({ user:{ email:'new@example.test' }, accessToken:'new-token' });
  mocks.signup.mockReset().mockResolvedValue({ user:{ email:'registered@example.test' }, accessToken:'registered-token' });
});
describe('AuthProvider session isolation', () => {
  it('clears user, token and queries on definitive invalidation', async () => {
    const cache=mount(); await screen.findByText('old@example.test');
    cache.setQueryData(['trades'],[{ id:'private' }]); setAccessToken('old-token');
    act(()=>{ invalidateSession(); });
    expect(screen.getByText('logged-out')).toBeInTheDocument(); expect(getAccessToken()).toBe(null); expect(cache.getQueryCache().getAll()).toHaveLength(0);
  });
  it('logout clears cached queries and cancels outstanding query work', async () => {
    const cache=mount(); await screen.findByText('old@example.test');
    let finish; const pending=new Promise(resolve=>{finish=resolve;});
    const result=cache.fetchQuery({queryKey:['private'],queryFn:()=>pending}).catch(()=>null);
    await userEvent.click(screen.getByRole('button',{name:'Log out'}));
    await waitFor(()=>expect(screen.getByText('logged-out')).toBeInTheDocument());
    finish([{id:'late-private-data'}]); await result;
    expect(cache.getQueryCache().getAll()).toHaveLength(0);
  });
  it('late startup profile cannot replace a newly logged-in user', async () => {
    let finish; mocks.getMe.mockReturnValue(new Promise(resolve=>{finish=resolve;}));
    mount(); await waitFor(()=>expect(mocks.getMe).toHaveBeenCalled());
    await userEvent.click(screen.getByRole('button',{name:'Log in'}));
    await screen.findByText('new@example.test');
    await act(async()=>{ finish({email:'old@example.test'}); });
    expect(screen.getByText('new@example.test')).toBeInTheDocument(); expect(getAccessToken()).toBe('new-token');
  });
  it('registration establishes the new user and discards prior query data', async () => {
    const cache=mount(); await screen.findByText('old@example.test');cache.setQueryData(['trades'],['old']);
    await userEvent.click(screen.getByRole('button',{name:'Register'}));
    await screen.findByText('registered@example.test');expect(getAccessToken()).toBe('registered-token');expect(cache.getQueryCache().getAll()).toHaveLength(0);
  });
  it('ordinary startup network failure does not clear existing token or query data', async () => {
    mocks.refresh.mockRejectedValue(new Error('offline')); setAccessToken('retained-token');
    const cache=mount();cache.setQueryData(['retained'],['data']);
    await waitFor(()=>expect(screen.getByRole('button',{name:'Log out'})).toBeEnabled());
    expect(getAccessToken()).toBe('retained-token');expect(cache.getQueryData(['retained'])).toEqual(['data']);
  });
});
