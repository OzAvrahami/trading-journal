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

  it('renders Analytics as an authenticated protected route', () => {
    authState.current = { user: { id: 'user-1' }, loading: false };
    render(<MemoryRouter initialEntries={['/insights/analytics']}><AppRoutes /></MemoryRouter>);
    expect(screen.getByTestId('app-shell')).toHaveTextContent('Analytics page');
  });

  it('renders Journal as an authenticated protected route', () => {
    authState.current = { user: { id: 'user-1' }, loading: false };
    render(<MemoryRouter initialEntries={['/insights/journal']}><AppRoutes /></MemoryRouter>);
    expect(screen.getByTestId('app-shell')).toHaveTextContent('Journal page');
  });

  it('protects the Journal route from unauthenticated access', () => {
    render(<MemoryRouter initialEntries={['/insights/journal']}><AppRoutes /></MemoryRouter>);
    expect(screen.getByText('Login page')).toBeInTheDocument();
    expect(screen.queryByText('Journal page')).not.toBeInTheDocument();
  });
});
