import { Bar, BarChart, CartesianGrid, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { Card } from '../ui/Card.jsx';
import { EmptyState, ErrorState } from '../ui/States.jsx';
import { Skeleton } from '../ui/Skeleton.jsx';
import { useTranslation } from 'react-i18next';

export const R_BUCKET_ORDER = [
  'lte_neg_2', 'neg_2_to_neg_1_5', 'neg_1_5_to_neg_1', 'neg_1_to_neg_0_5', 'neg_0_5_to_0',
  '0_to_0_5', '0_5_to_1', '1_to_2', '2_to_3', 'gte_3',
];

export function orderRBuckets(buckets = []) {
  const byKey = new Map(buckets.map((bucket) => [bucket.key, bucket]));
  return R_BUCKET_ORDER.map((key) => byKey.get(key)).filter(Boolean);
}

function bucketColor(bucket) {
  if (bucket.max != null && bucket.max <= 0) return 'var(--neg)';
  if (bucket.min != null && bucket.min >= 0.5) return 'var(--pos)';
  return 'var(--action)';
}

function RTooltip({ active, payload }) {
  const { t } = useTranslation();
  if (!active || !payload?.length) return null;
  const bucket = payload[0].payload;
  return (
    <div className="rounded-md border border-strong bg-surface-raised p-3 text-xs shadow-overlay">
      <p className="font-mono text-primary" dir="ltr">{bucket.label}</p>
      <p className="mt-1 text-secondary">{t('analytics.tradeCount', { count: bucket.count })}</p>
    </div>
  );
}

export function RDistribution({ data, isLoading, isFetching, error, onRetry }) {
  const { t } = useTranslation();
  if (isLoading) return <Skeleton className="h-[23rem] w-full" label={t('analytics.loadingR')} />;
  if (error) return <ErrorState title={t('analytics.rFailed')} detail={t('analytics.rFailedDetail')} available={t('analytics.rAvailable')} onRetry={onRetry} />;

  const buckets = orderRBuckets(data?.buckets);
  const totalTrades = data?.totalTrades ?? buckets.reduce((sum, bucket) => sum + (bucket.count ?? 0), 0);
  if (!totalTrades || !buckets.length) {
    return <EmptyState title={t('analytics.rUnavailable')} detail={t('analytics.rUnavailableDetail')} />;
  }

  const populated = buckets.filter((bucket) => bucket.count > 0).length;
  return (
    <Card className="min-w-0">
      <div className="flex flex-wrap items-start gap-3">
        <div>
          <h2 className="text-sm font-semibold text-primary">{t('analytics.rDistribution')}</h2>
          <p className="mt-1 text-xs text-muted">{t('analytics.rDescription', { count: totalTrades })}</p>
        </div>
        {isFetching && <span className="ms-auto text-xs text-muted" role="status">{t('analytics.refreshingR')}</span>}
      </div>

      <div className="mt-4 h-64 min-w-0" dir="ltr" role="img" aria-label={`R-multiple distribution for ${totalTrades} closed ${totalTrades === 1 ? 'trade' : 'trades'} across ${populated} populated buckets, ordered from negative to positive.`} tabIndex="0">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={buckets} margin={{ top: 6, right: 8, bottom: 46, left: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
            <XAxis dataKey="label" tick={{ fill: 'var(--text-3)', fontSize: 9 }} angle={-32} textAnchor="end" interval={0} />
            <YAxis allowDecimals={false} width={36} tick={{ fill: 'var(--text-3)', fontSize: 10 }} />
            <Tooltip content={<RTooltip />} />
            <Bar dataKey="count" name="Closed trades" radius={[2, 2, 0, 0]}>
              {buckets.map((bucket) => <Cell key={bucket.key} fill={bucketColor(bucket)} />)}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      <ol className="mt-3 grid grid-cols-2 gap-2 border-t border-default pt-3 adaptive:grid-cols-5" dir="ltr" aria-label={t('analytics.rBucketCounts')}>
        {buckets.map((bucket) => (
          <li key={bucket.key} data-r-bucket={bucket.key} className="flex min-w-0 items-center justify-between gap-2 rounded-sm bg-surface-raised px-2 py-1.5">
            <span className="truncate font-mono text-[10px] text-muted" dir="ltr">{bucket.label}</span>
            <span className="font-mono text-xs font-semibold text-primary" dir="ltr">{bucket.count}</span>
          </li>
        ))}
      </ol>
    </Card>
  );
}
