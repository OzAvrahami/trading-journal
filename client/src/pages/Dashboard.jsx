import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { format, startOfMonth, startOfWeek } from 'date-fns';
import { Bank, Plus } from '@phosphor-icons/react';
import { analyticsApi } from '../api/analytics.js';
import { accountsApi } from '../api/accounts.js';
import { SummaryCards } from '../components/analytics/SummaryCards.jsx';
import { EquityCurve } from '../components/analytics/EquityCurve.jsx';
import { PnLHistogram } from '../components/analytics/PnLHistogram.jsx';
import { BreakdownChart } from '../components/analytics/BreakdownChart.jsx';
import { TradingCalendar } from '../components/analytics/TradingCalendar.jsx';
import { QuickAddModal } from '../components/trades/QuickAddModal.jsx';
import { Button } from '../components/ui/Button.jsx';
import { EmptyState, ErrorState } from '../components/ui/States.jsx';
import { Skeleton } from '../components/ui/Skeleton.jsx';
import { RouteHeaderControls } from '../components/layout/HeaderControls.jsx';

const DEFAULT_FROM = format(startOfMonth(new Date()), 'yyyy-MM-dd');
const DEFAULT_TO = format(new Date(), 'yyyy-MM-dd');
const PERIODS = [
  { id: 'today', label: 'Today' },
  { id: 'wtd', label: 'WTD' },
  { id: 'mtd', label: 'MTD' },
  { id: 'custom', label: 'Custom' },
];

function periodRange(period) {
  const today = new Date();
  const to = format(today, 'yyyy-MM-dd');
  if (period === 'today') return { from: to, to };
  if (period === 'wtd') return { from: format(startOfWeek(today, { weekStartsOn: 1 }), 'yyyy-MM-dd'), to };
  return { from: format(startOfMonth(today), 'yyyy-MM-dd'), to };
}

function MetricsSkeleton() {
  return (
    <section className="space-y-3" aria-label="Loading Dashboard metrics">
      <div className="grid grid-cols-2 gap-3 compact:grid-cols-4">
        {Array.from({ length: 4 }, (_, index) => <Skeleton key={index} className="h-24" label={`Loading primary metric ${index + 1}`} />)}
      </div>
      <div className="grid grid-cols-2 gap-3 adaptive:grid-cols-3 wide:grid-cols-6">
        {Array.from({ length: 6 }, (_, index) => <Skeleton key={index} className="h-20" label={`Loading performance metric ${index + 1}`} />)}
      </div>
    </section>
  );
}

export default function Dashboard() {
  const [dateRange, setDateRange] = useState({ from: DEFAULT_FROM, to: DEFAULT_TO });
  const [breakdownBy, setBreakdownBy] = useState('strategy');
  const [addOpen, setAddOpen] = useState(false);
  const [scope, setScope] = useState({ type: 'all' });
  const [period, setPeriod] = useState('mtd');

  const accountsQuery = useQuery({ queryKey: ['accounts'], queryFn: accountsApi.list });
  const accounts = accountsQuery.data ?? [];
  const companies = useMemo(() => [...new Set(accounts.map(account => account.company).filter(Boolean))].sort(), [accounts]);

  const qParams = useMemo(() => {
    const base = { from: dateRange.from, to: dateRange.to };
    if (scope.type === 'account') return { ...base, accountId: scope.id };
    if (scope.type === 'company') return { ...base, company: scope.name };
    return base;
  }, [dateRange, scope]);

  const summaryQuery = useQuery({
    queryKey: ['analytics', 'summary', qParams],
    queryFn: () => analyticsApi.summary(qParams),
  });
  const equityQuery = useQuery({
    queryKey: ['analytics', 'equity-curve', qParams],
    queryFn: () => analyticsApi.equityCurve(qParams),
  });
  const distributionQuery = useQuery({
    queryKey: ['analytics', 'distribution', qParams],
    queryFn: () => analyticsApi.distribution(qParams),
  });
  const breakdownQuery = useQuery({
    queryKey: ['analytics', 'breakdown', qParams, breakdownBy],
    queryFn: () => analyticsApi.breakdown({ ...qParams, by: breakdownBy }),
  });

  const analyticsQueries = [summaryQuery, equityQuery, distributionQuery, breakdownQuery];
  const fullFailure = analyticsQueries.every(query => query.isError);
  const refreshing = analyticsQueries.some(query => query.isFetching && !query.isLoading);
  const noClosedTrades = summaryQuery.isSuccess && (summaryQuery.data?.totals?.tradesClosed ?? 0) === 0;

  function retryAnalytics() {
    return Promise.all(analyticsQueries.map(query => query.refetch()));
  }

  function handleAccountChange(event) {
    const value = event.target.value;
    setScope(value ? { type: 'account', id: value } : { type: 'all' });
  }

  function handleCompanyChange(event) {
    const value = event.target.value;
    setScope(value ? { type: 'company', name: value } : { type: 'all' });
  }

  function applyPeriod(nextPeriod) {
    setPeriod(nextPeriod);
    if (nextPeriod !== 'custom') setDateRange(periodRange(nextPeriod));
  }

  function updateCustomDate(key, value) {
    setPeriod('custom');
    setDateRange((range) => ({ ...range, [key]: value }));
  }

  function accountLabel(account) {
    const base = `${account.company} — ${account.accountNumber}`;
    return account.accountName ? `${base} (${account.accountName})` : base;
  }

  return (
    <div className="space-y-4 adaptive:space-y-5">
      <RouteHeaderControls
        slot="dashboardScope"
        commands={[{ id: 'addTrade', label: 'Add trade', description: 'Open the existing trade form', keywords: 'new quick add', Icon: Plus, action: () => setAddOpen(true) }]}
      >
        <div className="flex w-full flex-wrap items-center gap-2 compact:w-auto compact:justify-end">
          <label className="relative flex w-full items-center adaptive:w-56">
            <Bank size={15} className="pointer-events-none absolute start-2.5 text-muted" aria-hidden="true" />
            <span className="sr-only">Account</span>
            <select
              aria-label="Account"
              value={scope.type === 'account' ? scope.id : ''}
              onChange={handleAccountChange}
              disabled={accountsQuery.isLoading}
              className="input min-h-11 ps-8 adaptive:min-h-9"
              dir="ltr"
            >
              <option value="">All accounts</option>
              {accounts.map((account) => <option key={account.id} value={account.id}>{accountLabel(account)}</option>)}
            </select>
          </label>

          {scope.type !== 'account' && companies.length > 1 && (
            <label className="w-full adaptive:w-40">
              <span className="sr-only">Company</span>
              <select aria-label="Company" value={scope.type === 'company' ? scope.name : ''} onChange={handleCompanyChange} className="input min-h-11 adaptive:min-h-9" dir="ltr">
                <option value="">All companies</option>
                {companies.map((company) => <option key={company} value={company}>{company}</option>)}
              </select>
            </label>
          )}

          <div role="group" aria-label="Dashboard period" className="flex min-h-11 flex-1 gap-0.5 rounded-md border border-default bg-surface-sunken p-0.5 adaptive:min-h-9 adaptive:flex-none">
            {PERIODS.map((item) => (
              <button
                key={item.id}
                type="button"
                aria-pressed={period === item.id}
                onClick={() => applyPeriod(item.id)}
                className={`min-w-12 flex-1 rounded-sm px-2 font-mono text-xs transition-colors adaptive:flex-none ${period === item.id ? 'bg-surface font-semibold text-primary shadow-flat' : 'text-muted hover:text-primary'}`}
              >
                {item.label}
              </button>
            ))}
          </div>

          {period === 'custom' && (
            <div className="flex w-full gap-2 adaptive:w-auto" aria-label="Custom dashboard dates">
              <label className="min-w-0 flex-1 adaptive:w-36 adaptive:flex-none">
                <span className="sr-only">Start date</span>
                <input aria-label="Start date" type="date" value={dateRange.from} onChange={(event) => updateCustomDate('from', event.target.value)} className="input min-h-11 font-mono text-end adaptive:min-h-9" dir="ltr" />
              </label>
              <label className="min-w-0 flex-1 adaptive:w-36 adaptive:flex-none">
                <span className="sr-only">End date</span>
                <input aria-label="End date" type="date" value={dateRange.to} onChange={(event) => updateCustomDate('to', event.target.value)} className="input min-h-11 font-mono text-end adaptive:min-h-9" dir="ltr" />
              </label>
            </div>
          )}

          <Button variant="primary" size="mobile" className="adaptive:min-h-9" leadingIcon={<Plus size={16} aria-hidden="true" />} onClick={() => setAddOpen(true)}>
            Add Trade
          </Button>
        </div>
      </RouteHeaderControls>

      {accountsQuery.isError && (
        <div className="text-xs text-negative" role="alert">
          Account options could not be loaded. Period controls and all-account analytics remain available.{' '}
          <button type="button" className="font-medium underline" onClick={() => accountsQuery.refetch()}>Retry accounts</button>
        </div>
      )}

      {refreshing && <p className="text-xs text-muted" role="status">Refreshing Dashboard data…</p>}

      {summaryQuery.isLoading ? <MetricsSkeleton /> : summaryQuery.isError && !fullFailure ? (
        <ErrorState title="Performance metrics could not be loaded" detail="Summary KPIs are unavailable for the selected scope." available="Filters, Add Trade, and any successful charts" onRetry={summaryQuery.refetch} />
      ) : <SummaryCards data={summaryQuery.data} />}

      {noClosedTrades && (
        <EmptyState
          title="No closed trades in this period"
          detail="Choose another date range or add a trade to start building your performance history."
        />
      )}

      {noClosedTrades ? (
        <>
          {equityQuery.isError && <EquityCurve error={equityQuery.error} onRetry={equityQuery.refetch} />}
          {distributionQuery.isError && <PnLHistogram error={distributionQuery.error} onRetry={distributionQuery.refetch} />}
          {breakdownQuery.isError && (
            <BreakdownChart accounts={accounts} by={breakdownBy} onByChange={setBreakdownBy} error={breakdownQuery.error} onRetry={breakdownQuery.refetch} />
          )}
          <TradingCalendar qParams={qParams} errorsOnly />
        </>
      ) : fullFailure ? (
        <ErrorState title="Dashboard analytics could not be loaded" detail="Summary metrics and all chart queries failed for the selected scope." available="Filters, Add Trade, and the independently loaded calendar" onRetry={retryAnalytics} />
      ) : (
        <>
          <EquityCurve data={equityQuery.data?.data} isLoading={equityQuery.isLoading} error={equityQuery.error} onRetry={equityQuery.refetch} />
          <div className="grid grid-cols-1 gap-4 compact:grid-cols-2">
            <TradingCalendar qParams={qParams} />
            <PnLHistogram data={distributionQuery.data?.buckets} isLoading={distributionQuery.isLoading} error={distributionQuery.error} onRetry={distributionQuery.refetch} />
          </div>
          <BreakdownChart
            data={breakdownQuery.data?.data}
            accounts={accounts}
            by={breakdownBy}
            onByChange={setBreakdownBy}
            isLoading={breakdownQuery.isLoading}
            error={breakdownQuery.error}
            onRetry={breakdownQuery.refetch}
          />
        </>
      )}

      {fullFailure && <TradingCalendar qParams={qParams} />}
      <QuickAddModal open={addOpen} onClose={() => setAddOpen(false)} />
    </div>
  );
}
