import {
  Bar, BarChart, CartesianGrid, Cell, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from 'recharts';
import { Card } from '../ui/Card.jsx';
import { EmptyState, ErrorState } from '../ui/States.jsx';
import { Skeleton } from '../ui/Skeleton.jsx';
import { formatPct, formatR, formatSignedCurrency, pnlColor, rawCurrency } from '../../utils/formatters.js';
import { useTranslation } from 'react-i18next';

export const ANALYTICS_DIMENSIONS = [
  { key: 'market', label: 'Market', labelKey: 'common.market' },
  { key: 'weekday', label: 'Weekday', labelKey: 'analytics.weekday' },
  { key: 'direction', label: 'Direction', labelKey: 'common.direction' },
  { key: 'strategy', label: 'Strategy', labelKey: 'common.strategy' },
  { key: 'symbol', label: 'Symbol', labelKey: 'common.symbol' },
  { key: 'timeframe', label: 'Timeframe', labelKey: 'common.timeframe' },
  { key: 'account', label: 'Account', labelKey: 'common.account' },
  { key: 'company', label: 'Company', labelKey: 'common.company' },
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
  const { t } = useTranslation();
  if (!active || !payload?.length) return null;
  const row = payload[0].payload;
  return (
    <div className="space-y-1 rounded-md border border-strong bg-surface-raised p-3 text-xs shadow-overlay">
      <p className="font-semibold text-primary">{row.displayLabel}</p>
      <p className="text-muted">{t('analytics.closedTradeSummary', { count: row.tradesCount, rate: formatPct(row.winRate) })}</p>
      <p className={pnlColor(row.pnlNet)}>{t('common.netPnl')}: <span className="font-mono tabular-nums" dir="ltr">{formatSignedCurrency(row.pnlNet)}</span></p>
    </div>
  );
}

function BreakdownDetails({ rows }) {
  const { t } = useTranslation();
  return (
    <>
      <div className="hidden overflow-x-auto adaptive:block">
        <table className="w-full border-collapse text-xs">
          <caption className="sr-only">{t('analytics.breakdownDetails')}</caption>
          <thead>
            <tr className="border-b border-default text-muted">
              <th scope="col" className="px-2 py-2 text-start font-medium">{t('analytics.group')}</th>
              <th scope="col" className="px-2 py-2 text-end font-medium">{t('common.trades')}</th>
              <th scope="col" className="px-2 py-2 text-end font-medium">{t('analytics.winsLosses')}</th>
              <th scope="col" className="px-2 py-2 text-end font-medium">{t('common.winRate')}</th>
              <th scope="col" className="px-2 py-2 text-end font-medium">{t('common.netPnl')}</th>
              <th scope="col" className="px-2 py-2 text-end font-medium">{t('common.averageR')}</th>
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
        <summary className="flex min-h-11 cursor-pointer items-center font-medium text-action">{t('analytics.viewDetails')}</summary>
        <ul className="divide-y divide-default" aria-label={t('analytics.breakdownDetails')}>
          {rows.map((row) => (
            <li key={row.key ?? row.label} className="py-3">
              <div className="flex items-start gap-3">
                <span className="min-w-0 flex-1 truncate font-medium text-primary">{row.displayLabel}</span>
                <span className={`font-mono ${pnlColor(row.pnlNet)}`} dir="ltr">{formatSignedCurrency(row.pnlNet)}</span>
              </div>
              <p className="mt-1 text-xs text-muted">
                <span dir="ltr">{t('analytics.tradeCount', { count: row.tradesCount })} · {row.winners}W / {row.losers}L · {formatPct(row.winRate)}</span>
                {' · '}{t('common.averageR')} <span className="font-mono" dir="ltr">{formatR(row.avgRMultiple)}</span>
              </p>
            </li>
          ))}
        </ul>
      </details>
    </>
  );
}

export function AnalyticsBreakdown({ data, accounts, by, onByChange, isLoading, isFetching, error, onRetry }) {
  const { t } = useTranslation();
  const rows = prepareBreakdownRows(data, by, accounts);
  const plottedRows = rows.slice(0, 10);
  const selectedDimension = ANALYTICS_DIMENSIONS.find((dimension) => dimension.key === by);
  const selectedLabel = selectedDimension ? t(selectedDimension.labelKey) : by;

  return (
    <Card className="min-w-0">
      <div className="flex flex-col gap-3">
        <div>
          <h2 className="text-sm font-semibold text-primary">{t('analytics.dimensionAnalysis')}</h2>
          <p className="mt-1 text-xs text-muted">{t('analytics.dimensionDescription', { dimension: selectedLabel })}</p>
        </div>
        <div className="grid grid-cols-2 gap-1 rounded-md border border-default bg-surface-sunken p-1 adaptive:flex adaptive:flex-wrap" role="group" aria-label={t('analytics.dimensionControl')}>
          {ANALYTICS_DIMENSIONS.map((dimension) => (
            <button
              key={dimension.key}
              type="button"
              aria-pressed={by === dimension.key}
              className={`min-h-11 rounded-sm px-3 text-xs transition-colors adaptive:min-h-9 ${by === dimension.key ? 'bg-action font-semibold text-white' : 'text-secondary hover:bg-surface-raised hover:text-primary'}`}
              onClick={() => onByChange(dimension.key)}
            >
              {t(dimension.labelKey)}
            </button>
          ))}
        </div>
      </div>

      {isFetching && !isLoading && <p className="mt-3 text-xs text-muted" role="status">{t('analytics.refreshingDimension')}</p>}
      <div className="mt-4">
        {isLoading ? (
          <Skeleton className="h-72 w-full" label={t('analytics.loadingDimension')} />
        ) : error ? (
          <ErrorState title={t('analytics.dimensionFailed')} detail={t('analytics.dimensionUnavailable', { dimension: selectedLabel })} available={t('analytics.dimensionAvailable')} onRetry={onRetry} />
        ) : !rows.length ? (
          <EmptyState title={t('analytics.noDimension', { dimension: selectedLabel })} detail={t('analytics.noDimensionDetail')} />
        ) : (
          <div className="grid min-w-0 gap-4 compact:grid-cols-[minmax(0,1.2fr)_minmax(24rem,0.8fr)]">
            <div>
              <p className="mb-2 text-xs text-muted">{rows.length > plottedRows.length ? t('analytics.topGroups', { shown: plottedRows.length, total: rows.length }) : t('analytics.groupsInScope', { count: rows.length })}</p>
              <div className="h-72 min-w-0" dir="ltr" role="img" aria-label={t('analytics.dimensionChartLabel', { count: plottedRows.length, dimension: selectedLabel })} tabIndex="0">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={plottedRows} layout="vertical" margin={{ top: 4, right: 12, bottom: 8, left: 4 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                    <XAxis type="number" tick={{ fill: 'var(--text-3)', fontSize: 10 }} tickFormatter={(value) => rawCurrency(value, { notation: 'compact', maximumFractionDigits: 1 })} />
                    <YAxis type="category" dataKey="displayLabel" tick={{ fill: 'var(--text-3)', fontSize: 10 }} width={88} />
                    <ReferenceLine x={0} stroke="var(--border-2)" />
                    <Tooltip content={<BreakdownTooltip />} />
                    <Bar dataKey="pnlNet" name={t('common.netPnl')} radius={[0, 2, 2, 0]}>
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
