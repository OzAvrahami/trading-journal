import { useTranslation } from 'react-i18next';
import { Card } from '../ui/Card.jsx';
import { ValueIndicator } from '../ui/ValueIndicator.jsx';
import { formatCurrency, formatPct, formatR, formatSignedCurrency } from '../../utils/formatters.js';

function tradeCount(count, closed, t) {
  return t(closed ? 'analytics.closedTradeCount' : 'analytics.tradeCount', {
    count,
    defaultValue: closed ? `${count} closed ${count === 1 ? 'trade' : 'trades'}` : `${count} ${count === 1 ? 'trade' : 'trades'}`,
  });
}

function MetricCard({ label, value, detail, pnlValue, unavailable = false }) {
  const { t } = useTranslation();
  return (
    <Card density="compact" className="min-w-0 bg-surface-raised">
      <p className="text-[0.65625rem] font-semibold uppercase tracking-[0.05em] text-muted">{label}</p>
      <div className="mt-1.5 min-h-7 text-[1.1875rem] font-semibold tracking-tight text-primary">
        {unavailable ? (
          <span className="font-mono tabular-nums text-muted" dir="ltr" aria-label={t('common.unavailable')}>—</span>
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
  const { t } = useTranslation();
  if (!data) return null;
  const { totals = {}, today = {}, wtd = {}, mtd = {} } = data;
  const closedTrades = totals.tradesClosed ?? 0;
  const hasClosedTrades = closedTrades > 0;
  const hasWinners = (totals.winners ?? 0) > 0;
  const hasLosers = (totals.losers ?? 0) > 0;

  return (
    <section aria-label={t('analytics.summary')} className="space-y-3">
      <div className="grid grid-cols-2 gap-3 compact:grid-cols-4">
        <MetricCard label={t('dashboard.dailyPnl')} value={formatSignedCurrency(today.pnlNet)} pnlValue={today.pnlNet} detail={tradeCount(today.tradesCount ?? 0, false, t)} />
        <MetricCard label={t('dashboard.wtd')} value={formatSignedCurrency(wtd.pnlNet)} pnlValue={wtd.pnlNet} detail={tradeCount(wtd.tradesCount ?? 0, false, t)} />
        <MetricCard label={t('dashboard.mtd')} value={formatSignedCurrency(mtd.pnlNet)} pnlValue={mtd.pnlNet} detail={tradeCount(mtd.tradesCount ?? 0, false, t)} />
        <MetricCard label={t('dashboard.periodPnl')} value={formatSignedCurrency(totals.pnlNet)} pnlValue={totals.pnlNet} detail={tradeCount(closedTrades, true, t)} />
      </div>

      <div className="grid grid-cols-2 gap-3 adaptive:grid-cols-3 wide:grid-cols-6">
        <MetricCard label={t('common.winRate')} value={formatPct(totals.winRate)} unavailable={!hasClosedTrades} detail={hasClosedTrades ? `${totals.winners ?? 0}W / ${totals.losers ?? 0}L` : t('dashboard.noTrades')} />
        <MetricCard label={t('analytics.averageWin')} value={formatSignedCurrency(totals.avgWin)} pnlValue={hasWinners ? totals.avgWin : null} unavailable={!hasWinners} />
        <MetricCard label={t('analytics.averageLoss')} value={formatCurrency(totals.avgLoss)} pnlValue={hasLosers ? totals.avgLoss : null} unavailable={!hasLosers} />
        <MetricCard label={t('common.expectancy')} value={formatSignedCurrency(totals.expectancy)} pnlValue={hasClosedTrades ? totals.expectancy : null} unavailable={!hasClosedTrades || totals.expectancy == null} detail={t('analytics.expectancyDescription')} />
        <MetricCard label={t('common.profitFactor')} value={totals.profitFactor != null ? totals.profitFactor.toFixed(2) : '—'} unavailable={!hasClosedTrades || totals.profitFactor == null} />
        <MetricCard label={t('common.averageR')} value={formatR(totals.avgRMultiple)} unavailable={!hasClosedTrades || totals.avgRMultiple == null} />
      </div>
    </section>
  );
}
