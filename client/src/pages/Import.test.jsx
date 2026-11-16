import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import i18n from '../i18n/index.js';
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
afterEach(() => i18n.changeLanguage('en'));

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
    api.commitImport.mockClear();
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

  it('blocks the duplicate account while allowing a different owned account', async () => {
    api.listAccounts.mockResolvedValue([
      { id: 'account-a', status: 'active', company: 'A', accountNumber: '1' },
      { id: 'account-b', status: 'active', company: 'B', accountNumber: '2' },
    ]);
    const preview = await api.parseImport();
    api.parseImport.mockResolvedValue({ ...preview, duplicateRun: { id: 'prior', account: { id: 'account-a' } } });
    const user = userEvent.setup();
    renderPage();
    await user.click(screen.getByRole('button', { name: 'Tradovate' }));
    await user.upload(screen.getByLabelText('CSV File'), new File(['symbol'], 'same.csv', { type: 'text/csv' }));
    await user.click(screen.getByRole('button', { name: 'Upload and preview' }));
    const select = await screen.findByRole('combobox');
    await user.selectOptions(select, 'account-a');
    expect(screen.getByRole('button', { name: 'Import 10 trades' })).toBeDisabled();
    await user.selectOptions(select, 'account-b');
    expect(screen.getByRole('button', { name: 'Import 10 trades' })).toBeEnabled();
  });

  it.each(['en', 'he'])('shows gross and unknown trade fees/net separately from sourced aggregates in %s', async locale => {
    await i18n.changeLanguage(locale);
    api.listAccounts.mockResolvedValue([{ id: 'owned', status: 'active', company: 'Synthetic', accountNumber: '1' }]);
    api.parseImport.mockResolvedValue({ previewOnly: false, sessionId: 'preview', plan: { inserted: 0, updated: 1, unchanged: 0, conflicts: [], mappingRequired: false },
      preview: [{ symbol: 'TEST', direction: 'short', pnl_gross: 30, pnl_net: null, fees: null, quantity: 2 }],
      stats: { sourceRowCount: 2, logicalTradeCount: 1, candidateCount: 1, tradesToImport: 0, inFileDuplicates: 0 },
      source: { provider: 'tradovate', environment: 'demo', account: { id: '100', name: 'SYNTHETIC' },
        requestedRange: { from: '2026-11-16', to: '2026-11-16' }, requestedTimezone: 'Asia/Jerusalem', verifiedOffsetMinutes: 120,
        capturedAt: '2026-11-16T15:00:00Z', performanceSha256: 'a'.repeat(64), timestampEvidence: { sharedPairs: 2, sourceRows: 2, comparisonSha256: 'b'.repeat(64) },
        financial: { currency: 'USD', gross: 30, tradingFees: 12, net: 18, sourceRows: 2, uniqueFillCount: 3,
          otherCashAdjustments: {}, summaryCapturedAt: '2026-11-16T15:00:00Z', cashCapturedAt: '2026-11-16T15:00:00Z' } },
    });
    const user = userEvent.setup(); renderPage();
    await user.click(screen.getByRole('button', { name: 'Tradovate' }));
    await user.selectOptions(screen.getByLabelText(i18n.t('capture.inputType')), 'capture');
    const file = new File(['{}'], 'synthetic.capture.json', { type: 'application/json' });
    await user.upload(screen.getByLabelText(i18n.t('capture.file')), file);
    expect(screen.getByRole('button', { name: i18n.t('importPage.upload') })).toBeDisabled();
    await user.selectOptions(screen.getByLabelText(i18n.t('importPage.assignAccount')), 'owned');
    await user.click(screen.getByRole('button', { name: i18n.t('importPage.upload') }));
    expect(await screen.findByRole('heading', { name: i18n.t('capture.title') })).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: i18n.t('common.grossPnl') })).toBeInTheDocument();
    expect(screen.getAllByRole('cell', { name: i18n.t('capture.unknown') })).toHaveLength(2);
    const withoutBidi = content => content.replace(/[\u2066-\u2069]/g, '');
    expect(screen.getByText(content => withoutBidi(content) === '12.00 USD')).toBeInTheDocument();
    expect(screen.getByText(content => withoutBidi(content) === '18.00 USD')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: i18n.t('capture.confirmImport') })).toBeDisabled();
    expect(api.parseImport).toHaveBeenLastCalledWith('tradovate', file, { format: 'capture', accountId: 'owned' });
    expect(api.commitImport).not.toHaveBeenCalled();
    await user.click(screen.getByRole('checkbox', { name: i18n.t('capture.confirmMapping') }));
    expect(screen.getByRole('button', { name: i18n.t('capture.confirmImport') })).toBeEnabled();
    api.commitImport.mockResolvedValue({ runId: 'saved', status: 'completed', inserted: 0, updated: 1, importedRows: 1, skippedRows: 1 });
    await user.click(screen.getByRole('button', { name: i18n.t('capture.confirmImport') }));
    expect(api.commitImport).toHaveBeenCalledWith('preview', 'owned');
    expect(document.documentElement.dir).toBe(locale === 'he' ? 'rtl' : 'ltr');
  });

  it('surfaces contradictory metadata inline without entering preview', async () => {
    api.listAccounts.mockResolvedValue([{ id: 'owned', status: 'active', company: 'Synthetic', accountNumber: '1' }]);
    api.parseImport.mockRejectedValue({ response: { data: { error: { code: 'CAPTURE_OFFSET_CONFLICT' } } } });
    const user = userEvent.setup(); renderPage();
    await user.click(screen.getByRole('button', { name: 'Tradovate' }));
    await user.selectOptions(screen.getByLabelText('Import source'), 'capture');
    await user.selectOptions(screen.getByLabelText(i18n.t('importPage.assignAccount')), 'owned');
    await user.upload(screen.getByLabelText('Capture package (.capture.json)'), new File(['{}'], 'bad.capture.json', { type: 'application/json' }));
    await user.click(screen.getByRole('button', { name: 'Upload and preview' }));
    expect((await screen.findAllByText(i18n.t('captureErrors.CAPTURE_OFFSET_CONFLICT'))).length).toBeGreaterThan(0);
    expect(screen.queryByRole('heading', { name: 'Source-aware capture preview' })).not.toBeInTheDocument();
  });

  it('shows a specific reconciliation conflict and blocks confirmation',async()=>{
    api.listAccounts.mockResolvedValue([{id:'owned',status:'active',company:'Synthetic',accountNumber:'1'}]);
    const basic=await api.parseImport();
    api.parseImport.mockResolvedValue({...basic,source:{provider:'tradovate',environment:'demo',account:{id:'100',name:'SYNTHETIC'},requestedRange:{from:'2026-11-16',to:'2026-11-16'},verifiedOffsetMinutes:120,requestedTimezone:'Asia/Jerusalem',timestampEvidence:{sharedPairs:2,sourceRows:2},financial:null},plan:{inserted:0,updated:0,unchanged:0,conflicts:[{code:'CAPTURE_LEGACY_OVERLAP',message:'Legacy overlap'}]}});
    const user=userEvent.setup();renderPage();await user.click(screen.getByRole('button',{name:'Tradovate'}));
    await user.selectOptions(screen.getByLabelText('Import source'),'capture');await user.selectOptions(screen.getByLabelText(i18n.t('importPage.assignAccount')),'owned');
    await user.upload(screen.getByLabelText(i18n.t('capture.file')),new File(['{}'],'conflict.capture.json',{type:'application/json'}));await user.click(screen.getByRole('button',{name:'Upload and preview'}));
    expect(await screen.findByText('CAPTURE_LEGACY_OVERLAP')).toBeInTheDocument();
    expect(screen.getByRole('button',{name:i18n.t('capture.confirmImport')})).toBeDisabled();expect(screen.queryByRole('checkbox')).not.toBeInTheDocument();expect(api.commitImport).not.toHaveBeenCalled();
  });
});
