import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Cell } from 'recharts';
import { formatCurrency, formatPct } from '../../utils/formatters.js';

const BY_OPTIONS = ['strategy', 'symbol', 'timeframe', 'direction', 'account', 'company'];

function CustomTooltip({ active, payload }) {
  if (!active || !payload?.length) return null;
  const d = payload[0].payload;
  return (
    <div className="bg-gray-900 border border-gray-700 rounded-lg p-3 text-xs shadow-xl space-y-1">
      <p className="text-gray-200 font-semibold">{d.displayLabel}</p>
      <p className="text-gray-400">{d.tradesCount} trades · Win rate: {formatPct(d.winRate)}</p>
      <p style={{ color: d.pnlNet >= 0 ? '#22c55e' : '#ef4444' }}>PnL: {formatCurrency(d.pnlNet)}</p>
    </div>
  );
}

export function BreakdownChart({ data, accounts = [], by, onByChange }) {
  const accountMap = Object.fromEntries(accounts.map(a => [a.id, a]));

  function resolveLabel(row) {
    if (by !== 'account') return row.label || 'Unknown';
    const a = accountMap[row.label];
    if (!a) return row.label || 'Unknown';
    return a.accountName || `${a.company} ${a.accountNumber}`;
  }

  const chartData = (data ?? []).map(row => ({
    ...row,
    displayLabel: resolveLabel(row),
  }));

  return (
    <div className="card">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-semibold text-gray-300">Performance Breakdown</h3>
        <div className="flex gap-1 flex-wrap justify-end">
          {BY_OPTIONS.map(opt => (
            <button
              key={opt}
              onClick={() => onByChange(opt)}
              className={`px-2 py-1 text-xs rounded transition capitalize ${
                by === opt
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-800 text-gray-400 hover:text-gray-200'
              }`}
            >
              {opt}
            </button>
          ))}
        </div>
      </div>

      {!chartData.length ? (
        <div className="h-48 flex items-center justify-center text-gray-600">No data.</div>
      ) : (
        <ResponsiveContainer width="100%" height={220}>
          <BarChart data={chartData} margin={{ top: 5, right: 10, bottom: 20, left: 10 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" />
            <XAxis dataKey="displayLabel" tick={{ fill: '#6b7280', fontSize: 11 }} />
            <YAxis
              tick={{ fill: '#6b7280', fontSize: 11 }}
              tickFormatter={v => `$${v >= 1000 ? (v / 1000).toFixed(1) + 'k' : v >= -1000 ? v : (v / 1000).toFixed(1) + 'k'}`}
            />
            <Tooltip content={<CustomTooltip />} />
            <Bar dataKey="pnlNet" radius={[3, 3, 0, 0]} name="PnL Net">
              {chartData.map((entry, i) => (
                <Cell key={i} fill={entry.pnlNet >= 0 ? '#22c55e' : '#ef4444'} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      )}
    </div>
  );
}
