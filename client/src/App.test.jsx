import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const authState = vi.hoisted(() => ({ current: { user: null, loading: false } }));

vi.mock('./context/AuthContext.jsx', () => ({
  AuthProvider: ({ children }) => children,
  useAuth: () => authState.current,
}));

vi.mock('./components/layout/AppShell.jsx', () => ({
  AppShell: ({ children }) => <div data-testid="app-shell">{children}</div>,
}));
vi.mock('./pages/Analytics.jsx', () => ({ default: () => <span>Analytics page</span> }));
vi.mock('./pages/Journal.jsx', () => ({ default: () => <span>Journal page</span> }));
vi.mock('./pages/Rules.jsx', () => ({ default: () => <span>Rules page</span> }));
vi.mock('./pages/Goals.jsx', () => ({ default: () => <span>Goals page</span> }));
vi.mock('./pages/DailyReview.jsx', () => ({
  default: () => <span>Daily Review page</span>,
  DailyReviewTodayRedirect: () => <span>Daily Review today redirect</span>,
}));
vi.mock('./pages/TradeEditor.jsx', () => ({ default: () => <span>Trade Editor page</span> }));
vi.mock('./pages/Strategies.jsx', () => ({ default: () => <span>Strategies page</span> }));
vi.mock('./pages/Settings.jsx', () => ({ default: () => <span>Settings page</span> }));
vi.mock('./pages/Portfolio.jsx', () => ({ default: () => <span>Portfolio page</span> }));
vi.mock('./pages/PortfolioDetail.jsx', () => ({ default: () => <span>Portfolio detail page</span> }));
vi.mock('./pages/Login.jsx', () => ({ default: () => <span>Login page</span> }));

import { AppRoutes, ProtectedRoute, PublicRoute } from './App.jsx';

describe('route guards', () => {
  beforeEach(() => {
    authState.current = { user: null, loading: false };
  });

  it('redirects an unauthenticated protected route to login', () => {
    render(
      <MemoryRouter initialEntries={['/dashboard']}>
        <Routes>
          <Route path="/dashboard" element={<ProtectedRoute><span>Private</span></ProtectedRoute>} />
          <Route path="/login" element={<span>Login destination</span>} />
        </Routes>
      </MemoryRouter>,
    );
    expect(screen.getByText('Login destination')).toBeInTheDocument();
  });

  it('renders an authenticated protected route inside the shell', () => {
    authState.current = { user: { id: 'user-1' }, loading: false };
    render(<MemoryRouter><ProtectedRoute><span>Private</span></ProtectedRoute></MemoryRouter>);
    expect(screen.getByTestId('app-shell')).toHaveTextContent('Private');
  });

  it('does not render protected content before session restoration resolves', () => {
    authState.current = { user: null, loading: true };
    render(<MemoryRouter><ProtectedRoute><span>Private account data</span></ProtectedRoute></MemoryRouter>);
    expect(screen.getByRole('status', { name: /Loading/ })).toBeInTheDocument();
    expect(screen.queryByText('Private account data')).not.toBeInTheDocument();
    expect(screen.queryByTestId('app-shell')).not.toBeInTheDocument();
  });

  it('redirects an authenticated public route to dashboard', () => {
    authState.current = { user: { id: 'user-1' }, loading: false };
    render(
      <MemoryRouter initialEntries={['/login']}>
        <Routes>
          <Route path="/login" element={<PublicRoute><span>Login form</span></PublicRoute>} />
          <Route path="/dashboard" element={<span>Dashboard destination</span>} />
        </Routes>
      </MemoryRouter>,
    );
    expect(screen.getByText('Dashboard destination')).toBeInTheDocument();
  });

  it('renders a public route for an unauthenticated user', () => {
    render(<MemoryRouter><PublicRoute><span>Login form</span></PublicRoute></MemoryRouter>);
    expect(screen.getByText('Login form')).toBeInTheDocument();
  });

  it('renders Analytics as an authenticated protected route', async () => {
    authState.current = { user: { id: 'user-1' }, loading: false };
    render(<MemoryRouter initialEntries={['/insights/analytics']}><AppRoutes /></MemoryRouter>);
    expect(await screen.findByTestId('app-shell')).toHaveTextContent('Analytics page');
  });

  it('renders Journal as an authenticated protected route', async () => {
    authState.current = { user: { id: 'user-1' }, loading: false };
    render(<MemoryRouter initialEntries={['/insights/journal']}><AppRoutes /></MemoryRouter>);
    expect(await screen.findByTestId('app-shell')).toHaveTextContent('Journal page');
  });

  it('protects the Journal route from unauthenticated access', () => {
    render(<MemoryRouter initialEntries={['/insights/journal']}><AppRoutes /></MemoryRouter>);
    expect(screen.getByText('Login page')).toBeInTheDocument();
    expect(screen.queryByText('Journal page')).not.toBeInTheDocument();
  });

  it('renders Rules as an authenticated protected route', async () => {
    authState.current = { user: { id: 'user-1' }, loading: false };
    render(<MemoryRouter initialEntries={['/insights/rules']}><AppRoutes /></MemoryRouter>);
    expect(await screen.findByTestId('app-shell')).toHaveTextContent('Rules page');
  });

  it('protects the Rules route from unauthenticated access', () => {
    render(<MemoryRouter initialEntries={['/insights/rules']}><AppRoutes /></MemoryRouter>);
    expect(screen.getByText('Login page')).toBeInTheDocument();
    expect(screen.queryByText('Rules page')).not.toBeInTheDocument();
  });

  it('renders Goals as an authenticated protected route', async () => {
    authState.current = { user: { id: 'user-1' }, loading: false };
    render(<MemoryRouter initialEntries={['/insights/goals']}><AppRoutes /></MemoryRouter>);
    expect(await screen.findByTestId('app-shell')).toHaveTextContent('Goals page');
  });

  it('protects the Goals route from unauthenticated access', () => {
    render(<MemoryRouter initialEntries={['/insights/goals']}><AppRoutes /></MemoryRouter>);
    expect(screen.getByText('Login page')).toBeInTheDocument();
    expect(screen.queryByText('Goals page')).not.toBeInTheDocument();
  });

  it('renders the selected-date Daily Review as a protected route', async () => {
    authState.current = { user: { id: 'user-1' }, loading: false };
    render(<MemoryRouter initialEntries={['/daily-review/2026-08-04']}><AppRoutes /></MemoryRouter>);
    expect(await screen.findByTestId('app-shell')).toHaveTextContent('Daily Review page');
  });

  it('protects both Daily Review route forms', () => {
    render(<MemoryRouter initialEntries={['/daily-review']}><AppRoutes /></MemoryRouter>);
    expect(screen.getByText('Login page')).toBeInTheDocument();
    expect(screen.queryByText('Daily Review today redirect')).not.toBeInTheDocument();
  });

  it('protects both Trade Editor routes and does not treat new as a trade ID', async () => {
    const protectedView = render(<MemoryRouter initialEntries={['/trades/new']}><AppRoutes /></MemoryRouter>);
    expect(screen.getByText('Login page')).toBeInTheDocument();
    protectedView.unmount();
    authState.current = { user: { id: 'user-1' }, loading: false };
    const view = render(<MemoryRouter initialEntries={['/trades/new']}><AppRoutes /></MemoryRouter>);
    expect(await screen.findByTestId('app-shell')).toHaveTextContent('Trade Editor page');
    view.unmount();
    render(<MemoryRouter initialEntries={['/trades/550e8400-e29b-41d4-a716-446655440000/edit']}><AppRoutes /></MemoryRouter>);
    expect(await screen.findByTestId('app-shell')).toHaveTextContent('Trade Editor page');
  });

  it('protects the managed Strategies and Setups route', async () => {
    const anonymous = render(<MemoryRouter initialEntries={['/strategies']}><AppRoutes /></MemoryRouter>);
    expect(screen.getByText('Login page')).toBeInTheDocument();
    expect(screen.queryByText('Strategies page')).not.toBeInTheDocument();
    anonymous.unmount();
    authState.current = { user: { id: 'user-1' }, loading: false };
    render(<MemoryRouter initialEntries={['/strategies']}><AppRoutes /></MemoryRouter>);
    expect(await screen.findByTestId('app-shell')).toHaveTextContent('Strategies page');
  });

  it('protects the Settings route', async () => {
    const anonymous = render(<MemoryRouter initialEntries={['/settings']}><AppRoutes /></MemoryRouter>);
    expect(screen.getByText('Login page')).toBeInTheDocument();
    anonymous.unmount();
    authState.current = { user: { id: 'user-1' }, loading: false };
    render(<MemoryRouter initialEntries={['/settings']}><AppRoutes /></MemoryRouter>);
    expect(await screen.findByTestId('app-shell')).toHaveTextContent('Settings page');
  });

  it('protects the Portfolio overview and detail routes', async () => {
    const anonymous = render(<MemoryRouter initialEntries={['/portfolio']}><AppRoutes /></MemoryRouter>);
    expect(screen.getByText('Login page')).toBeInTheDocument();
    anonymous.unmount();
    authState.current = { user: { id: 'user-1' }, loading: false };
    const overview = render(<MemoryRouter initialEntries={['/portfolio']}><AppRoutes /></MemoryRouter>);
    expect(await screen.findByTestId('app-shell')).toHaveTextContent('Portfolio page');
    overview.unmount();
    render(<MemoryRouter initialEntries={['/portfolio/11111111-1111-4111-8111-111111111111']}><AppRoutes /></MemoryRouter>);
    expect(await screen.findByTestId('app-shell')).toHaveTextContent('Portfolio detail page');
  });
});
