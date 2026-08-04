import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { format, startOfMonth, startOfWeek } from 'date-fns';
import { Bank } from '@phosphor-icons/react';
import { analyticsApi } from '../api/analytics.js';
import { accountsApi } from '../api/accounts.js';
import { AnalyticsBreakdown } from '../components/analytics/AnalyticsBreakdown.jsx';
import { RDistribution } from '../components/analytics/RDistribution.jsx';
import { RouteHeaderControls } from '../components/layout/HeaderControls.jsx';
import { Card } from '../components/ui/Card.jsx';
import { EmptyState, ErrorState } from '../components/ui/States.jsx';
import { Skeleton } from '../components/ui/Skeleton.jsx';

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

function accountLabel(account) {
  const base = `${account.company} — ${account.accountNumber}`;
  return account.accountName ? `${base} (${account.accountName})` : base;
}

function ScopeSummary({ closedTrades, dateRange, scopeLabel, isLoading, error, onRetry }) {
  if (isLoading) return <Skeleton className="h-20 w-full" label="Loading Analytics scope summary" />;
  if (error) return <ErrorState title="Scope summary could not be loaded" detail="The closed-trade count is unavailable." available="Scope controls and any successful analysis widgets" onRetry={onRetry} />;
  return (
    <Card density="compact" aria-label="Analytics scope summary">
      <dl className="grid gap-3 adaptive:grid-cols-3">
        <div>
          <dt className="text-[10px] font-semibold uppercase tracking-wide text-muted">Closed trades</dt>
          <dd className="mt-1 font-mono text-lg font-semibold text-primary" dir="ltr">{closedTrades}</dd>
        </div>
        <div>
          <dt className="text-[10px] font-semibold uppercase tracking-wide text-muted">Date range</dt>
          <dd className="mt-1 font-mono text-sm text-primary" dir="ltr">{dateRange.from || 'Any'} — {dateRange.to || 'Any'}</dd>
        </div>
        <div>
          <dt className="text-[10px] font-semibold uppercase tracking-wide text-muted">Account scope</dt>
          <dd className="mt-1 truncate text-sm text-primary">{scopeLabel}</dd>
        </div>
      </dl>
    </Card>
  );
}

export default function Analytics() {
  const [period, setPeriod] = useState('mtd');
  const [dateRange, setDateRange] = useState(() => periodRange('mtd'));
  const [scope, setScope] = useState({ type: 'all' });
  const [dimension, setDimension] = useState('market');

  const accountsQuery = useQuery({ queryKey: ['accounts'], queryFn: accountsApi.list });
  const accounts = accountsQuery.data ?? [];
  const companies = useMemo(() => [...new Set(accounts.map((account) => account.company).filter(Boolean))].sort(), [accounts]);
  const selectedAccount = scope.type === 'account' ? accounts.find((account) => account.id === scope.id) : null;

  const qParams = useMemo(() => {
    const base = {};
    if (dateRange.from) base.from = dateRange.from;
    if (dateRange.to) base.to = dateRange.to;
    if (scope.type === 'account') return { ...base, accountId: scope.id };
    if (scope.type === 'company') return { ...base, company: scope.name };
    return base;
  }, [dateRange, scope]);

  const summaryQuery = useQuery({
    queryKey: ['analytics', 'insights-summary', qParams],
    queryFn: () => analyticsApi.summary(qParams),
    placeholderData: (previous) => previous,
  });
  const breakdownQuery = useQuery({
    queryKey: ['analytics', 'insights-breakdown', qParams, dimension],
    queryFn: () => analyticsApi.breakdown({ ...qParams, by: dimension }),
    placeholderData: (previous) => previous,
  });
  const rDistributionQuery = useQuery({
    queryKey: ['analytics', 'r-distribution', qParams],
    queryFn: () => analyticsApi.rDistribution(qParams),
    placeholderData: (previous) => previous,
  });

  const analyticsQueries = [summaryQuery, breakdownQuery, rDistributionQuery];
  const fullFailure = analyticsQueries.every((query) => query.isError);
  const noClosedTrades = summaryQuery.isSuccess && !summaryQuery.isPlaceholderData && (summaryQuery.data?.totals?.tradesClosed ?? 0) === 0;
  const closedTrades = summaryQuery.data?.totals?.tradesClosed ?? 0;
  const scopeLabel = selectedAccount ? accountLabel(selectedAccount) : scope.type === 'company' ? scope.name : 'All accounts';

  function applyPeriod(nextPeriod) {
    setPeriod(nextPeriod);
    if (nextPeriod !== 'custom') setDateRange(periodRange(nextPeriod));
  }

  function updateCustomDate(key, value) {
    setPeriod('custom');
    setDateRange((current) => ({ ...current, [key]: value }));
  }

  function handleAccountChange(event) {
    setScope(event.target.value ? { type: 'account', id: event.target.value } : { type: 'all' });
  }

  function handleCompanyChange(event) {
    setScope(event.target.value ? { type: 'company', name: event.target.value } : { type: 'all' });
  }

  function retryAnalytics() {
    return Promise.all(analyticsQueries.map((query) => query.refetch()));
  }

  return (
    <div className="space-y-4 adaptive:space-y-5">
      <RouteHeaderControls slot="analyticsScope">
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

          <div role="group" aria-label="Analytics period" className="flex min-h-11 flex-1 gap-0.5 rounded-md border border-default bg-surface-sunken p-0.5 adaptive:min-h-9 adaptive:flex-none">
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
            <div className="flex w-full gap-2 adaptive:w-auto" aria-label="Custom Analytics dates">
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
        </div>
      </RouteHeaderControls>

      {accountsQuery.isError && (
        <p className="text-xs text-negative" role="alert">
          Account options could not be loaded. All-account Analytics remains available.{' '}
          <button type="button" className="font-medium underline" onClick={() => accountsQuery.refetch()}>Retry accounts</button>
        </p>
      )}

      {fullFailure ? (
        <ErrorState title="Analytics could not be loaded" detail="The scope summary, dimension analysis, and R distribution all failed." available="Account and period controls" onRetry={retryAnalytics} />
      ) : (
        <>
          <ScopeSummary
            closedTrades={closedTrades}
            dateRange={dateRange}
            scopeLabel={scopeLabel}
            isLoading={summaryQuery.isLoading}
            error={summaryQuery.error}
            onRetry={summaryQuery.refetch}
          />

          {noClosedTrades ? (
            <EmptyState title="No closed trades in this scope" detail="Choose another account or date range to analyze recorded outcomes." />
          ) : (
            <>
              <AnalyticsBreakdown
                data={breakdownQuery.data?.data}
                accounts={accounts}
                by={dimension}
                onByChange={setDimension}
                isLoading={breakdownQuery.isLoading}
                isFetching={breakdownQuery.isFetching}
                error={breakdownQuery.error}
                onRetry={breakdownQuery.refetch}
              />
              <RDistribution
                data={rDistributionQuery.data}
                isLoading={rDistributionQuery.isLoading}
                isFetching={rDistributionQuery.isFetching && !rDistributionQuery.isLoading}
                error={rDistributionQuery.error}
                onRetry={rDistributionQuery.refetch}
              />
            </>
          )}
        </>
      )}
    </div>
  );
}
