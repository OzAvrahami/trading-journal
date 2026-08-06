import { Area, CartesianGrid, ComposedChart, Line, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { useTranslation } from 'react-i18next';
import { Card } from '../ui/Card.jsx';
import { EmptyState } from '../ui/States.jsx';
import { formatCurrency, formatDate, rawCurrency } from '../../utils/formatters.js';

function TooltipContent({ active, payload, label, currency }) {
  if (!active || !payload?.length) return null;
  return <div className="rounded-md border border-strong bg-surface-raised p-3 text-xs shadow-overlay"><p className="mb-2 text-muted" dir="ltr">{formatDate(label)}</p>{payload.map((item) => <p key={item.dataKey} className="font-mono text-primary" dir="ltr">{item.name}: {formatCurrency(item.value, { currency })}</p>)}</div>;
}

export function InvestmentValueChart({ series, currency, compact = false }) {
  const { t } = useTranslation();
  const data = series.filter((point) => point.currency === currency);
  if (!data.length) return <EmptyState title={t('investments.noPerformance')} detail={t('investments.noPerformanceDetail')} />;
  const latest = data.at(-1);
  return <Card className="min-w-0"><div className="flex flex-wrap items-start justify-between gap-2"><div><h2 className="text-sm font-semibold text-primary">{t('investments.valueHistory')}</h2><p className="mt-1 text-xs text-muted">{t('investments.manualPriceBasis')}</p></div><span className="font-mono text-sm font-semibold" dir="ltr">{currency}</span></div><div className={`${compact ? 'h-52' : 'h-72'} mt-4 min-w-0`} dir="ltr" role="img" aria-label={t('investments.valueChartLabel', { currency, count: data.length })} tabIndex="0"><ResponsiveContainer width="100%" height="100%"><ComposedChart data={data} margin={{ top: 4, right: 12, bottom: 4, left: 4 }}><CartesianGrid strokeDasharray="3 3" stroke="var(--border)" /><XAxis dataKey="date" tick={{ fill: 'var(--text-3)', fontSize: 11 }} /><YAxis width={65} tick={{ fill: 'var(--text-3)', fontSize: 11 }} tickFormatter={(value) => rawCurrency(value, { currency, notation: 'compact', minimumFractionDigits: 0, maximumFractionDigits: 1 })} /><Tooltip content={<TooltipContent currency={currency} />} /><Area type="monotone" dataKey="totalValue" name={t('investments.totalValue')} stroke="var(--action)" fill="var(--action-soft)" connectNulls={false} /><Line type="monotone" dataKey="netContributions" name={t('investments.netContributions')} stroke="var(--comparison)" strokeDasharray="5 4" dot={false} /></ComposedChart></ResponsiveContainer></div><dl className="mt-3 grid grid-cols-2 gap-3 border-t border-default pt-3 text-xs"><div><dt className="text-muted">{t('investments.latestRecordedPoint')}</dt><dd className="mt-1 font-mono" dir="ltr">{formatDate(latest.date)}</dd></div><div><dt className="text-muted">{t('investments.currentValuation')}</dt><dd className="mt-1 font-mono" dir="ltr">{latest.totalValue == null ? '—' : formatCurrency(latest.totalValue, { currency })}</dd></div></dl></Card>;
}
