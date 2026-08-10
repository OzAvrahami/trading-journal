import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { ArrowSquareOut, WarningCircle } from '@phosphor-icons/react';
import { useTranslation } from 'react-i18next';
import { investmentsApi } from '../api/investments.js';
import { InvestmentValueChart } from '../components/portfolio/InvestmentValueChart.jsx';
import { CurrencySummary, InvestmentWorkspaceFrame, Metric, PositionSummary, money } from '../components/portfolio/InvestmentWorkspace.jsx';
import { Badge } from '../components/ui/Badge.jsx';
import { Card } from '../components/ui/Card.jsx';
import { EmptyState, ErrorState } from '../components/ui/States.jsx';
import { Skeleton } from '../components/ui/Skeleton.jsx';
import { useInvestmentQuotes } from '../hooks/useInvestmentQuotes.js';
import { valueInvestmentCurrencyGroups, valueInvestmentHoldings } from '../utils/investmentValuation.js';
import { formatDate, formatNumber } from '../utils/formatters.js';

const EMPTY_HOLDINGS = Object.freeze([]);

function OverviewContent({ accountId, scope, querySuffix }) {
  const { t } = useTranslation();
  const query = useQuery({ queryKey: ['investments', 'overview', accountId], queryFn: () => investmentsApi.overview(accountId ? { accountId } : {}), retry: false });
  const holdingsQuery = useQuery({ queryKey: ['investments', 'holdings', accountId], queryFn: () => investmentsApi.holdings(accountId ? { accountId } : {}), enabled: query.isSuccess, retry: false });
  const holdings = holdingsQuery.data?.holdings ?? EMPTY_HOLDINGS;
  const quotesQuery = useInvestmentQuotes(holdings, { enabled: holdingsQuery.isSuccess });
  const valuedHoldings = useMemo(
    () => valueInvestmentHoldings(holdings, quotesQuery.quoteLookup, { accountId: accountId || null }),
    [accountId, holdings, quotesQuery.quoteLookup],
  );
  const currencyGroups = useMemo(
    () => holdingsQuery.isSuccess
      ? valueInvestmentCurrencyGroups(query.data?.currencyGroups ?? [], valuedHoldings)
      : query.data?.currencyGroups ?? [],
    [holdingsQuery.isSuccess, query.data?.currencyGroups, valuedHoldings],
  );
  const topHoldings = useMemo(
    () => holdingsQuery.isSuccess
      ? [...valuedHoldings].sort((left, right) => (right.marketValue ?? -1) - (left.marketValue ?? -1)).slice(0, 5)
      : query.data?.topHoldings ?? [],
    [holdingsQuery.isSuccess, query.data?.topHoldings, valuedHoldings],
  );
  if (query.isLoading) return <div className="space-y-4"><Skeleton className="h-32" label={t('investments.loadingOverview')} /><Skeleton className="h-72" label={t('investments.loadingOverview')} /></div>;
  if (query.isError) return <ErrorState title={t('investments.overviewFailed')} detail={t('investments.loadFailedDetail')} onRetry={query.refetch} />;
  const data = query.data;
  return <>
    <section aria-labelledby="overview-summary"><div className="mb-3"><h2 id="overview-summary" className="text-sm font-semibold text-primary">{t('portfolio.summary')}</h2>{(holdingsQuery.isLoading || quotesQuery.isLoading) && <p className="mt-1 text-xs text-muted" role="status">{t('investments.loadingLiveValuation')}</p>}{(holdingsQuery.isError || quotesQuery.isError) && <p className="mt-1 text-xs text-warning" role="status">{t('investments.liveValuationUnavailable')}</p>}</div><div className="grid gap-3">{currencyGroups.map((group) => <CurrencySummary key={group.currency} group={group} />)}</div></section>
    {currencyGroups.length > 1 && <p className="rounded-md bg-information-soft p-3 text-sm text-secondary" role="note">{t('portfolio.noFxConversion')}</p>}
    {!currencyGroups.length && <EmptyState title={t('investments.noActivity')} detail={t('investments.noActivityDetail')} />}
    {currencyGroups.some((group) => !group.valuationAvailable) && <section className="rounded-lg border border-warning bg-warning-soft p-4" role="status"><div className="flex items-start gap-3"><WarningCircle size={19} className="shrink-0 text-warning" aria-hidden="true" /><div><h2 className="font-semibold text-primary">{t('investments.valuationUnavailable')}</h2><p className="mt-1 text-sm text-secondary">{t('investments.missingPriceDetail')}</p></div></div></section>}
    <section className="grid gap-4 wide:grid-cols-[minmax(0,2fr)_minmax(18rem,1fr)]" aria-label={t('investments.overviewInsights')}><div className="space-y-4">{data.currencyGroups.map((group) => <InvestmentValueChart key={group.currency} series={data.valueHistory} currency={group.currency} compact />)}</div><Card><div className="flex items-center justify-between gap-3"><h2 className="text-sm font-semibold text-primary">{t('investments.dividendSummary')}</h2><Link className="text-sm text-action" to={`/portfolio/dividends${querySuffix}`}>{t('common.viewAll')}</Link></div><dl className="mt-4 grid grid-cols-2 gap-4"><Metric label={t('investments.payments')} value={formatNumber(data.dividendSummary.paymentCount)} />{data.dividendSummary.currencies.map((item) => <Metric key={item.currency} label={`${t('investments.netDividends')} · ${item.currency}`} value={money(item.net, item.currency)} />)}</dl><p className="mt-4 text-xs text-muted">{t('investments.recordedOnly')}</p></Card></section>
    <section aria-labelledby="top-holdings"><div className="mb-3 flex items-center justify-between gap-3"><h2 id="top-holdings" className="text-sm font-semibold text-primary">{t('investments.topHoldings')}</h2><Link className="text-sm text-action" to={`/portfolio/holdings${querySuffix}`}>{t('common.viewAll')}</Link></div>{topHoldings.length ? <div className="grid gap-3 adaptive:grid-cols-2 wide:grid-cols-3">{topHoldings.map((item) => <PositionSummary key={`${item.accountId}-${item.instrumentId}`} item={item} quoteStatus={quotesQuery.isSuccess && !item.liveQuote ? 'missing' : null} />)}</div> : <EmptyState title={t('investments.noHoldings')} detail={t('investments.noHoldingsDetail')} />}</section>
    <section className="grid gap-4 wide:grid-cols-2"><Card><div className="flex items-center justify-between gap-3"><h2 className="text-sm font-semibold text-primary">{t('investments.recentTransactions')}</h2><Link className="text-sm text-action" to={`/portfolio/transactions${querySuffix}`}>{t('common.viewAll')}</Link></div>{data.recentTransactions.length ? <ul className="mt-3 divide-y divide-default">{data.recentTransactions.map((item) => <li key={item.id} className="flex min-h-14 items-center gap-3 py-2"><Badge>{t(`portfolio.transactionTypes.${item.transactionType}`)}</Badge><span className="min-w-0 flex-1"><span className="block truncate font-mono text-sm" dir="ltr">{item.instrumentSymbol || item.currency}</span><span className="block truncate text-xs text-muted" dir="auto">{item.accountName || item.accountCompany}</span></span><span className="font-mono text-xs" dir="ltr">{formatDate(item.transactionDate)}</span></li>)}</ul> : <p className="mt-4 text-sm text-muted">{t('portfolio.noTransactions')}</p>}</Card><Card><div className="flex items-center justify-between gap-3"><h2 className="text-sm font-semibold text-primary">{t('investments.allocationPreview')}</h2><Link className="text-sm text-action" to={`/portfolio/allocation${querySuffix}`}>{t('common.viewAll')}</Link></div>{data.allocationPreview.map((group) => <div key={group.currency} className="mt-4"><div className="mb-2 flex justify-between text-xs"><span dir="ltr">{group.currency}</span><span>{group.valuationAvailable ? t('investments.completeValuation') : t('investments.allocationUnavailable')}</span></div><div className="flex h-3 overflow-hidden rounded-full bg-surface-sunken" aria-hidden="true">{group.valuationAvailable && group.cashVersusInvested.map((item, index) => <span key={item.key} className={index ? 'bg-comparison' : 'bg-action'} style={{ width: `${(item.percentage || 0) * 100}%` }} />)}</div></div>)}</Card></section>
    {scope.accounts.length > 0 && <section aria-labelledby="investment-accounts"><h2 id="investment-accounts" className="mb-3 text-sm font-semibold text-primary">{t('portfolio.investmentAccounts')}</h2><div className="grid gap-3 adaptive:grid-cols-2 wide:grid-cols-3">{scope.accounts.filter((item) => !accountId || item.accountId === accountId).map((item) => <Card key={item.accountId} density="compact"><h3 className="font-semibold text-primary" dir="auto">{item.accountName || item.company}</h3><p className="mt-1 text-sm text-secondary" dir="auto">{item.company}</p><p className="mt-1 font-mono text-xs text-muted" dir="ltr">{item.accountNumber} · {item.baseCurrency}</p><Link className="mt-3 inline-flex min-h-11 items-center gap-2 text-sm font-medium text-action" to={`/portfolio/${item.portfolioId}`}><ArrowSquareOut size={16} aria-hidden="true" />{t('accounts.openInvestments')}</Link></Card>)}</div></section>}
    {scope.unlinkedPortfolios.length > 0 && <section aria-labelledby="unlinked-investments" className="rounded-lg border border-warning bg-warning-soft p-4"><h2 id="unlinked-investments" className="font-semibold text-primary">{t('accounts.unlinkedInvestmentData')}</h2><p className="mt-1 text-sm text-secondary">{t('accounts.unlinkedInvestmentDataDetail')}</p><div className="mt-4 grid gap-3 adaptive:grid-cols-2">{scope.unlinkedPortfolios.map((item) => <Card key={item.id} density="compact"><h3 className="font-semibold" dir="auto">{item.name}</h3><p className="mt-1 text-xs text-muted" dir="ltr">{item.baseCurrency}</p><div className="mt-3 flex flex-wrap gap-3"><Link className="inline-flex min-h-11 items-center text-sm font-medium text-action" to={`/portfolio/${item.id}`}>{t('common.view')}</Link><Link className="inline-flex min-h-11 items-center text-sm font-medium text-action" to={`/accounts?linkPortfolioId=${encodeURIComponent(item.id)}`}>{t('accounts.linkToAccount')}</Link></div></Card>)}</div></section>}
  </>;
}

export default function Portfolio() {
  return <InvestmentWorkspaceFrame>{(props) => <OverviewContent {...props} />}</InvestmentWorkspaceFrame>;
}
