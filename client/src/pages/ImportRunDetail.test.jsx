import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import i18n from '../i18n/index.js';

const api = vi.hoisted(() => ({ get: vi.fn() }));
vi.mock('../api/imports.js', () => ({ getImportRun: api.get }));
import ImportRunDetail from './ImportRunDetail.jsx';

const run = {
  id: '550e8400-e29b-41d4-a716-446655440000', originalFilename: 'august-review.csv', fileSizeBytes: 2048,
  sourceType: 'tradovate', status: 'completed_with_errors', totalRows: 3, importedRows: 1, skippedRows: 1, failedRows: 1,
  startedAt: '2026-08-04T10:00:00Z', completedAt: '2026-08-04T10:00:08Z', mapping: { importer: 'tradovate' },
  account: { id: 'account-1', name: 'Main Account' }, rows: [
    { rowNumber: 2, status: 'imported', tradeId: 'trade-1', tradeAvailable: true, symbol: 'NQ', sourceIdentifier: 'source-1' },
    { rowNumber: 3, status: 'skipped_duplicate', tradeId: null, symbol: 'ES', errorCode: 'IMPORT_ROW_DUPLICATE' },
    { rowNumber: 4, status: 'failed_validation', tradeId: null, symbol: 'MNQ', errorCode: 'IMPORT_ROW_VALIDATION_FAILED' },
  ],
};

function renderDetail() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(<QueryClientProvider client={client}><MemoryRouter initialEntries={[`/import/history/${run.id}`]}><Routes><Route path="/import/history/:runId" element={<ImportRunDetail />} /><Route path="/trades/:id" element={<p>Trade destination</p>} /></Routes></MemoryRouter></QueryClientProvider>);
}

describe('Import Run detail', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    api.get.mockImplementation((_id, params = {}) => Promise.resolve({
      ...run,
      rowTotal: run.rows.filter(row => !params.rowStatus || row.status === params.rowStatus || (params.rowStatus === 'failed' && row.status.startsWith('failed_'))).length,
      rows: run.rows.filter(row => !params.rowStatus || row.status === params.rowStatus || (params.rowStatus === 'failed' && row.status.startsWith('failed_'))),
    }));
  });

  it('renders safe summary, mapping, localized statuses, and owned links without raw rows', async () => {
    renderDetail();
    expect(await screen.findByText('august-review.csv')).toHaveAttribute('dir', 'auto');
    expect(screen.getByText('Completed with errors')).toBeInTheDocument();
    expect(screen.getAllByText('tradovate')).toHaveLength(2);
    expect(screen.getByRole('link', { name: 'View linked Trade' })).toHaveAttribute('href', '/trades/trade-1');
    expect(document.body).not.toHaveTextContent('raw CSV');
  });

  it('filters row results without losing the durable run summary', async () => {
    renderDetail();
    await screen.findByText('august-review.csv');
    await userEvent.click(screen.getByRole('button', { name: 'Skipped' }));
    expect(screen.getByText('ES')).toBeInTheDocument();
    expect(screen.queryByText('NQ')).not.toBeInTheDocument();
    expect(screen.getByText('august-review.csv')).toBeInTheDocument();
  });

  it('shows unavailable text rather than a broken Trade link', async () => {
    api.get.mockResolvedValue({ ...run, rows: [{ ...run.rows[0], tradeAvailable: false }] });
    renderDetail();
    expect(await screen.findByText('The linked Trade is no longer available.')).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'View linked Trade' })).not.toBeInTheDocument();
  });

  it('uses Hebrew labels and keeps symbols and row numbers LTR-safe', async () => {
    await i18n.changeLanguage('he');
    renderDetail();
    expect(await screen.findByText(i18n.t('importHistory.status.completed_with_errors'))).toBeInTheDocument();
    expect(screen.getByText('NQ')).toHaveAttribute('dir', 'ltr');
    expect(screen.getByText('#2')).toHaveAttribute('dir', 'ltr');
  });
});
