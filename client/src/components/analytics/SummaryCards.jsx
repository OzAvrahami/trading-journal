import { formatCurrency, formatPct, formatR } from '../../utils/formatters.js';

function StatCard({ label, value, valueClass = 'text-gray-100', sub }) {
  return (
    <div className="card">
      <p className="text-xs text-gray-500 mb-1">{label}</p>
      <p className={`text-2xl font-bold ${valueClass}`}>{value}</p>
      {sub && <p className="text-xs text-gray-600 mt-1">{sub}</p>}
    </div>
  );
}

function pnlClass(v) {
  if (v == null) return 'text-gray-400';
  if (v > 0) return 'text-green-400';
  if (v < 0) return 'text-red-400';
  return 'text-gray-400';
}

export function SummaryCards({ data }) {
  if (!data) return null;
  const { totals, today, wtd, mtd } = data;

  return (
    <div className="space-y-4">
      {/* Period PnL row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <StatCard
          label="Today PnL"
          value={formatCurrency(today?.pnlNet)}
          valueClass={pnlClass(today?.pnlNet)}
          sub={`${today?.tradesCount ?? 0} trades`}
        />
        <StatCard
          label="Week-to-Date"
          value={formatCurrency(wtd?.pnlNet)}
          valueClass={pnlClass(wtd?.pnlNet)}
          sub={`${wtd?.tradesCount ?? 0} trades`}
        />
        <StatCard
          label="Month-to-Date"
          value={formatCurrency(mtd?.pnlNet)}
          valueClass={pnlClass(mtd?.pnlNet)}
          sub={`${mtd?.tradesCount ?? 0} trades`}
        />
        <StatCard
          label="Period Net PnL"
          value={formatCurrency(totals?.pnlNet)}
          valueClass={pnlClass(totals?.pnlNet)}
          sub={`${totals?.tradesClosed ?? 0} closed trades`}
        />
      </div>

      {/* Performance stats row */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
        <StatCard
          label="Win Rate"
          value={formatPct(totals?.winRate)}
          valueClass={totals?.winRate >= 0.5 ? 'text-green-400' : 'text-red-400'}
          sub={`${totals?.winners ?? 0}W / ${totals?.losers ?? 0}L`}
        />
        <StatCard label="Avg Win"  value={formatCurrency(totals?.avgWin)}  valueClass="text-green-400" />
        <StatCard label="Avg Loss" value={formatCurrency(totals?.avgLoss)} valueClass="text-red-400" />
        <StatCard label="Expectancy" value={formatCurrency(totals?.expectancy)} valueClass={pnlClass(totals?.expectancy)} />
        <StatCard
          label="Profit Factor"
          value={totals?.profitFactor != null ? totals.profitFactor.toFixed(2) : '—'}
          valueClass={totals?.profitFactor >= 1 ? 'text-green-400' : 'text-red-400'}
        />
        <StatCard label="Avg R" value={formatR(totals?.avgRMultiple)} />
      </div>
    </div>
  );
}
