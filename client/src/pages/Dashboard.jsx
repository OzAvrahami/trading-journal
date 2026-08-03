import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { format, startOfMonth } from 'date-fns';
import { Plus } from '@phosphor-icons/react';
import { analyticsApi } from '../api/analytics.js';
import { accountsApi } from '../api/accounts.js';
import { SummaryCards } from '../components/analytics/SummaryCards.jsx';
import { EquityCurve } from '../components/analytics/EquityCurve.jsx';
import { PnLHistogram } from '../components/analytics/PnLHistogram.jsx';
import { BreakdownChart } from '../components/analytics/BreakdownChart.jsx';
import { TradingCalendar } from '../components/analytics/TradingCalendar.jsx';
import { QuickAddModal } from '../components/trades/QuickAddModal.jsx';
import { Button } from '../components/ui/Button.jsx';
import { Card } from '../components/ui/Card.jsx';
import { Field, Input, Select } from '../components/ui/FormControls.jsx';
import { EmptyState, ErrorState } from '../components/ui/States.jsx';
import { Skeleton } from '../components/ui/Skeleton.jsx';

const DEFAULT_FROM = format(startOfMonth(new Date()), 'yyyy-MM-dd');
const DEFAULT_TO = format(new Date(), 'yyyy-MM-dd');

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

  function accountLabel(account) {
    const base = `${account.company} — ${account.accountNumber}`;
    return account.accountName ? `${base} (${account.accountName})` : base;
  }

  return (
    <div className="space-y-4 adaptive:space-y-5">
      <Card as="section" density="compact" aria-label="Dashboard filters">
        <div className="flex flex-col gap-3 adaptive:flex-row adaptive:flex-wrap adaptive:items-end">
          <Field label="Account" className="w-full adaptive:w-72 wide:w-80">
            {fieldProps => (
              <Select {...fieldProps} value={scope.type === 'account' ? scope.id : ''} onChange={handleAccountChange} disabled={accountsQuery.isLoading} className="min-h-11 adaptive:min-h-9" dir="ltr">
                <option value="">All accounts</option>
                {accounts.map(account => <option key={account.id} value={account.id}>{accountLabel(account)}</option>)}
              </Select>
            )}
          </Field>

          {scope.type !== 'account' && companies.length > 1 ? (
            <Field label="Company" className="w-full adaptive:w-48">
              {fieldProps => (
                <Select {...fieldProps} value={scope.type === 'company' ? scope.name : ''} onChange={handleCompanyChange} className="min-h-11 adaptive:min-h-9" dir="ltr">
                  <option value="">All companies</option>
                  {companies.map(company => <option key={company} value={company}>{company}</option>)}
                </Select>
              )}
            </Field>
          ) : null}

          <Field label="Start date" className="w-full adaptive:w-44">
            {fieldProps => <Input {...fieldProps} type="date" numeric value={dateRange.from} onChange={event => setDateRange(range => ({ ...range, from: event.target.value }))} className="min-h-11 adaptive:min-h-9" />}
          </Field>
          <Field label="End date" className="w-full adaptive:w-44">
            {fieldProps => <Input {...fieldProps} type="date" numeric value={dateRange.to} onChange={event => setDateRange(range => ({ ...range, to: event.target.value }))} className="min-h-11 adaptive:min-h-9" />}
          </Field>
          <Button variant="primary" size="mobile" className="w-full adaptive:w-auto compact:min-h-9" leadingIcon={<Plus size={16} aria-hidden="true" />} onClick={() => setAddOpen(true)}>
            Add Trade
          </Button>
        </div>
        {accountsQuery.isError && (
          <div className="mt-3 text-xs text-negative" role="alert">
            Account options could not be loaded. Date filters and all-account analytics remain available.{' '}
            <button type="button" className="font-medium underline" onClick={() => accountsQuery.refetch()}>Retry accounts</button>
          </div>
        )}
      </Card>

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
