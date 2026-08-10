import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ToastProvider } from '../components/ui/Toast.jsx';

const api = vi.hoisted(() => ({
  parseImport: vi.fn(),
  commitImport: vi.fn(),
  listImportRuns: vi.fn(),
  listAccounts: vi.fn(),
}));

vi.mock('../api/imports.js', () => ({
  parseImport: api.parseImport,
  commitImport: api.commitImport,
  listImportRuns: api.listImportRuns,
}));
vi.mock('../api/accounts.js', () => ({
  accountsApi: { list: api.listAccounts },
}));

import Import from './Import.jsx';

function renderPage() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <ToastProvider>
        <MemoryRouter initialEntries={['/import']}>
          <Import />
        </MemoryRouter>
      </ToastProvider>
    </QueryClientProvider>,
  );
}

describe('Import preview counters', () => {
  beforeEach(() => {
    api.listImportRuns.mockResolvedValue({ runs: [] });
    api.listAccounts.mockResolvedValue([]);
    api.parseImport.mockResolvedValue({
      sessionId: '11111111-1111-4111-8111-111111111111',
      preview: [{ symbol: 'MNQU6', direction: 'short', quantity: 30, pnl_net: 795, fees: 570 }],
      stats: {
        total: 16,
        uniqueInFile: 10,
        inFileDuplicates: 0,
        sourceRowCount: 16,
        logicalTradeCount: 10,
        tradesToImport: 10,
      },
      duplicateRun: null,
    });
  });

  it('distinguishes physical source rows from logical Trades to import', async () => {
    const user = userEvent.setup();
    renderPage();

    await user.click(screen.getByRole('button', { name: 'Tradovate' }));
    await user.upload(screen.getByLabelText('CSV File'), new File(['symbol'], 'sanitized.csv', { type: 'text/csv' }));
    await user.click(screen.getByRole('button', { name: 'Upload and preview' }));

    expect((await screen.findByText('Source rows')).parentElement).toHaveTextContent('16');
    expect(screen.getByText('Logical trades').parentElement).toHaveTextContent('10');
    expect(screen.getByText('Trades to import').parentElement).toHaveTextContent('10');
    expect(screen.getByRole('button', { name: 'Import 10 trades' })).toBeDisabled();
  });
});
