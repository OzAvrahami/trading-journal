import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Cell } from 'recharts';
import { Card } from '../ui/Card.jsx';
import { EmptyState, ErrorState } from '../ui/States.jsx';
import { Skeleton } from '../ui/Skeleton.jsx';
import { useTranslation } from 'react-i18next';

function ChartTooltip({ active, payload }) {
  if (!active || !payload?.length) return null;
  const bucket = payload[0].payload;
  return (
    <div className="rounded-md border border-strong bg-surface-raised p-3 text-xs shadow-overlay">
      <p className="font-mono text-muted" dir="ltr">{bucket.range}</p>
      <p className="mt-1 font-semibold text-primary">{bucket.count} {bucket.count === 1 ? 'trade' : 'trades'}</p>
    </div>
  );
}

export function PnLHistogram({ data, isLoading = false, error, onRetry }) {
  const { t } = useTranslation();
  if (isLoading) return <Skeleton className="h-[19rem] w-full" label={t('analytics.loadingDistribution')} />;
  if (error) return <ErrorState title={t('analytics.distributionFailed')} detail={t('analytics.distributionFailedDetail')} available={t('analytics.dashboardAvailable')} onRetry={onRetry} />;
  if (!data?.length) return <EmptyState title={t('analytics.noDistribution')} detail={t('analytics.noDistributionDetail')} />;

  const totalTrades = data.reduce((sum, bucket) => sum + (bucket.count ?? 0), 0);
  const chartLabel = `Dollar PnL distribution with ${data.length} buckets across ${totalTrades} closed ${totalTrades === 1 ? 'trade' : 'trades'}.`;

  return (
    <Card className="min-w-0">
      <h2 className="text-sm font-semibold text-primary">{t('analytics.dollarDistribution')}</h2>
      <p className="mt-1 text-xs text-muted">{t('analytics.distributionDescription')}</p>
      <div className="mt-4 h-56 min-w-0" dir="ltr" role="img" aria-label={chartLabel} tabIndex="0">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 5, right: 8, bottom: 24, left: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
            <XAxis dataKey="range" tick={{ fill: 'var(--text-3)', fontSize: 9 }} angle={-30} textAnchor="end" interval={0} />
            <YAxis tick={{ fill: 'var(--text-3)', fontSize: 11 }} allowDecimals={false} width={36} />
            <Tooltip content={<ChartTooltip />} />
            <Bar dataKey="count" name="Closed trades" radius={[2, 2, 0, 0]}>
              {data.map((entry, index) => <Cell key={`${entry.range}-${index}`} fill={entry.min >= 0 ? 'var(--pos)' : 'var(--neg)'} />)}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </Card>
  );
}
