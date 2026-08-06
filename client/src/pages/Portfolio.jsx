import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link, useSearchParams } from 'react-router-dom';
import { Bank, WarningCircle } from '@phosphor-icons/react';
import { useTranslation } from 'react-i18next';
import { portfolioApi } from '../api/portfolio.js';
import { Badge } from '../components/ui/Badge.jsx';
import { Button } from '../components/ui/Button.jsx';
import { Card } from '../components/ui/Card.jsx';
import { EmptyState, ErrorState } from '../components/ui/States.jsx';
import { Skeleton } from '../components/ui/Skeleton.jsx';
import { formatCurrency, formatDate, formatNumber, formatSignedCurrency } from '../utils/formatters.js';

function money(value, currency, signed = false) { return value == null ? '—' : (signed ? formatSignedCurrency : formatCurrency)(value, { currency }); }
function Metric({ label, value, dir = 'ltr' }) { return <div><dt className="text-xs text-muted">{label}</dt><dd className="mt-1 whitespace-nowrap font-mono text-lg font-semibold text-primary" dir={dir}>{value}</dd></div>; }

function InvestmentAccountCard({ portfolio }) {
  const { t } = useTranslation();
  const account = portfolio.tradingAccount;
  const name = account?.accountName || account?.company || portfolio.name;
  return <Card as="article"><div className="flex flex-wrap items-start justify-between gap-3"><div className="min-w-0"><Link to={`/portfolio/${portfolio.id}`} className="text-base font-semibold text-primary hover:text-action" dir="auto">{name}</Link>{account && <><p className="mt-1 text-sm text-secondary" dir="auto">{account.company}</p><p className="mt-1 font-mono text-xs text-muted" dir="ltr">{account.accountNumber}</p></>}<div className="mt-2 flex flex-wrap gap-2"><Badge variant={account?.status === 'active' ? 'positive' : 'neutral'}>{t(`status.${account?.status || portfolio.status}`)}</Badge><Badge>{t('accounts.includedInInvestments')}</Badge><Badge><span dir="ltr">{portfolio.baseCurrency}</span></Badge></div></div><Bank size={22} className="text-muted" aria-hidden="true" /></div>
    <dl className="mt-5 grid grid-cols-2 gap-4 adaptive:grid-cols-3"><Metric label={t('portfolio.positions')} value={formatNumber(portfolio.positionCount)} /><Metric label={t('portfolio.cashBalance')} value={money(portfolio.cashBalance, portfolio.baseCurrency)} /><Metric label={t('portfolio.marketValue')} value={portfolio.valuationAvailable ? money(portfolio.marketValue, portfolio.baseCurrency) : '—'} /><Metric label={t('portfolio.totalValue')} value={portfolio.valuationAvailable ? money(portfolio.totalValue, portfolio.baseCurrency) : '—'} /><Metric label={t('portfolio.realizedPnl')} value={money(portfolio.realizedPnl, portfolio.baseCurrency, true)} /><Metric label={t('portfolio.unrealizedPnl')} value={portfolio.valuationAvailable ? money(portfolio.unrealizedPnl, portfolio.baseCurrency, true) : '—'} /><Metric label={t('portfolio.dividendIncome')} value={money(portfolio.dividendIncome, portfolio.baseCurrency)} /></dl>
    {!portfolio.valuationAvailable && <p className="mt-4 rounded-md bg-warning-soft p-2 text-xs text-secondary" role="status">{t('portfolio.missingPriceCount', { count: portfolio.missingPriceCount })}</p>}
    <div className="mt-4 flex flex-wrap items-center justify-between gap-2 border-t border-default pt-3"><span className="text-xs text-muted">{t('portfolio.lastTransaction')}: <span dir="ltr">{formatDate(portfolio.lastTransactionDate)}</span></span><Link to={`/portfolio/${portfolio.id}`} className="inline-flex min-h-11 items-center justify-center rounded-md border border-strong bg-surface-raised px-3 text-sm font-medium text-primary hover:bg-surface-sunken">{t('accounts.openInvestments')}</Link></div></Card>;
}

export default function Portfolio() {
  const { t } = useTranslation();
  const [searchParams, setSearchParams] = useSearchParams();
  const query = useQuery({ queryKey: ['portfolios', { includeArchived: true }], queryFn: () => portfolioApi.list({ includeArchived: 'true' }) });
  const portfolios = query.data?.portfolios || [];
  const linkedEnabled = portfolios.filter(item => item.tradingAccount?.includeInInvestmentValue && item.tradingAccount.status === 'active' && item.status === 'active');
  const archivedLinked = portfolios.filter(item => item.tradingAccountId && item.tradingAccount?.includeInInvestmentValue && (item.tradingAccount.status !== 'active' || item.status !== 'active'));
  const unlinked = portfolios.filter(item => !item.tradingAccountId);
  const requestedAccount = searchParams.get('accountId') || '';
  const selectedAccount = linkedEnabled.some(item => item.tradingAccountId === requestedAccount) ? requestedAccount : '';
  const visible = selectedAccount ? linkedEnabled.filter(item => item.tradingAccountId === selectedAccount) : linkedEnabled;
  const grouped = useMemo(() => {
    const map = new Map();
    for (const item of visible) {
      const group = map.get(item.baseCurrency) || { currency: item.baseCurrency, cashBalance: 0, marketValue: 0, totalValue: 0, realizedPnl: 0, unrealizedPnl: 0, dividendIncome: 0, positions: 0, valuationAvailable: true };
      group.cashBalance += item.cashBalance; group.realizedPnl += item.realizedPnl; group.dividendIncome += item.dividendIncome; group.positions += item.positionCount;
      if (item.valuationAvailable) { group.marketValue += item.marketValue; group.totalValue += item.totalValue; group.unrealizedPnl += item.unrealizedPnl; } else group.valuationAvailable = false;
      map.set(item.baseCurrency, group);
    }
    return [...map.values()];
  }, [visible]);
  if (query.isLoading) return <div className="space-y-4"><Skeleton className="h-24" label={t('portfolio.loading')} /><Skeleton className="h-64" label={t('portfolio.loading')} /></div>;
  if (query.isError) return <ErrorState title={t('portfolio.loadFailed')} detail={t('portfolio.loadFailedDetail')} onRetry={query.refetch} />;
  return <div className="space-y-6">
    <section aria-labelledby="investment-scope"><div className="flex flex-wrap items-end justify-between gap-3"><div><h2 id="investment-scope" className="text-sm font-semibold text-primary">{t('portfolio.investmentAccounts')}</h2><p className="mt-1 text-xs text-muted">{t('portfolio.accountOrientedHelp')}</p></div>{linkedEnabled.length > 0 && <label className="w-full adaptive:w-72"><span className="label">{t('portfolio.accountScope')}</span><select className="input min-h-11" value={selectedAccount} onChange={event => setSearchParams(event.target.value ? { accountId: event.target.value } : {}, { replace: true })}><option value="">{t('portfolio.allInvestmentAccounts')}</option>{linkedEnabled.map(item => <option key={item.tradingAccountId} value={item.tradingAccountId}>{item.tradingAccount.accountName || item.tradingAccount.company}</option>)}</select></label>}</div></section>
    {grouped.length > 0 && <section aria-labelledby="investments-summary"><h2 id="investments-summary" className="sr-only">{t('portfolio.summary')}</h2><div className="grid gap-3 adaptive:grid-cols-2">{grouped.map(group => <Card key={group.currency} density="compact"><div className="flex items-center justify-between"><h3 className="font-semibold text-primary" dir="ltr">{group.currency}</h3>{grouped.length > 1 && <Badge>{t('portfolio.noFxConversion')}</Badge>}</div><dl className="mt-3 grid grid-cols-2 gap-3 adaptive:grid-cols-4"><Metric label={t('portfolio.positions')} value={formatNumber(group.positions)} /><Metric label={t('portfolio.cashBalance')} value={money(group.cashBalance, group.currency)} /><Metric label={t('portfolio.marketValue')} value={group.valuationAvailable ? money(group.marketValue, group.currency) : '—'} /><Metric label={t('portfolio.totalValue')} value={group.valuationAvailable ? money(group.totalValue, group.currency) : '—'} /><Metric label={t('portfolio.realizedPnl')} value={money(group.realizedPnl, group.currency, true)} /><Metric label={t('portfolio.unrealizedPnl')} value={group.valuationAvailable ? money(group.unrealizedPnl, group.currency, true) : '—'} /><Metric label={t('portfolio.dividendIncome')} value={money(group.dividendIncome, group.currency)} /></dl>{!group.valuationAvailable && <p className="mt-3 text-xs text-warning">{t('portfolio.totalUnavailable')}</p>}</Card>)}</div></section>}
    {!linkedEnabled.length ? <EmptyState title={t('portfolio.noInvestmentAccounts')} detail={t('portfolio.noInvestmentAccountsDetail')} action={<Link to="/accounts" className="inline-flex min-h-11 items-center rounded-md bg-action px-4 text-sm font-semibold text-on-action">{t('settings.manageAccounts')}</Link>} /> : <section aria-labelledby="investment-account-list"><h2 id="investment-account-list" className="mb-3 text-sm font-semibold text-primary">{t('portfolio.investmentAccounts')}</h2><div className="grid gap-4 wide:grid-cols-2">{visible.map(item => <InvestmentAccountCard key={item.id} portfolio={item} />)}</div></section>}
    {archivedLinked.length > 0 && <section aria-labelledby="archived-investment-accounts"><h2 id="archived-investment-accounts" className="mb-3 text-sm font-semibold text-primary">{t('portfolio.archivedInvestmentAccounts')}</h2><div className="grid gap-4 wide:grid-cols-2">{archivedLinked.map(item => <InvestmentAccountCard key={item.id} portfolio={item} />)}</div></section>}
    {unlinked.length > 0 && <section aria-labelledby="unlinked-portfolios" className="rounded-lg border border-warning bg-warning-soft p-4"><div className="flex items-start gap-3"><WarningCircle size={20} className="shrink-0 text-warning" aria-hidden="true" /><div><h2 id="unlinked-portfolios" className="font-semibold text-primary">{t('accounts.unlinkedInvestmentData')}</h2><p className="mt-1 text-sm text-secondary">{t('accounts.unlinkedInvestmentDataDetail')}</p></div></div><div className="mt-4 grid gap-3 adaptive:grid-cols-2">{unlinked.map(item => <Card key={item.id} density="compact"><h3 className="font-semibold" dir="auto">{item.name}</h3><p className="mt-1 text-xs text-muted" dir="ltr">{item.baseCurrency}</p><div className="mt-3 flex flex-wrap gap-2"><Link to={`/portfolio/${item.id}`} className="inline-flex min-h-11 items-center rounded-md border border-default px-3 text-sm font-medium text-primary">{t('common.view')}</Link><Link to={`/accounts?linkPortfolioId=${encodeURIComponent(item.id)}`} className="inline-flex min-h-11 items-center rounded-md bg-action px-3 text-sm font-medium text-on-action">{t('accounts.linkToAccount')}</Link></div></Card>)}</div><p className="mt-3 text-xs text-muted">{t('accounts.noAutomaticMatching')}</p></section>}
  </div>;
}
