import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { tradesApi } from '../api/trades.js';
import { accountsApi } from '../api/accounts.js';
import { TradeTable } from '../components/trades/TradeTable.jsx';
import { FilterBar } from '../components/filters/FilterBar.jsx';
import { QuickAddModal } from '../components/trades/QuickAddModal.jsx';
import { Spinner } from '../components/ui/Spinner.jsx';
import { downloadBlob } from '../utils/csvExport.js';
import { useToast } from '../components/ui/Toast.jsx';

const DEFAULT_FILTERS = {
  page: 1,
  limit: 50,
  sort: 'entry_datetime',
  order: 'desc',
};

export default function Trades() {
  const [filters, setFilters] = useState(DEFAULT_FILTERS);
  const [addOpen, setAddOpen] = useState(false);
  const [exporting, setExporting] = useState(false);
  const toast = useToast();

  const { data, isLoading } = useQuery({
    queryKey: ['trades', filters],
    queryFn: () => tradesApi.list(filters),
  });

  const { data: accounts = [] } = useQuery({
    queryKey: ['accounts'],
    queryFn:  accountsApi.list,
  });

  async function handleExport() {
    setExporting(true);
    try {
      const blob = await tradesApi.exportCsv(filters);
      downloadBlob(blob, `trades-${new Date().toISOString().slice(0, 10)}.csv`);
      toast.success('CSV exported!');
    } catch {
      toast.error('Export failed.');
    } finally {
      setExporting(false);
    }
  }

  const pagination = data?.pagination;
  const trades = data?.data ?? [];

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <h1 className="text-2xl font-bold text-gray-100">Trades</h1>
        <div className="flex gap-2">
          <button
            onClick={handleExport}
            disabled={exporting}
            className="btn-secondary text-sm"
          >
            {exporting ? 'Exporting…' : '↓ Export CSV'}
          </button>
          <button onClick={() => setAddOpen(true)} className="btn-primary text-sm">
            + Add Trade
          </button>
        </div>
      </div>

      {/* Filters */}
      <FilterBar filters={filters} onChange={setFilters} />

      {/* Trade count */}
      {pagination && (
        <div className="text-xs text-gray-500">
          Showing {trades.length} of {pagination.total} trades
        </div>
      )}

      {/* Table */}
      {isLoading ? (
        <div className="flex justify-center py-16"><Spinner className="w-8 h-8" /></div>
      ) : (
        <TradeTable trades={trades} accounts={accounts} loading={false} />
      )}

      {/* Pagination */}
      {pagination && pagination.totalPages > 1 && (
        <div className="flex items-center justify-center gap-2 pt-2">
          <button
            disabled={filters.page <= 1}
            onClick={() => setFilters(f => ({ ...f, page: f.page - 1 }))}
            className="btn-secondary text-xs"
          >
            ← Prev
          </button>
          <span className="text-sm text-gray-400">
            Page {pagination.page} of {pagination.totalPages}
          </span>
          <button
            disabled={filters.page >= pagination.totalPages}
            onClick={() => setFilters(f => ({ ...f, page: f.page + 1 }))}
            className="btn-secondary text-xs"
          >
            Next →
          </button>
        </div>
      )}

      <QuickAddModal open={addOpen} onClose={() => setAddOpen(false)} />
    </div>
  );
}
