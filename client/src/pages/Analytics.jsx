import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Bank } from '@phosphor-icons/react';
import { analyticsApi } from '../api/analytics.js';
import { accountsApi } from '../api/accounts.js';
import { AnalyticsBreakdown } from '../components/analytics/AnalyticsBreakdown.jsx';
import { RDistribution } from '../components/analytics/RDistribution.jsx';
import { RouteHeaderControls } from '../components/layout/HeaderControls.jsx';
import { Card } from '../components/ui/Card.jsx';
import { EmptyState, ErrorState } from '../components/ui/States.jsx';
import { Skeleton } from '../components/ui/Skeleton.jsx';
import { periodRange } from '../utils/dateOnly.js';
import { useUserTimezone } from '../hooks/useUserTimezone.js';
import { useTranslation } from 'react-i18next';

const PERIODS = [
  { id: 'today', labelKey: 'dashboard.today' },
  { id: 'wtd', labelKey: 'dashboard.wtd' },
  { id: 'mtd', labelKey: 'dashboard.mtd' },
  { id: 'custom', labelKey: 'dashboard.custom' },
];

function accountLabel(account) {
  const base = `${account.company} — ${account.accountNumber}`;
  return account.accountName ? `${base} (${account.accountName})` : base;
}

function ScopeSummary({ closedTrades, dateRange, scopeLabel, timezone, isLoading, error, onRetry }) {
  const { t } = useTranslation();
  if (isLoading) return <Skeleton className="h-20 w-full" label={t('analytics.loadingScope')} />;
  if (error) return <ErrorState title={t('analytics.scopeFailed')} detail={t('analytics.closedUnavailable')} available={t('analytics.scopeAvailable')} onRetry={onRetry} />;
  return (
    <Card density="compact" aria-label={t('analytics.scopeSummary')}>
      <dl className="grid gap-3 adaptive:grid-cols-4">
        <div>
          <dt className="text-[10px] font-semibold uppercase tracking-wide text-muted">{t('analytics.closedTrades')}</dt>
          <dd className="mt-1 font-mono text-lg font-semibold text-primary" dir="ltr">{closedTrades}</dd>
        </div>
        <div>
          <dt className="text-[10px] font-semibold uppercase tracking-wide text-muted">{t('analytics.dateRange')}</dt>
          <dd className="mt-1 font-mono text-sm text-primary" dir="ltr">{dateRange.from || 'Any'} — {dateRange.to || 'Any'}</dd>
        </div>
        <div>
          <dt className="text-[10px] font-semibold uppercase tracking-wide text-muted">{t('analytics.accountScope')}</dt>
          <dd className="mt-1 truncate text-sm text-primary">{scopeLabel}</dd>
        </div>
        <div>
          <dt className="text-[10px] font-semibold uppercase tracking-wide text-muted">{t('analytics.calendarTimezone')}</dt>
          <dd className="mt-1 whitespace-nowrap font-mono text-sm text-primary" dir="ltr">{timezone}</dd>
        </div>
      </dl>
    </Card>
  );
}

export default function Analytics() {
  const { t } = useTranslation();
  const timezone = useUserTimezone();
  const [period, setPeriod] = useState('mtd');
  const [dateRange, setDateRange] = useState(() => periodRange('mtd', timezone));
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
  const scopeLabel = selectedAccount ? accountLabel(selectedAccount) : scope.type === 'company' ? scope.name : t('common.allAccounts');
  const mixedCurrencies = summaryQuery.data?.isMixedCurrency === true;

  function applyPeriod(nextPeriod) {
    setPeriod(nextPeriod);
    if (nextPeriod !== 'custom') setDateRange(periodRange(nextPeriod, timezone));
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
            <span className="sr-only">{t('common.account')}</span>
            <select
              aria-label={t('common.account')}
              value={scope.type === 'account' ? scope.id : ''}
              onChange={handleAccountChange}
              disabled={accountsQuery.isLoading}
              className="input min-h-11 ps-8 adaptive:min-h-9"
              dir="ltr"
            >
              <option value="">{t('common.allAccounts')}</option>
              {accounts.map((account) => <option key={account.id} value={account.id}>{accountLabel(account)}</option>)}
            </select>
          </label>

          {scope.type !== 'account' && companies.length > 1 && (
            <label className="w-full adaptive:w-40">
              <span className="sr-only">{t('common.company')}</span>
              <select aria-label={t('common.company')} value={scope.type === 'company' ? scope.name : ''} onChange={handleCompanyChange} className="input min-h-11 adaptive:min-h-9" dir="ltr">
                <option value="">{t('analytics.allCompanies')}</option>
                {companies.map((company) => <option key={company} value={company}>{company}</option>)}
              </select>
            </label>
          )}

          <div role="group" aria-label={t('analytics.period')} className="flex min-h-11 flex-1 gap-0.5 rounded-md border border-default bg-surface-sunken p-0.5 adaptive:min-h-9 adaptive:flex-none">
            {PERIODS.map((item) => (
              <button
                key={item.id}
                type="button"
                aria-pressed={period === item.id}
                onClick={() => applyPeriod(item.id)}
                className={`min-w-12 flex-1 rounded-sm px-2 font-mono text-xs transition-colors adaptive:flex-none ${period === item.id ? 'bg-surface font-semibold text-primary shadow-flat' : 'text-muted hover:text-primary'}`}
              >
                {t(item.labelKey)}
              </button>
            ))}
          </div>

          {period === 'custom' && (
            <div className="flex w-full gap-2 adaptive:w-auto" aria-label={t('analytics.customDates')}>
              <label className="min-w-0 flex-1 adaptive:w-36 adaptive:flex-none">
                <span className="sr-only">{t('goals.startDate')}</span>
                <input aria-label={t('goals.startDate')} type="date" value={dateRange.from} onChange={(event) => updateCustomDate('from', event.target.value)} className="input min-h-11 font-mono text-end adaptive:min-h-9" dir="ltr" />
              </label>
              <label className="min-w-0 flex-1 adaptive:w-36 adaptive:flex-none">
                <span className="sr-only">{t('goals.endDate')}</span>
                <input aria-label={t('goals.endDate')} type="date" value={dateRange.to} onChange={(event) => updateCustomDate('to', event.target.value)} className="input min-h-11 font-mono text-end adaptive:min-h-9" dir="ltr" />
              </label>
            </div>
          )}
        </div>
      </RouteHeaderControls>

      {accountsQuery.isError && (
        <p className="text-xs text-negative" role="alert">
          {t('analytics.accountsLoadFailed')}{' '}
          <button type="button" className="font-medium underline" onClick={() => accountsQuery.refetch()}>{t('analytics.retryAccounts')}</button>
        </p>
      )}

      {fullFailure ? (
        <ErrorState title={t('analytics.loadFailed')} detail={t('analytics.loadFailedDetail')} available={t('analytics.controlsAvailable')} onRetry={retryAnalytics} />
      ) : (
        <>
          <ScopeSummary
            closedTrades={closedTrades}
            dateRange={dateRange}
            scopeLabel={scopeLabel}
            timezone={timezone}
            isLoading={summaryQuery.isLoading}
            error={summaryQuery.error}
            onRetry={summaryQuery.refetch}
          />

          {mixedCurrencies && <div role="status" className="rounded-lg border border-information bg-information-soft p-3 text-sm text-secondary"><p className="font-semibold text-primary">{t('analytics.mixedCurrencies')}</p><p className="mt-1">{t('analytics.mixedCurrenciesDetail')}</p></div>}

          {noClosedTrades ? (
            <EmptyState title={t('analytics.noClosedScope')} detail={t('analytics.noClosedScopeDetail')} />
          ) : (
            <>
              {!mixedCurrencies && <AnalyticsBreakdown
                data={breakdownQuery.data?.data}
                accounts={accounts}
                by={dimension}
                onByChange={setDimension}
                isLoading={breakdownQuery.isLoading}
                isFetching={breakdownQuery.isFetching}
                error={breakdownQuery.error}
                onRetry={breakdownQuery.refetch}
              />}
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
