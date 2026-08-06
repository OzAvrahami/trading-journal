import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from 'recharts';
import { useTranslation } from 'react-i18next';
import { investmentsApi } from '../api/investments.js';
import { InvestmentWorkspaceFrame, money } from '../components/portfolio/InvestmentWorkspace.jsx';
import { Badge } from '../components/ui/Badge.jsx';
import { Card } from '../components/ui/Card.jsx';
import { EmptyState, ErrorState } from '../components/ui/States.jsx';
import { Skeleton } from '../components/ui/Skeleton.jsx';
import { formatPct } from '../utils/formatters.js';

const COLORS = ['var(--action)', 'var(--comparison)', 'var(--positive)', 'var(--warning)', 'var(--information)', 'var(--negative)'];

function AllocationList({ title, rows, currency, translateKey = false }) {
  const { t } = useTranslation();
  return <Card><h3 className="text-sm font-semibold text-primary">{title}</h3><ul className="mt-3 divide-y divide-default">{rows.map((item, index) => <li key={item.key} className="flex min-h-12 items-center gap-3 py-2"><span className="h-3 w-3 shrink-0 rounded-sm" style={{ background: COLORS[index % COLORS.length] }} aria-hidden="true" /><span className="min-w-0 flex-1 truncate" dir={translateKey ? undefined : 'auto'}>{translateKey ? t(`portfolio.assetTypes.${item.label || item.key}`, { defaultValue: item.label || item.key }) : item.label || t(`investments.${item.key}`, { defaultValue: item.key })}</span><span className="font-mono text-sm" dir="ltr">{money(item.amount, currency)}</span><span className="w-16 text-end font-mono text-xs text-muted" dir="ltr">{item.percentage == null ? '—' : formatPct(item.percentage)}</span></li>)}</ul></Card>;
}

function AllocationContent({ accountId }) {
  const { t } = useTranslation();
  const [dimension, setDimension] = useState('instrument');
  const query = useQuery({ queryKey: ['investments', 'allocation', accountId], queryFn: () => investmentsApi.allocation(accountId ? { accountId } : {}), retry: false });
  if (query.isLoading) return <Skeleton className="h-96" label={t('investments.loadingAllocation')} />;
  if (query.isError) return <ErrorState title={t('investments.allocationFailed')} detail={t('investments.loadFailedDetail')} onRetry={query.refetch} />;
  if (!query.data.currencyGroups.length) return <EmptyState title={t('investments.noAllocation')} detail={t('investments.noHoldingsDetail')} />;
  return <>
    <section aria-labelledby="allocation-dimension"><h2 id="allocation-dimension" className="text-sm font-semibold text-primary">{t('investments.allocationDimension')}</h2><div className="mt-3 flex flex-wrap gap-2" role="group" aria-label={t('investments.allocationDimension')}>{['account', 'assetType', 'instrument', 'cash'].map((item) => <button key={item} type="button" aria-pressed={dimension === item} className={`min-h-11 rounded-md border px-3 text-sm ${dimension === item ? 'border-action bg-action-soft font-semibold text-action' : 'border-default text-secondary'}`} onClick={() => setDimension(item)}>{t(`investments.allocationDimensions.${item}`)}</button>)}</div></section>
    {query.data.currencyGroups.map((group) => {
      const rows = dimension === 'account' ? group.byAccount : dimension === 'assetType' ? group.byAssetType : dimension === 'instrument' ? group.byInstrument : group.cashVersusInvested.map((item) => ({ ...item, label: t(`investments.${item.key}`) }));
      return <section key={group.currency} aria-labelledby={`allocation-${group.currency}`}><div className="mb-3 flex flex-wrap items-center justify-between gap-2"><h2 id={`allocation-${group.currency}`} className="font-semibold text-primary" dir="ltr">{group.currency}</h2>{!group.valuationAvailable && <Badge variant="warning">{t('investments.allocationUnavailable')}</Badge>}</div>{!group.valuationAvailable ? <Card><p className="text-sm text-secondary">{t('investments.allocationMissingDetail')}</p><p className="mt-2 text-xs text-muted">{t('portfolio.noFxConversion')}</p></Card> : <div className="grid gap-4 wide:grid-cols-[minmax(18rem,0.8fr)_minmax(0,1.2fr)]"><Card><div className="h-64" role="img" aria-label={t('investments.allocationChartLabel', { currency: group.currency })} tabIndex="0" dir="ltr"><ResponsiveContainer width="100%" height="100%"><PieChart><Pie data={rows} dataKey="amount" nameKey="label" innerRadius="52%" outerRadius="80%" paddingAngle={2}>{rows.map((item, index) => <Cell key={item.key} fill={COLORS[index % COLORS.length]} />)}</Pie><Tooltip formatter={(value) => money(value, group.currency)} /></PieChart></ResponsiveContainer></div></Card><AllocationList title={t(`investments.allocationDimensions.${dimension}`)} rows={rows} currency={group.currency} translateKey={dimension === 'assetType'} /></div>}</section>;
    })}
    <p className="text-xs text-muted">{t('investments.supportedAllocationOnly')} · {t('portfolio.noFxConversion')}</p>
  </>;
}

export default function InvestmentAllocation() { return <InvestmentWorkspaceFrame>{(props) => <AllocationContent {...props} />}</InvestmentWorkspaceFrame>; }
