import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { investmentsApi } from '../api/investments.js';
import { InvestmentValueChart } from '../components/portfolio/InvestmentValueChart.jsx';
import { CurrencySummary, InvestmentWorkspaceFrame, money } from '../components/portfolio/InvestmentWorkspace.jsx';
import { Card } from '../components/ui/Card.jsx';
import { Field, Input } from '../components/ui/FormControls.jsx';
import { EmptyState, ErrorState } from '../components/ui/States.jsx';
import { Skeleton } from '../components/ui/Skeleton.jsx';

function PerformanceContent({ accountId }) {
  const { t } = useTranslation();
  const [range, setRange] = useState({ from: '', to: '' });
  const params = useMemo(() => ({ ...(accountId ? { accountId } : {}), ...(range.from ? { from: range.from } : {}), ...(range.to ? { to: range.to } : {}) }), [accountId, range]);
  const query = useQuery({ queryKey: ['investments', 'performance', params], queryFn: () => investmentsApi.performance(params), retry: false });
  if (query.isLoading) return <Skeleton className="h-96" label={t('investments.loadingPerformance')} />;
  if (query.isError) return <ErrorState title={t('investments.performanceFailed')} detail={t('investments.loadFailedDetail')} onRetry={query.refetch} />;
  const data = query.data;
  return <>
    <section className="rounded-lg border border-information bg-information-soft p-4" role="note"><h2 className="font-semibold text-primary">{t('investments.manualPriceBasis')}</h2><p className="mt-1 text-sm text-secondary">{t('investments.performanceBoundary')}</p></section>
    <section aria-labelledby="performance-period"><h2 id="performance-period" className="sr-only">{t('investments.period')}</h2><Card density="compact"><div className="grid gap-3 adaptive:grid-cols-2"><Field id="performance-from" label={t('investments.fromDate')}>{(props) => <Input {...props} type="date" dir="ltr" value={range.from} onChange={(event) => setRange((current) => ({ ...current, from: event.target.value }))} />}</Field><Field id="performance-to" label={t('investments.toDate')}>{(props) => <Input {...props} type="date" dir="ltr" value={range.to} onChange={(event) => setRange((current) => ({ ...current, to: event.target.value }))} />}</Field></div></Card></section>
    {data.current.map((group) => <CurrencySummary key={group.currency} group={group} />)}
    {data.series.length ? <section aria-labelledby="performance-history"><h2 id="performance-history" className="mb-3 text-sm font-semibold text-primary">{t('investments.performanceHistory')}</h2><div className="grid gap-4">{[...new Set(data.series.map((item) => item.currency))].map((currency) => <InvestmentValueChart key={currency} series={data.series} currency={currency} />)}</div><Card className="mt-4 overflow-x-auto p-0"><table className="w-full min-w-[900px] text-sm"><thead className="bg-surface-raised text-xs text-muted"><tr>{['date', 'currency', 'cashBalance', 'netContributions', 'realizedPnl', 'unrealizedPnl', 'dividendIncome', 'fees', 'totalValue'].map((key) => <th key={key} scope="col" className="px-3 py-2 text-start">{t(key === 'date' ? 'common.date' : key === 'fees' ? 'common.fees' : `investments.${key}`)}</th>)}</tr></thead><tbody>{data.series.map((point) => <tr key={`${point.currency}-${point.date}`} className="border-t border-default"><td className="px-3 py-3 font-mono" dir="ltr">{point.date}</td><td className="px-3 py-3 font-mono" dir="ltr">{point.currency}</td>{['cashBalance', 'netContributions', 'realizedPnl', 'unrealizedPnl', 'dividendIncome', 'totalFees', 'totalValue'].map((key) => <td key={key} className="px-3 py-3 font-mono" dir="ltr">{money(point[key], point.currency, key === 'realizedPnl' || key === 'unrealizedPnl')}</td>)}</tr>)}</tbody></table></Card></section> : <EmptyState title={t('investments.noPerformance')} detail={t('investments.noPerformanceDetail')} />}
  </>;
}

export default function InvestmentPerformance() { return <InvestmentWorkspaceFrame>{(props) => <PerformanceContent {...props} />}</InvestmentWorkspaceFrame>; }
