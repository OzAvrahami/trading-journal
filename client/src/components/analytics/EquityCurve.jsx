import {
  ResponsiveContainer, ComposedChart, Area, Bar, XAxis, YAxis,
  CartesianGrid, Tooltip, Legend, ReferenceLine,
} from 'recharts';
import { Card } from '../ui/Card.jsx';
import { EmptyState, ErrorState } from '../ui/States.jsx';
import { Skeleton } from '../ui/Skeleton.jsx';
import { formatCurrency, formatSignedCurrency, rawCurrency } from '../../utils/formatters.js';
import { formatDateKey } from '../../utils/dateOnly.js';
import { useTranslation } from 'react-i18next';

function ChartTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-md border border-strong bg-surface-raised p-3 text-xs shadow-overlay">
      <p className="mb-2 text-muted">{formatDateKey(label)}</p>
      {payload.map(item => (
        <p key={item.dataKey} className="font-mono tabular-nums text-primary" dir="ltr">
          {item.name}: {formatCurrency(item.value)}
        </p>
      ))}
    </div>
  );
}

function axisCurrency(value) {
  return rawCurrency(value, { notation: 'compact', minimumFractionDigits: 0, maximumFractionDigits: 1 });
}

export function EquityCurve({ data, isLoading = false, error, onRetry }) {
  const { t } = useTranslation();
  if (isLoading) {
    return <Skeleton className="h-[23rem] w-full" label={t('analytics.loadingEquity')} />;
  }

  if (error) {
    return <ErrorState title={t('analytics.equityFailed')} detail={t('analytics.equityFailedDetail')} available={t('analytics.dashboardAvailable')} onRetry={onRetry} />;
  }

  if (!data?.length) {
    return <EmptyState title={t('analytics.noEquity')} detail={t('analytics.noEquityDetail')} />;
  }

  const first = data[0]?.cumulativePnl ?? 0;
  const last = data[data.length - 1]?.cumulativePnl ?? 0;
  const direction = last > first ? t('analytics.increased') : last < first ? t('analytics.decreased') : t('analytics.unchanged');
  const values = data.map(point => point.cumulativePnl ?? 0);
  const crossesZero = Math.min(...values) < 0 && Math.max(...values) > 0;
  const chartLabel = t('analytics.equityChartLabel', { direction, count: data.length, value: rawCurrency(last) });

  return (
    <Card className="min-w-0">
      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <div className="min-w-0">
          <h2 className="text-sm font-semibold text-primary">{t('analytics.cumulative')}</h2>
          <p className="mt-1 text-xs text-muted">{t('analytics.cumulativeDescription')}</p>
        </div>
        <span className="ms-auto font-mono text-lg font-semibold tabular-nums text-primary" dir="ltr">{formatSignedCurrency(last)}</span>
      </div>
      <div className="mt-4 h-72 min-w-0" dir="ltr" role="img" aria-label={chartLabel} tabIndex="0">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={data} margin={{ top: 5, right: 12, bottom: 5, left: 4 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
            <XAxis dataKey="date" tick={{ fill: 'var(--text-3)', fontSize: 11 }} tickFormatter={value => formatDateKey(value, { month: 'short', day: 'numeric' })} />
            <YAxis tick={{ fill: 'var(--text-3)', fontSize: 11 }} tickFormatter={axisCurrency} width={64} />
            <Tooltip content={<ChartTooltip />} />
            <Legend wrapperStyle={{ fontSize: 12, color: 'var(--text-2)' }} />
            {crossesZero && <ReferenceLine y={0} stroke="var(--border-2)" strokeWidth={1.5} />}
            <Bar dataKey="dailyPnl" name={t('analytics.dailyNetPnl')} fill="var(--cmp)" opacity={0.55} radius={[2, 2, 0, 0]} />
            <Area type="monotone" dataKey="cumulativePnl" name={t('analytics.cumulative')} stroke="var(--action)" strokeWidth={2} fill="var(--action-soft)" dot={false} />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </Card>
  );
}
