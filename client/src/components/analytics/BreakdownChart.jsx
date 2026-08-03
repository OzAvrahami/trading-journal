import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Cell, ReferenceLine } from 'recharts';
import { Card } from '../ui/Card.jsx';
import { EmptyState, ErrorState } from '../ui/States.jsx';
import { Skeleton } from '../ui/Skeleton.jsx';
import { formatCurrency, formatPct, rawCurrency } from '../../utils/formatters.js';

export const BREAKDOWN_OPTIONS = ['strategy', 'symbol', 'timeframe', 'direction', 'account', 'company'];

function ChartTooltip({ active, payload }) {
  if (!active || !payload?.length) return null;
  const row = payload[0].payload;
  return (
    <div className="space-y-1 rounded-md border border-strong bg-surface-raised p-3 text-xs shadow-overlay">
      <p className="font-semibold text-primary">{row.displayLabel}</p>
      <p className="text-muted">{row.tradesCount} trades · Win rate: {formatPct(row.winRate)}</p>
      <p className={row.pnlNet > 0 ? 'text-positive' : row.pnlNet < 0 ? 'text-negative' : 'text-secondary'}>
        Net PnL: <span className="font-mono tabular-nums" dir="ltr">{formatCurrency(row.pnlNet)}</span>
      </p>
    </div>
  );
}

function axisCurrency(value) {
  return rawCurrency(value, { notation: 'compact', minimumFractionDigits: 0, maximumFractionDigits: 1 });
}

export function BreakdownChart({ data, accounts = [], by, onByChange, isLoading = false, error, onRetry }) {
  const accountMap = Object.fromEntries(accounts.map(account => [account.id, account]));
  const chartData = (data ?? []).map(row => {
    const account = by === 'account' ? accountMap[row.label] : null;
    return { ...row, displayLabel: account ? (account.accountName || `${account.company} ${account.accountNumber}`) : (row.label || 'Unknown') };
  });

  return (
    <Card className="min-w-0">
      <div className="flex flex-col gap-3">
        <div>
          <h2 className="text-sm font-semibold text-primary">Performance breakdown</h2>
          <p className="mt-1 text-xs text-muted">Closed-trade net PnL grouped by a supported production dimension.</p>
        </div>
        <div className="flex flex-wrap gap-1 rounded-md border border-default bg-surface-sunken p-1" role="group" aria-label="Break down performance by">
          {BREAKDOWN_OPTIONS.map(option => (
            <button
              type="button"
              key={option}
              onClick={() => onByChange(option)}
              aria-pressed={by === option}
              className={`min-h-11 rounded-sm px-2.5 text-xs capitalize transition-colors adaptive:min-h-8 ${by === option ? 'bg-action text-white' : 'text-secondary hover:bg-surface-raised hover:text-primary'}`}
            >
              {option}
            </button>
          ))}
        </div>
      </div>

      <div className="mt-4">
        {isLoading ? (
          <Skeleton className="h-56 w-full" label="Loading performance breakdown" />
        ) : error ? (
          <ErrorState title="Performance breakdown could not be loaded" detail={`The ${by} grouping is unavailable.`} available="Other successful Dashboard widgets and breakdown controls" onRetry={onRetry} />
        ) : !chartData.length ? (
          <EmptyState title={`No ${by} breakdown yet`} detail="No closed trades in the selected scope can be grouped for this view." />
        ) : (
          <div className="h-56 min-w-0" dir="ltr" role="img" aria-label={`Net PnL for ${chartData.length} ${by} ${chartData.length === 1 ? 'group' : 'groups'}.`} tabIndex="0">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData} margin={{ top: 5, right: 8, bottom: 24, left: 2 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                <XAxis dataKey="displayLabel" tick={{ fill: 'var(--text-3)', fontSize: 11 }} interval="preserveStartEnd" />
                <YAxis tick={{ fill: 'var(--text-3)', fontSize: 11 }} tickFormatter={axisCurrency} width={62} />
                <ReferenceLine y={0} stroke="var(--border-2)" />
                <Tooltip content={<ChartTooltip />} />
                <Bar dataKey="pnlNet" name="Net PnL" radius={[2, 2, 0, 0]}>
                  {chartData.map((entry, index) => <Cell key={`${entry.displayLabel}-${index}`} fill={entry.pnlNet > 0 ? 'var(--pos)' : entry.pnlNet < 0 ? 'var(--neg)' : 'var(--text-3)'} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>
    </Card>
  );
}
