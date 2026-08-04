import { render, screen, waitFor, within } from '@testing-library/react';
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
    expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1);
    expect(screen.getByText('Find, filter, export, and manage recorded trades.')).toBeInTheDocument();
    expect(screen.getByText('Trades', { selector: '[aria-current="page"]' })).toBeInTheDocument();
    expect(screen.getAllByRole('link', { name: 'Dashboard' }).length).toBeGreaterThan(0);
    expect(screen.getAllByRole('link', { name: 'Import' }).length).toBeGreaterThan(0);
    expect(screen.getAllByRole('link', { name: 'Analytics' }).length).toBeGreaterThan(0);
    expect(screen.getByText('Insights')).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Portfolio' })).not.toBeInTheDocument();
    expect(screen.getAllByRole('link', { name: /Journal & Reviews/i }).length).toBeGreaterThan(0);
    expect(screen.queryByRole('link', { name: /Goals & Rules/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Notifications/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('tablist', { name: 'Workspace' })).not.toBeInTheDocument();
    expect(screen.queryByText('TRADINGLOG · REDESIGN PREVIEW')).not.toBeInTheDocument();
    expect(screen.getByText('real.user@example.com')).toBeInTheDocument();
    expect(screen.getByText('Trade page content')).toBeInTheDocument();
    await waitFor(() => expect(document.title).toBe('Trades · TradingLog'));

    expect(screen.getAllByRole('button', { name: 'Use light theme' })).toHaveLength(1);
    await userEvent.click(screen.getByRole('button', { name: 'Use light theme' }));
    expect(document.documentElement).toHaveAttribute('data-theme', 'light');
    expect(window.localStorage.getItem('tradinglog-theme')).toBe('light');
  });

  it('opens the functional command palette by keyboard, navigates real routes, and restores focus', async () => {
    render(
      <MemoryRouter initialEntries={['/trades']}>
        <ToastProvider>
          <AppShell><div>Trade page content</div></AppShell>
        </ToastProvider>
      </MemoryRouter>,
    );
    const user = userEvent.setup();
    const trigger = screen.getByRole('button', { name: 'Search or run a command' });
    trigger.focus();

    await user.keyboard('{Control>}k{/Control}');
    const dialog = screen.getByRole('dialog', { name: 'Search or run a command' });
    expect(within(dialog).getByLabelText('Search commands')).toHaveFocus();
    expect(within(dialog).getByRole('option', { name: /Dashboard/ })).toBeInTheDocument();
    expect(within(dialog).getByRole('option', { name: /Analytics/ })).toBeInTheDocument();
    expect(within(dialog).getByRole('option', { name: /^Journal & Reviews/ })).toBeInTheDocument();
    expect(within(dialog).getByRole('option', { name: /New journal entry/ })).toBeInTheDocument();
    expect(within(dialog).queryByText('Portfolio')).not.toBeInTheDocument();
    expect(within(dialog).queryByText(/recent/i)).not.toBeInTheDocument();

    await user.keyboard('{Escape}');
    expect(screen.queryByRole('dialog', { name: 'Search or run a command' })).not.toBeInTheDocument();
    expect(trigger).toHaveFocus();

    await user.keyboard('{Control>}k{/Control}');
    await user.keyboard('{ArrowDown}{ArrowDown}{Enter}');
    await waitFor(() => expect(screen.getByRole('heading', { name: 'Accounts' })).toBeInTheDocument());
  });

  it('reaches Analytics through the mobile More navigation without adding a fifth primary item', async () => {
    render(
      <MemoryRouter initialEntries={['/trades']}>
        <ToastProvider>
          <AppShell><div>Trade page content</div></AppShell>
        </ToastProvider>
      </MemoryRouter>,
    );
    const primary = screen.getByRole('navigation', { name: 'Primary navigation' });
    expect(within(primary).getAllByRole('link')).toHaveLength(3);
    expect(within(primary).getByRole('button', { name: 'More' })).toBeInTheDocument();

    await userEvent.click(within(primary).getByRole('button', { name: 'More' }));
    const more = screen.getByRole('dialog', { name: 'More destinations' });
    expect(within(more).getByRole('link', { name: 'Import' })).toBeInTheDocument();
    await userEvent.click(within(more).getByRole('link', { name: 'Analytics' }));
    await waitFor(() => expect(screen.getByRole('heading', { level: 1, name: 'Analytics' })).toBeInTheDocument());
    expect(screen.getByText('Analytics', { selector: '[aria-current="page"]' })).toBeInTheDocument();
  });

  it('reaches Journal through mobile More and exposes its active state', async () => {
    render(
      <MemoryRouter initialEntries={['/trades']}>
        <ToastProvider>
          <AppShell><div>Trade page content</div></AppShell>
        </ToastProvider>
      </MemoryRouter>,
    );
    const primary = screen.getByRole('navigation', { name: 'Primary navigation' });
    expect(within(primary).getAllByRole('link')).toHaveLength(3);
    await userEvent.click(within(primary).getByRole('button', { name: 'More' }));
    const more = screen.getByRole('dialog', { name: 'More destinations' });
    await userEvent.click(within(more).getByRole('link', { name: 'Journal & Reviews' }));
    await waitFor(() => expect(screen.getByRole('heading', { level: 1, name: 'Journal & Reviews' })).toBeInTheDocument());
    expect(screen.getByText('Journal & Reviews', { selector: '[aria-current="page"]' })).toBeInTheDocument();
  });

  it('navigates the global New journal entry command with a truthful form instruction', async () => {
    render(
      <MemoryRouter initialEntries={['/trades']}>
        <ToastProvider>
          <AppShell><div>Trade page content</div></AppShell>
        </ToastProvider>
      </MemoryRouter>,
    );
    await userEvent.click(screen.getByRole('button', { name: 'Search or run a command' }));
    const dialog = screen.getByRole('dialog', { name: 'Search or run a command' });
    await userEvent.click(within(dialog).getByRole('option', { name: /New journal entry/ }));
    await waitFor(() => expect(screen.getByRole('heading', { level: 1, name: 'Journal & Reviews' })).toBeInTheDocument());
  });

  it('mirrors breadcrumb direction in RTL while retaining stable responsive structure', async () => {
    document.documentElement.setAttribute('dir', 'rtl');
    render(
      <MemoryRouter initialEntries={['/trades']}>
        <ToastProvider>
          <AppShell><div>Trade page content</div></AppShell>
        </ToastProvider>
      </MemoryRouter>,
    );

    const breadcrumb = screen.getByRole('navigation', { name: 'Breadcrumb' });
    await waitFor(() => expect(breadcrumb).toHaveAttribute('data-direction', 'rtl'));
    expect(breadcrumb.querySelector('[data-breadcrumb-direction="previous"]')).toBeInTheDocument();
    expect(screen.getByRole('banner').firstElementChild).toHaveClass('compact:flex-row');
    expect(screen.getByLabelText('Page controls')).toHaveClass('flex-wrap', 'compact:justify-end');
  });
});
