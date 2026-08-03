import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { ToastProvider } from '../ui/Toast.jsx';

vi.mock('../../context/AuthContext.jsx', () => ({
  useAuth: () => ({
    user: { email: 'real.user@example.com', displayName: 'Real User' },
    logout: vi.fn(),
  }),
}));

import { AppShell } from './AppShell.jsx';

describe('AppShell', () => {
  it('renders real navigation, route metadata, user data, and page content', async () => {
    render(
      <MemoryRouter initialEntries={['/trades']}>
        <ToastProvider>
          <AppShell><div>Trade page content</div></AppShell>
        </ToastProvider>
      </MemoryRouter>,
    );

    expect(screen.getByRole('heading', { name: 'Trades' })).toBeInTheDocument();
    expect(screen.getAllByRole('link', { name: 'Dashboard' }).length).toBeGreaterThan(0);
    expect(screen.getAllByRole('link', { name: 'Import' }).length).toBeGreaterThan(0);
    expect(screen.queryByRole('link', { name: 'Portfolio' })).not.toBeInTheDocument();
    expect(screen.getByText('real.user@example.com')).toBeInTheDocument();
    expect(screen.getByText('Trade page content')).toBeInTheDocument();
    await waitFor(() => expect(document.title).toBe('Trades · TradingLog'));

    await userEvent.click(screen.getByRole('button', { name: 'Use light theme' }));
    expect(document.documentElement).toHaveAttribute('data-theme', 'light');
    expect(window.localStorage.getItem('tradinglog-theme')).toBe('light');
  });
});
