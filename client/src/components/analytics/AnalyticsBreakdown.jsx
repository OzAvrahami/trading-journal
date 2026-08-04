import {
  Bar, BarChart, CartesianGrid, Cell, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from 'recharts';
import { Card } from '../ui/Card.jsx';
import { EmptyState, ErrorState } from '../ui/States.jsx';
import { Skeleton } from '../ui/Skeleton.jsx';
import { formatPct, formatR, formatSignedCurrency, pnlColor, rawCurrency } from '../../utils/formatters.js';

export const ANALYTICS_DIMENSIONS = [
  { key: 'market', label: 'Market' },
  { key: 'weekday', label: 'Weekday' },
  { key: 'direction', label: 'Direction' },
  { key: 'strategy', label: 'Strategy' },
  { key: 'symbol', label: 'Symbol' },
  { key: 'timeframe', label: 'Timeframe' },
  { key: 'account', label: 'Account' },
  { key: 'company', label: 'Company' },
];

const CATEGORY_COLORS = ['var(--action)', 'var(--cmp)', 'var(--info)', 'var(--warn)', 'var(--text-2)'];

function humanize(value) {
  if (!value || value === 'Unknown') return 'Unknown';
  return value.charAt(0).toUpperCase() + value.slice(1);
}

function accountLabel(account) {
  return account?.accountName || (account ? `${account.company} ${account.accountNumber}` : null);
}

export function prepareBreakdownRows(data = [], by, accounts = []) {
  const accountMap = new Map(accounts.map((account) => [account.id, account]));
  return data.map((row) => ({
    ...row,
    displayLabel: by === 'account' ? (accountLabel(accountMap.get(row.label)) || 'Unknown account') : humanize(row.label),
  }));
}

function BreakdownTooltip({ active, payload }) {
  if (!active || !payload?.length) return null;
  const row = payload[0].payload;
  return (
    <div className="space-y-1 rounded-md border border-strong bg-surface-raised p-3 text-xs shadow-overlay">
      <p className="font-semibold text-primary">{row.displayLabel}</p>
      <p className="text-muted">{row.tradesCount} closed {row.tradesCount === 1 ? 'trade' : 'trades'} · {formatPct(row.winRate)} win rate</p>
      <p className={pnlColor(row.pnlNet)}>Net PnL: <span className="font-mono tabular-nums" dir="ltr">{formatSignedCurrency(row.pnlNet)}</span></p>
    </div>
  );
}

function BreakdownDetails({ rows }) {
  return (
    <>
      <div className="hidden overflow-x-auto adaptive:block">
        <table className="w-full border-collapse text-xs">
          <caption className="sr-only">Breakdown details for the selected dimension</caption>
          <thead>
            <tr className="border-b border-default text-muted">
              <th scope="col" className="px-2 py-2 text-start font-medium">Group</th>
              <th scope="col" className="px-2 py-2 text-end font-medium">Trades</th>
              <th scope="col" className="px-2 py-2 text-end font-medium">W / L</th>
              <th scope="col" className="px-2 py-2 text-end font-medium">Win rate</th>
              <th scope="col" className="px-2 py-2 text-end font-medium">Net PnL</th>
              <th scope="col" className="px-2 py-2 text-end font-medium">Avg R</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.key ?? row.label} className="border-b border-default last:border-b-0">
                <th scope="row" className="max-w-48 truncate px-2 py-2 text-start font-medium text-primary">{row.displayLabel}</th>
                <td className="px-2 py-2 text-end font-mono text-secondary" dir="ltr">{row.tradesCount}</td>
                <td className="px-2 py-2 text-end font-mono text-secondary" dir="ltr">{row.winners} / {row.losers}</td>
                <td className="px-2 py-2 text-end font-mono text-secondary" dir="ltr">{formatPct(row.winRate)}</td>
                <td className={`px-2 py-2 text-end font-mono ${pnlColor(row.pnlNet)}`} dir="ltr">{formatSignedCurrency(row.pnlNet)}</td>
                <td className="px-2 py-2 text-end font-mono text-secondary" dir="ltr">{formatR(row.avgRMultiple)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <details className="adaptive:hidden">
        <summary className="flex min-h-11 cursor-pointer items-center font-medium text-action">View breakdown details</summary>
        <ul className="divide-y divide-default" aria-label="Breakdown details">
          {rows.map((row) => (
            <li key={row.key ?? row.label} className="py-3">
              <div className="flex items-start gap-3">
                <span className="min-w-0 flex-1 truncate font-medium text-primary">{row.displayLabel}</span>
                <span className={`font-mono ${pnlColor(row.pnlNet)}`} dir="ltr">{formatSignedCurrency(row.pnlNet)}</span>
              </div>
              <p className="mt-1 text-xs text-muted">
                <span dir="ltr">{row.tradesCount} trades · {row.winners}W / {row.losers}L · {formatPct(row.winRate)}</span>
                {' · '}Avg R <span className="font-mono" dir="ltr">{formatR(row.avgRMultiple)}</span>
              </p>
            </li>
          ))}
        </ul>
      </details>
    </>
  );
}

export function AnalyticsBreakdown({ data, accounts, by, onByChange, isLoading, isFetching, error, onRetry }) {
  const rows = prepareBreakdownRows(data, by, accounts);
  const plottedRows = rows.slice(0, 10);
  const selectedLabel = ANALYTICS_DIMENSIONS.find((dimension) => dimension.key === by)?.label || by;

  return (
    <Card className="min-w-0">
      <div className="flex flex-col gap-3">
        <div>
          <h2 className="text-sm font-semibold text-primary">Dimension analysis</h2>
          <p className="mt-1 text-xs text-muted">Closed-trade net PnL and outcomes grouped by {selectedLabel.toLowerCase()}.</p>
        </div>
        <div className="grid grid-cols-2 gap-1 rounded-md border border-default bg-surface-sunken p-1 adaptive:flex adaptive:flex-wrap" role="group" aria-label="Analyze performance by dimension">
          {ANALYTICS_DIMENSIONS.map((dimension) => (
            <button
              key={dimension.key}
              type="button"
              aria-pressed={by === dimension.key}
              className={`min-h-11 rounded-sm px-3 text-xs transition-colors adaptive:min-h-9 ${by === dimension.key ? 'bg-action font-semibold text-white' : 'text-secondary hover:bg-surface-raised hover:text-primary'}`}
              onClick={() => onByChange(dimension.key)}
            >
              {dimension.label}
            </button>
          ))}
        </div>
      </div>

      {isFetching && !isLoading && <p className="mt-3 text-xs text-muted" role="status">Refreshing dimension analysis…</p>}
      <div className="mt-4">
        {isLoading ? (
          <Skeleton className="h-72 w-full" label="Loading dimension analysis" />
        ) : error ? (
          <ErrorState title="Dimension analysis could not be loaded" detail={`The ${selectedLabel.toLowerCase()} breakdown is unavailable.`} available="Scope controls and R-multiple distribution" onRetry={onRetry} />
        ) : !rows.length ? (
          <EmptyState title={`No ${selectedLabel.toLowerCase()} breakdown`} detail="No closed trades in this scope can be grouped for this dimension." />
        ) : (
          <div className="grid min-w-0 gap-4 compact:grid-cols-[minmax(0,1.2fr)_minmax(24rem,0.8fr)]">
            <div>
              <p className="mb-2 text-xs text-muted">{rows.length > plottedRows.length ? `Top ${plottedRows.length} of ${rows.length} groups by net PnL.` : `${rows.length} ${rows.length === 1 ? 'group' : 'groups'} in scope.`}</p>
              <div className="h-72 min-w-0" dir="ltr" role="img" aria-label={`Net PnL chart for ${plottedRows.length} ${selectedLabel.toLowerCase()} ${plottedRows.length === 1 ? 'group' : 'groups'}.`} tabIndex="0">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={plottedRows} layout="vertical" margin={{ top: 4, right: 12, bottom: 8, left: 4 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                    <XAxis type="number" tick={{ fill: 'var(--text-3)', fontSize: 10 }} tickFormatter={(value) => rawCurrency(value, { notation: 'compact', maximumFractionDigits: 1 })} />
                    <YAxis type="category" dataKey="displayLabel" tick={{ fill: 'var(--text-3)', fontSize: 10 }} width={88} />
                    <ReferenceLine x={0} stroke="var(--border-2)" />
                    <Tooltip content={<BreakdownTooltip />} />
                    <Bar dataKey="pnlNet" name="Net PnL" radius={[0, 2, 2, 0]}>
                      {plottedRows.map((row, index) => <Cell key={row.key ?? row.label} fill={CATEGORY_COLORS[index % CATEGORY_COLORS.length]} />)}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
            <BreakdownDetails rows={rows} />
          </div>
        )}
      </div>
    </Card>
  );
}
