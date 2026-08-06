import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import i18n from '../../i18n/index.js';
import { InvestmentWorkspaceFrame } from './InvestmentWorkspace.jsx';

const api = vi.hoisted(() => ({ scope: vi.fn() }));
vi.mock('../../api/investments.js', () => ({ investmentsApi: api }));

const accountId = '11111111-1111-4111-8111-111111111111';
const scope = {
  mode: 'account',
  selectedAccount: { accountId, accountName: 'IBKR Growth', company: 'Interactive Brokers', accountNumber: 'U-12345', accountStatus: 'archived', includeInInvestmentValue: false, baseCurrency: 'USD', portfolioId: '22222222-2222-4222-8222-222222222222', portfolioStatus: 'active' },
  accounts: [{ accountId, accountName: 'IBKR Growth', company: 'Interactive Brokers', accountNumber: 'U-12345', accountStatus: 'archived', includeInInvestmentValue: false, baseCurrency: 'USD', portfolioId: '22222222-2222-4222-8222-222222222222', portfolioStatus: 'active' }],
  historicalScope: true,
  unlinkedPortfolios: [],
};

function renderFrame(entry = `/portfolio/holdings?accountId=${accountId}`) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(<QueryClientProvider client={client}><MemoryRouter initialEntries={[entry]}><InvestmentWorkspaceFrame>{() => <section aria-label="Workspace content">Real workspace content</section>}</InvestmentWorkspaceFrame></MemoryRouter></QueryClientProvider>);
}

describe('shared Investment workspace scope', () => {
  beforeEach(() => { api.scope.mockReset(); api.scope.mockResolvedValue({ scope }); });

  it('renders all six keyboard-accessible destinations and preserves account scope', async () => {
    renderFrame();
    expect(await screen.findByText('Real workspace content')).toBeInTheDocument();
    for (const [name, path] of [['Overview', '/portfolio'], ['Holdings', '/portfolio/holdings'], ['Transactions', '/portfolio/transactions'], ['Dividends', '/portfolio/dividends'], ['Portfolio Performance', '/portfolio/performance'], ['Asset Allocation', '/portfolio/allocation']]) {
      expect(screen.getByRole('link', { name })).toHaveAttribute('href', `${path}?accountId=${accountId}`);
    }
    expect(screen.getByText('Historical investment Account')).toBeInTheDocument();
    expect(screen.getAllByText(/U-12345/).some((element) => element.matches('[dir="ltr"]'))).toBe(true);
    expect(api.scope).toHaveBeenCalledWith({ accountId });
  });

  it('renders natural Hebrew labels in RTL without a separate component tree', async () => {
    await i18n.changeLanguage('he');
    document.documentElement.dir = 'rtl';
    renderFrame();
    expect(await screen.findByRole('link', { name: 'אחזקות' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'תנועות' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'דיבידנדים' })).toBeInTheDocument();
    expect(screen.getByLabelText('טווח חשבונות השקעה')).toBeInTheDocument();
    await waitFor(() => expect(document.documentElement).toHaveAttribute('dir', 'rtl'));
  });

  it('shows a truthful scoped error and no workspace content for an inaccessible Account', async () => {
    api.scope.mockRejectedValue({ response: { status: 404 } });
    renderFrame();
    expect(await screen.findByRole('alert')).toHaveTextContent('Investment Account not found');
    expect(screen.queryByText('Real workspace content')).not.toBeInTheDocument();
  });
});
