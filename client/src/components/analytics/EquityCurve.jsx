import {
  ResponsiveContainer, ComposedChart, Area, Bar, XAxis, YAxis,
  CartesianGrid, Tooltip, Legend, ReferenceLine,
} from 'recharts';
import { Card } from '../ui/Card.jsx';
import { EmptyState, ErrorState } from '../ui/States.jsx';
import { Skeleton } from '../ui/Skeleton.jsx';
import { formatCurrency, formatSignedCurrency, rawCurrency } from '../../utils/formatters.js';
import { formatDateKey } from '../../utils/dateOnly.js';

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
  if (isLoading) {
    return <Skeleton className="h-[23rem] w-full" label="Loading cumulative realized PnL chart" />;
  }

  if (error) {
    return <ErrorState title="Cumulative PnL could not be loaded" detail="The closed-trade running total is unavailable." available="Dashboard controls and any other successful widgets" onRetry={onRetry} />;
  }

  if (!data?.length) {
    return <EmptyState title="No realized PnL to chart" detail="There are no closed trades in the selected scope for this chart." />;
  }

  const first = data[0]?.cumulativePnl ?? 0;
  const last = data[data.length - 1]?.cumulativePnl ?? 0;
  const direction = last > first ? 'increased' : last < first ? 'decreased' : 'was unchanged';
  const values = data.map(point => point.cumulativePnl ?? 0);
  const crossesZero = Math.min(...values) < 0 && Math.max(...values) > 0;
  const chartLabel = `Cumulative realized PnL ${direction} over ${data.length} plotted ${data.length === 1 ? 'day' : 'days'} and ends at ${rawCurrency(last)}.`;

  return (
    <Card className="min-w-0">
      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <div className="min-w-0">
          <h2 className="text-sm font-semibold text-primary">Cumulative realized PnL</h2>
          <p className="mt-1 text-xs text-muted">Running total of closed-trade net PnL for the selected scope.</p>
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
            <Bar dataKey="dailyPnl" name="Daily net PnL" fill="var(--cmp)" opacity={0.55} radius={[2, 2, 0, 0]} />
            <Area type="monotone" dataKey="cumulativePnl" name="Cumulative net PnL" stroke="var(--action)" strokeWidth={2} fill="var(--action-soft)" dot={false} />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </Card>
  );
}
