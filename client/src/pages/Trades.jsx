import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { DownloadSimple, Plus } from '@phosphor-icons/react';
import { tradesApi } from '../api/trades.js';
import { accountsApi } from '../api/accounts.js';
import { TradeTable } from '../components/trades/TradeTable.jsx';
import { DEFAULT_TRADE_FILTERS, FilterBar, getActiveTradeFilterKeys } from '../components/filters/FilterBar.jsx';
import { QuickAddModal } from '../components/trades/QuickAddModal.jsx';
import { Button } from '../components/ui/Button.jsx';
import { EmptyState, ErrorState } from '../components/ui/States.jsx';
import { Skeleton } from '../components/ui/Skeleton.jsx';
import { downloadBlob } from '../utils/csvExport.js';
import { useToast } from '../components/ui/Toast.jsx';
import { RouteHeaderControls } from '../components/layout/HeaderControls.jsx';
import { useUserTimezone } from '../hooks/useUserTimezone.js';
import { useTranslation } from 'react-i18next';

function TradesSkeleton() {
  const { t } = useTranslation();
  return (
    <div aria-label={t('trades.loading')} className="space-y-3">
      <div className="hidden overflow-hidden rounded-lg border border-default bg-surface adaptive:block">
        <div className="grid grid-cols-6 gap-3 border-b border-default p-3">
          {Array.from({ length: 6 }, (_, index) => <Skeleton key={index} className="h-4" label={t('trades.loadingHeader')} />)}
        </div>
        {Array.from({ length: 5 }, (_, row) => (
          <div key={row} className="grid grid-cols-6 gap-3 border-b border-default p-3 last:border-0">
            {Array.from({ length: 6 }, (_, cell) => <Skeleton key={cell} className="h-5" label={t('trades.loadingRow')} />)}
          </div>
        ))}
      </div>
      <div className="grid gap-3 adaptive:hidden">
        {Array.from({ length: 3 }, (_, index) => (
          <div key={index} className="rounded-lg border border-default bg-surface p-4">
            <Skeleton className="h-5 w-2/3" label={t('trades.loadingCard')} />
            <Skeleton className="mt-4 h-14" label={t('trades.loadingDetails')} />
          </div>
        ))}
      </div>
    </div>
  );
}

export default function Trades() {
  const { t } = useTranslation();
  const timezone = useUserTimezone();
  const [filters, setFilters] = useState(DEFAULT_TRADE_FILTERS);
  const [addOpen, setAddOpen] = useState(false);
  const [exporting, setExporting] = useState(false);
  const toast = useToast();
  const navigate = useNavigate();

  const tradesQuery = useQuery({
    queryKey: ['trades', filters],
    queryFn: () => tradesApi.list(filters),
  });

  const { data: accounts = [] } = useQuery({
    queryKey: ['accounts'],
    queryFn: accountsApi.list,
  });

  async function handleExport() {
    setExporting(true);
    try {
      const blob = await tradesApi.exportCsv(filters);
      downloadBlob(blob, `trades-${new Date().toISOString().slice(0, 10)}.csv`);
      toast.success(t('trades.csvExported', { defaultValue: 'CSV exported!' }));
    } catch {
      toast.error(t('trades.exportFailed'));
    } finally {
      setExporting(false);
    }
  }

  function clearFilters() {
    setFilters({ ...DEFAULT_TRADE_FILTERS });
  }

  function handleSort(field) {
    setFilters((current) => ({
      ...current,
      sort: field,
      order: current.sort === field && current.order === 'asc' ? 'desc' : 'asc',
      page: 1,
    }));
  }

  const data = tradesQuery.data;
  const pagination = data?.pagination;
  const trades = data?.data ?? [];
  const hasActiveFilters = getActiveTradeFilterKeys(filters).length > 0;
  const hasUsableData = Boolean(data);
  const rangeStart = pagination?.total ? ((pagination.page - 1) * pagination.limit) + 1 : 0;
  const rangeEnd = pagination?.total ? Math.min(rangeStart + trades.length - 1, pagination.total) : 0;

  return (
    <div className="space-y-4">
      <RouteHeaderControls
        slot="tradesActions"
        commands={[
          { id: 'exportTrades', label: t('trades.exportCsv'), description: t('trades.exportCsv'), keywords: 'download csv', Icon: DownloadSimple, action: handleExport },
          { id: 'quickAddTrade', label: t('trades.quickAdd'), description: t('trades.quickAddDescription'), keywords: 'quick fast trade', Icon: Plus, action: () => setAddOpen(true) },
        ]}
      >
        <div className="flex flex-wrap items-center gap-2">
          <Button
            type="button"
            size="mobile"
            className="adaptive:min-h-9"
            loading={exporting}
            disabled={tradesQuery.isLoading}
            leadingIcon={<DownloadSimple size={17} aria-hidden="true" />}
            onClick={handleExport}
          >
            {t('trades.exportCsv')}
          </Button>
          <Button type="button" size="mobile" className="adaptive:min-h-9" onClick={() => setAddOpen(true)}>
            {t('trades.quickAdd')}
          </Button>
          <Button type="button" variant="primary" size="mobile" className="adaptive:min-h-9" leadingIcon={<Plus size={17} aria-hidden="true" />} onClick={() => navigate('/trades/new')}>
            {t('trades.newTrade')}
          </Button>
        </div>
      </RouteHeaderControls>

      <FilterBar filters={filters} onChange={setFilters} timezone={timezone} />

      {tradesQuery.isError && hasUsableData && (
        <ErrorState
          title={t('trades.loadFailed')}
          detail={t('trades.noTradesDetail')}
          onRetry={tradesQuery.refetch}
        />
      )}

      {pagination && (
        <div className="flex min-h-8 flex-wrap items-center justify-between gap-2 text-xs text-secondary" role="status" aria-live="polite">
          <span dir="ltr">{t('trades.showing', { defaultValue: `Showing ${rangeStart}–${rangeEnd} of ${pagination.total} trades`, from: rangeStart, to: rangeEnd, total: pagination.total })}</span>
          {tradesQuery.isFetching && !tradesQuery.isLoading && <span className="text-muted">{t('common.loading')}</span>}
        </div>
      )}

      {tradesQuery.isLoading ? (
        <TradesSkeleton />
      ) : tradesQuery.isError && !hasUsableData ? (
        <ErrorState
          title={t('trades.loadFailed')}
          detail={t('trades.noTradesDetail')}
          onRetry={tradesQuery.refetch}
        />
      ) : trades.length === 0 ? (
        <EmptyState
          filtered={hasActiveFilters}
          title={hasActiveFilters ? t('trades.filteredEmpty') : t('trades.noTrades')}
          detail={t('trades.noTradesDetail')}
          onClear={hasActiveFilters ? clearFilters : undefined}
        />
      ) : (
        <TradeTable
          trades={trades}
          accounts={accounts}
          sort={filters.sort}
          order={filters.order}
          onSort={handleSort}
        />
      )}

      {pagination && pagination.totalPages > 1 && (
        <nav className="flex flex-wrap items-center justify-center gap-2 pt-2" aria-label={t('common.trades')}>
          <Button
            type="button"
            size="mobile"
            disabled={filters.page <= 1}
            onClick={() => setFilters((current) => ({ ...current, page: current.page - 1 }))}
          >
            {t('common.previous')}
          </Button>
          <span className="px-2 text-sm text-secondary" aria-current="page" dir="ltr">{t('common.pageOf', { page: pagination.page, pages: pagination.totalPages })}</span>
          <Button
            type="button"
            size="mobile"
            disabled={filters.page >= pagination.totalPages}
            onClick={() => setFilters((current) => ({ ...current, page: current.page + 1 }))}
          >
            {t('common.next')}
          </Button>
        </nav>
      )}

      <QuickAddModal open={addOpen} onClose={() => setAddOpen(false)} />
    </div>
  );
}
