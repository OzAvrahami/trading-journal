import { Card } from '../ui/Card.jsx';
import { ValueIndicator } from '../ui/ValueIndicator.jsx';
import { formatCurrency, formatPct, formatR, formatSignedCurrency } from '../../utils/formatters.js';

function tradeCount(count, closed = false) {
  return `${count} ${closed ? 'closed ' : ''}${count === 1 ? 'trade' : 'trades'}`;
}

function MetricCard({ label, value, detail, pnlValue, unavailable = false }) {
  return (
    <Card density="compact" className="min-w-0 bg-surface-raised">
      <p className="text-[0.65625rem] font-semibold uppercase tracking-[0.05em] text-muted">{label}</p>
      <div className="mt-1.5 min-h-7 text-[1.1875rem] font-semibold tracking-tight text-primary">
        {unavailable ? (
          <span className="font-mono tabular-nums text-muted" dir="ltr" aria-label="Unavailable">—</span>
        ) : pnlValue != null ? (
          <ValueIndicator value={pnlValue} className="text-[1.1875rem] font-semibold">{value}</ValueIndicator>
        ) : (
          <span className="font-mono tabular-nums" dir="ltr">{value}</span>
        )}
      </div>
      {detail && <p className="mt-1 text-xs text-muted">{detail}</p>}
    </Card>
  );
}

export function SummaryCards({ data }) {
  if (!data) return null;
  const { totals = {}, today = {}, wtd = {}, mtd = {} } = data;
  const closedTrades = totals.tradesClosed ?? 0;
  const hasClosedTrades = closedTrades > 0;
  const hasWinners = (totals.winners ?? 0) > 0;
  const hasLosers = (totals.losers ?? 0) > 0;

  return (
    <section aria-label="Trading performance metrics" className="space-y-3">
      <div className="grid grid-cols-2 gap-3 compact:grid-cols-4">
        <MetricCard label="Today PnL" value={formatSignedCurrency(today.pnlNet)} pnlValue={today.pnlNet} detail={tradeCount(today.tradesCount ?? 0)} />
        <MetricCard label="Week-to-date" value={formatSignedCurrency(wtd.pnlNet)} pnlValue={wtd.pnlNet} detail={tradeCount(wtd.tradesCount ?? 0)} />
        <MetricCard label="Month-to-date" value={formatSignedCurrency(mtd.pnlNet)} pnlValue={mtd.pnlNet} detail={tradeCount(mtd.tradesCount ?? 0)} />
        <MetricCard label="Period net PnL" value={formatSignedCurrency(totals.pnlNet)} pnlValue={totals.pnlNet} detail={tradeCount(closedTrades, true)} />
      </div>

      <div className="grid grid-cols-2 gap-3 adaptive:grid-cols-3 wide:grid-cols-6">
        <MetricCard
          label="Win rate"
          value={formatPct(totals.winRate)}
          unavailable={!hasClosedTrades}
          detail={hasClosedTrades ? `${totals.winners ?? 0}W / ${totals.losers ?? 0}L` : 'No closed trades'}
        />
        <MetricCard label="Average win" value={formatSignedCurrency(totals.avgWin)} pnlValue={hasWinners ? totals.avgWin : null} unavailable={!hasWinners} />
        <MetricCard label="Average loss" value={formatCurrency(totals.avgLoss)} pnlValue={hasLosers ? totals.avgLoss : null} unavailable={!hasLosers} />
        <MetricCard
          label="Expectancy"
          value={formatSignedCurrency(totals.expectancy)}
          pnlValue={hasClosedTrades ? totals.expectancy : null}
          unavailable={!hasClosedTrades || totals.expectancy == null}
          detail="Average net PnL per closed trade"
        />
        <MetricCard
          label="Profit factor"
          value={totals.profitFactor != null ? totals.profitFactor.toFixed(2) : '—'}
          unavailable={!hasClosedTrades || totals.profitFactor == null}
        />
        <MetricCard label="Average R" value={formatR(totals.avgRMultiple)} unavailable={!hasClosedTrades || totals.avgRMultiple == null} />
      </div>
    </section>
  );
}
