import { useQuery } from '@tanstack/react-query';
import { Link, NavLink, useLocation, useSearchParams } from 'react-router-dom';
import { WarningCircle } from '@phosphor-icons/react';
import { useTranslation } from 'react-i18next';
import { investmentsApi } from '../../api/investments.js';
import { Badge } from '../ui/Badge.jsx';
import { Card } from '../ui/Card.jsx';
import { EmptyState, ErrorState } from '../ui/States.jsx';
import { Skeleton } from '../ui/Skeleton.jsx';
import { ValueIndicator } from '../ui/ValueIndicator.jsx';
import { useUserTimezone } from '../../hooks/useUserTimezone.js';
import { formatCurrency, formatDate, formatDatetime, formatNumber, formatPct, formatSignedCurrency } from '../../utils/formatters.js';

export const workspaceRoutes = [
  ['/portfolio', 'navigation.investmentsOverview'],
  ['/portfolio/holdings', 'navigation.investmentsHoldings'],
  ['/portfolio/transactions', 'navigation.investmentsTransactions'],
  ['/portfolio/dividends', 'navigation.investmentsDividends'],
  ['/portfolio/performance', 'navigation.investmentsPerformance'],
  ['/portfolio/allocation', 'navigation.investmentsAllocation'],
];

export function money(value, currency, signed = false) {
  if (value == null) return '—';
  return (signed ? formatSignedCurrency : formatCurrency)(value, { currency });
}

export function Metric({ label, value, muted = false }) {
  return <div><dt className="text-xs text-muted">{label}</dt><dd className={`mt-1 whitespace-nowrap font-mono text-lg font-semibold ${muted ? 'text-muted' : 'text-primary'}`} dir="ltr">{value}</dd></div>;
}

export function ScopeIdentity({ account }) {
  if (!account) return null;
  return <span className="min-w-0"><span className="block truncate" dir="auto">{account.accountName || account.company}</span><span className="block truncate font-mono text-xs text-muted" dir="ltr">{account.accountNumber} · {account.baseCurrency}</span></span>;
}

export function useInvestmentScope() {
  const [searchParams, setSearchParams] = useSearchParams();
  const accountId = searchParams.get('accountId') || '';
  const query = useQuery({
    queryKey: ['investments', 'scope', accountId],
    queryFn: () => investmentsApi.scope(accountId ? { accountId } : {}),
    retry: false,
  });
  const setAccountId = (nextId) => {
    const next = new URLSearchParams(searchParams);
    if (nextId) next.set('accountId', nextId); else next.delete('accountId');
    next.delete('offset');
    setSearchParams(next, { replace: true });
  };
  return { accountId, query, setAccountId, searchParams };
}

export function InvestmentWorkspaceFrame({ children }) {
  const { t } = useTranslation();
  const location = useLocation();
  const scopeState = useInvestmentScope();
  const { query, accountId, setAccountId } = scopeState;
  if (query.isLoading) return <div className="space-y-4"><Skeleton className="h-20" label={t('investments.loadingScope')} /><Skeleton className="h-72" label={t('common.loading')} /></div>;
  if (query.isError) {
    const invalid = query.error?.response?.status === 400;
    const missing = query.error?.response?.status === 404;
    return <ErrorState title={t(invalid ? 'investments.invalidScope' : missing ? 'investments.scopeNotFound' : 'investments.scopeFailed')} detail={t('investments.scopeFailedDetail')} onRetry={query.refetch} />;
  }
  const scope = query.data.scope;
  const querySuffix = accountId ? `?accountId=${encodeURIComponent(accountId)}` : '';
  return <div className="space-y-5">
    <section aria-labelledby="investment-scope-heading" className="flex flex-wrap items-end justify-between gap-3">
      <div><h2 id="investment-scope-heading" className="text-sm font-semibold text-primary">{t('investments.accountScope')}</h2><p className="mt-1 text-xs text-muted">{t('investments.scopeHelp')}</p></div>
      <label className="w-full adaptive:w-80"><span className="label">{t('investments.accountScope')}</span><select className="input min-h-11" value={accountId} onChange={(event) => setAccountId(event.target.value)}><option value="">{t('investments.allAccounts')}</option>{scope.accounts.map((account) => <option key={account.accountId} value={account.accountId}>{account.accountName || account.company} · {account.accountNumber} · {account.baseCurrency}{account.accountStatus !== 'active' ? ` · ${t('status.archived')}` : !account.includeInInvestmentValue ? ` · ${t('investments.excluded')}` : ''}</option>)}</select>{scope.selectedAccount && <span className="mt-1 block text-xs text-muted"><span dir="auto">{scope.selectedAccount.accountName || scope.selectedAccount.company}</span> · <span className="font-mono" dir="ltr">{scope.selectedAccount.accountNumber} · {scope.selectedAccount.baseCurrency}</span></span>}</label>
    </section>
    <nav aria-label={t('investments.workspaceNavigation')} className="flex gap-1 overflow-x-auto border-b border-default pb-px">
      {workspaceRoutes.map(([to, label]) => <NavLink key={to} to={`${to}${querySuffix}`} end className={({ isActive }) => `inline-flex min-h-11 shrink-0 items-center border-b-2 px-3 text-sm ${isActive ? 'border-action font-semibold text-action' : 'border-transparent text-secondary hover:text-primary'}`}>{t(label)}</NavLink>)}
    </nav>
    {scope.historicalScope && <section className="rounded-lg border border-warning bg-warning-soft p-4" role="status"><div className="flex items-start gap-3"><WarningCircle size={19} className="shrink-0 text-warning" aria-hidden="true" /><div><h2 className="font-semibold text-primary">{t('investments.historicalScope')}</h2><p className="mt-1 text-sm text-secondary">{t('investments.historicalScopeDetail')}</p></div></div></section>}
    {!scope.accounts.length && !accountId && <EmptyState title={t('investments.noAccounts')} detail={t('investments.noAccountsDetail')} action={<Link className="inline-flex min-h-11 items-center rounded-md bg-action px-4 text-sm font-semibold text-on-action" to="/accounts">{t('settings.manageAccounts')}</Link>} />}
    {(scope.accounts.length || accountId) ? children({ ...scopeState, scope, querySuffix, pathname: location.pathname }) : null}
  </div>;
}

export function CurrencySummary({ group }) {
  const { t } = useTranslation();
  return <Card density="compact"><div className="flex flex-wrap items-center justify-between gap-2"><h3 className="font-semibold text-primary" dir="ltr">{group.currency}</h3><div className="flex flex-wrap gap-2">{group.livePriceCount > 0 && <Badge variant="information">{t('investments.liveValuation')}</Badge>}{group.manualPriceCount > 0 && <Badge>{t('investments.manualFallback')}</Badge>}{!group.valuationAvailable && <Badge variant="warning">{t('investments.valuationUnavailable')}</Badge>}</div></div><dl className="mt-4 grid grid-cols-2 gap-4 adaptive:grid-cols-4 wide:grid-cols-6"><Metric label={t('investments.totalValue')} value={money(group.totalValue, group.currency)} muted={!group.valuationAvailable} /><Metric label={t('investments.cashBalance')} value={money(group.cashBalance, group.currency)} /><Metric label={t('investments.costBasis')} value={money(group.totalCostBasis, group.currency)} /><Metric label={t('investments.marketValue')} value={money(group.marketValue, group.currency)} muted={!group.valuationAvailable} /><Metric label={t('investments.realizedPnl')} value={money(group.realizedPnl, group.currency, true)} /><Metric label={t('investments.unrealizedPnl')} value={money(group.unrealizedPnl, group.currency, true)} muted={!group.valuationAvailable} />{'unrealizedReturnPercent' in group && <Metric label={t('portfolio.unrealizedReturn')} value={group.unrealizedReturnPercent == null ? '—' : formatPct(group.unrealizedReturnPercent)} muted={!group.valuationAvailable} />}{'dailyPnl' in group && <Metric label={t('investments.portfolioDailyPnl')} value={money(group.dailyPnl, group.currency, true)} muted={!group.dailyChangeAvailable} />}<Metric label={t('investments.dividendIncome')} value={money(group.dividendIncome, group.currency)} /><Metric label={t('common.fees')} value={money(group.totalFees, group.currency)} /><Metric label={t('investments.netContributions')} value={money(group.netContributions, group.currency)} /><Metric label={t('investments.positions')} value={formatNumber(group.positionCount)} /><Metric label={t('investments.accountCount')} value={formatNumber(group.accountCount)} /><Metric label={t('investments.missingPrices')} value={formatNumber(group.missingPriceCount)} /></dl></Card>;
}

function liveNumber(value, { percent = false } = {}) {
  if (value == null || value === '') return '—';
  const numericValue = Number(value);
  if (!Number.isFinite(numericValue)) return '—';
  return formatNumber(percent ? numericValue / 100 : numericValue, {
    ...(percent ? { style: 'percent' } : {}),
    minimumFractionDigits: 2,
    maximumFractionDigits: percent ? 2 : 4,
    signDisplay: numericValue > 0 ? 'always' : 'auto',
  });
}

export function PositionSummary({ item, actions, quote = null, quoteStatus = null }) {
  const { t } = useTranslation();
  const timezone = useUserTimezone();
  const quoteCandidate = item.liveQuote ?? quote;
  const liveQuote = quoteCandidate && Number.isFinite(Number(quoteCandidate.price)) && Number(quoteCandidate.price) > 0 ? quoteCandidate : null;
  const valuationPrice = item.valuationPrice ?? liveQuote?.price ?? item.latestPrice ?? null;
  return <Card density="compact" as="article">
    <div className="flex items-start justify-between gap-3"><div className="min-w-0"><strong className="font-mono text-primary" dir="ltr">{item.symbol}</strong><p className="truncate text-sm text-secondary" dir="auto">{item.name || t(`portfolio.assetTypes.${item.assetType}`)}</p><p className="mt-1 text-xs text-muted" dir="auto">{item.accountName || item.accountCompany}</p></div><Badge>{t(`portfolio.assetTypes.${item.assetType}`)}</Badge></div>
    {liveQuote && <section className="mt-4 rounded-md bg-information-soft p-3" aria-label={t('investments.liveMarketData')}>
      <div className="flex flex-wrap items-center justify-between gap-2"><h4 className="text-xs font-semibold text-primary">{t('investments.liveMarketData')}</h4><Badge variant="information">{t('investments.liveQuote')}</Badge></div>
      <dl className="mt-3 grid grid-cols-3 gap-3">
        <Metric label={t('investments.dayChange')} value={<ValueIndicator value={liveQuote.change}>{money(liveQuote.change, item.currency, true)}</ValueIndicator>} />
        <Metric label={t('investments.dayChangePercent')} value={<ValueIndicator value={liveQuote.changePercent}>{liveNumber(liveQuote.changePercent, { percent: true })}</ValueIndicator>} />
        <Metric label={t('investments.holdingDailyPnl')} value={<ValueIndicator value={item.dailyPnl}>{money(item.dailyPnl, item.currency, true)}</ValueIndicator>} />
      </dl>
      <p className="mt-3 text-xs text-muted">{t('investments.quoteAsOf')}: <span dir="ltr">{formatDatetime(liveQuote.asOf, { timezone })}</span></p>
      <p className="mt-1 text-xs text-secondary">{t('investments.liveQuoteDisclaimer')}</p>
    </section>}
    {!liveQuote && quoteStatus === 'missing' && <p className="mt-4 rounded-md bg-surface-sunken p-3 text-xs text-muted" role="status">{t(item.valuationAvailable ? 'investments.liveQuoteMissing' : 'investments.marketPriceUnavailable')}</p>}
    <dl className="mt-4 grid grid-cols-2 gap-3"><Metric label={t('common.quantity')} value={formatNumber(item.quantity, { maximumFractionDigits: 8 })} /><Metric label={t('portfolio.averageCost')} value={money(item.averageCost, item.currency)} /><Metric label={t('portfolio.costBasis')} value={money(item.costBasis, item.currency)} /><Metric label={t('investments.currentMarketPrice')} value={money(valuationPrice, item.currency)} muted={!item.valuationAvailable} /><Metric label={t('portfolio.marketValue')} value={money(item.marketValue, item.currency)} muted={!item.valuationAvailable} /><Metric label={t('portfolio.unrealizedPnl')} value={money(item.unrealizedPnl, item.currency, true)} muted={!item.valuationAvailable} /><Metric label={t('portfolio.unrealizedReturn')} value={item.unrealizedReturnPercent == null ? '—' : formatPct(item.unrealizedReturnPercent)} muted={!item.valuationAvailable} /><Metric label={t('portfolio.dividendIncome')} value={money(item.dividendIncome, item.currency)} /></dl>
    {item.valuationSource === 'manual' && <p className="mt-3 text-xs text-muted">{t('investments.manualValuationFallback')} <span dir="ltr">{formatDate(item.valuationAsOf ?? item.latestPriceDate)}</span></p>}
    {item.valuationSource === 'unavailable' && <p className="mt-3 text-xs text-muted">{t('investments.marketPriceUnavailable')}</p>}
    {!item.valuationSource && <p className="mt-3 text-xs text-muted">{t('portfolio.priceDate')}: <span dir="ltr">{formatDate(item.latestPriceDate)}</span></p>}
    {actions && <div className="mt-3 flex flex-wrap justify-end gap-2 border-t border-default pt-3">{actions}</div>}
  </Card>;
}
