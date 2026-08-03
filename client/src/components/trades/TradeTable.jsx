import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Link, useNavigate } from 'react-router-dom';
import { CaretDown, CaretUp, CaretUpDown, Trash } from '@phosphor-icons/react';
import { tradesApi } from '../../api/trades.js';
import { formatCurrency, formatDatetime, formatDuration, formatR, formatSignedCurrency } from '../../utils/formatters.js';
import { Badge } from '../ui/Badge.jsx';
import { Card } from '../ui/Card.jsx';
import { IconButton } from '../ui/IconButton.jsx';
import { ValueIndicator } from '../ui/ValueIndicator.jsx';
import { useToast } from '../ui/Toast.jsx';

export function DirectionBadge({ direction }) {
  const isLong = direction === 'long';
  return <Badge variant={isLong ? 'action' : 'comparison'}>{isLong ? 'Long' : 'Short'}</Badge>;
}

export function StatusBadge({ status }) {
  return <Badge variant={status === 'open' ? 'information' : 'neutral'} className="capitalize">{status || 'Unavailable'}</Badge>;
}

function accountLabel(accountId, accounts) {
  const account = accounts.find((item) => item.id === accountId);
  if (!account) return '—';
  return account.accountName || `${account.company} — ${account.accountNumber}`;
}

function FinancialValue({ value, formatter, className = '' }) {
  if (value == null) return <span className={`numeric font-mono text-muted ${className}`} dir="ltr">—</span>;
  return <ValueIndicator value={value} className={className}>{formatter(value)}</ValueIndicator>;
}

function SortHeader({ label, field, sort, order, onSort, className = '' }) {
  const active = sort === field;
  const ariaSort = active ? (order === 'asc' ? 'ascending' : 'descending') : 'none';
  const Icon = !active ? CaretUpDown : order === 'asc' ? CaretUp : CaretDown;
  return (
    <th scope="col" aria-sort={ariaSort} className={`sticky top-0 z-10 bg-surface px-3 py-2.5 text-start text-xs font-medium text-secondary ${className}`}>
      <button
        type="button"
        className="inline-flex min-h-8 items-center gap-1 rounded-sm hover:text-primary"
        aria-label={`Sort by ${label}${active ? `, currently ${ariaSort}` : ''}`}
        onClick={() => onSort(field)}
      >
        {label}
        <Icon size={13} aria-hidden="true" />
      </button>
    </th>
  );
}

function TradeDeleteButton({ tradeId, pending, onDelete, mobile = false }) {
  return (
    <IconButton
      label="Delete trade"
      variant="destructive"
      size={mobile ? 'mobile' : 'sm'}
      disabled={pending}
      aria-busy={pending || undefined}
      onClick={(event) => onDelete(event, tradeId)}
    >
      <Trash size={17} aria-hidden="true" />
    </IconButton>
  );
}

export function TradeTable({ trades, accounts = [], sort, order, onSort }) {
  const queryClient = useQueryClient();
  const toast = useToast();
  const navigate = useNavigate();

  const deleteMutation = useMutation({
    mutationFn: (id) => tradesApi.remove(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['trades'] });
      queryClient.invalidateQueries({ queryKey: ['analytics'] });
      toast.success('Trade deleted.');
    },
    onError: () => toast.error('Failed to delete trade.'),
  });

  function handleDelete(event, id) {
    event.preventDefault();
    event.stopPropagation();
    if (!window.confirm('Delete this trade?')) return;
    deleteMutation.mutate(id);
  }

  function openTrade(tradeId) {
    navigate(`/trades/${tradeId}`);
  }

  function handleRowKeyDown(event, tradeId) {
    if (event.key !== 'Enter' && event.key !== ' ') return;
    event.preventDefault();
    openTrade(tradeId);
  }

  return (
    <>
      <div className="hidden overflow-x-auto rounded-lg border border-default bg-surface shadow-flat adaptive:block">
        <table className="w-full min-w-[920px] border-collapse text-sm">
          <caption className="sr-only">Recorded trades with account, entry, result, status, and actions</caption>
          <thead>
            <tr className="border-b border-default">
              <th scope="col" className="sticky top-0 z-10 bg-surface px-3 py-2.5 text-start text-xs font-medium text-secondary">Account</th>
              <SortHeader label="Symbol" field="symbol" sort={sort} order={order} onSort={onSort} />
              <th scope="col" className="sticky top-0 z-10 hidden bg-surface px-3 py-2.5 text-start text-xs font-medium text-secondary compact:table-cell">Market</th>
              <th scope="col" className="sticky top-0 z-10 bg-surface px-3 py-2.5 text-start text-xs font-medium text-secondary">Direction</th>
              <SortHeader label="Entry" field="entry_datetime" sort={sort} order={order} onSort={onSort} />
              <th scope="col" className="sticky top-0 z-10 hidden bg-surface px-3 py-2.5 text-start text-xs font-medium text-secondary compact:table-cell">Exit</th>
              <th scope="col" className="sticky top-0 z-10 bg-surface px-3 py-2.5 text-end text-xs font-medium text-secondary">Entry price</th>
              <th scope="col" className="sticky top-0 z-10 hidden bg-surface px-3 py-2.5 text-end text-xs font-medium text-secondary compact:table-cell">Exit price</th>
              <th scope="col" className="sticky top-0 z-10 bg-surface px-3 py-2.5 text-end text-xs font-medium text-secondary">Quantity</th>
              <SortHeader label="Net PnL" field="pnl_net" sort={sort} order={order} onSort={onSort} className="text-end" />
              <th scope="col" className="sticky top-0 z-10 hidden bg-surface px-3 py-2.5 text-end text-xs font-medium text-secondary compact:table-cell">R</th>
              <th scope="col" className="sticky top-0 z-10 hidden bg-surface px-3 py-2.5 text-end text-xs font-medium text-secondary wide:table-cell">Duration</th>
              <th scope="col" className="sticky top-0 z-10 bg-surface px-3 py-2.5 text-start text-xs font-medium text-secondary">Status</th>
              <th scope="col" className="sticky top-0 z-10 bg-surface px-2 py-2.5"><span className="sr-only">Actions</span></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-default">
            {trades.map((trade) => {
              const pending = deleteMutation.isPending && deleteMutation.variables === trade.id;
              return (
                <tr
                  key={trade.id}
                  tabIndex={0}
                  aria-label={`Open ${trade.symbol} trade details`}
                  onClick={() => openTrade(trade.id)}
                  onKeyDown={(event) => handleRowKeyDown(event, trade.id)}
                  className="cursor-pointer bg-surface transition-colors hover:bg-surface-raised focus-visible:bg-action-soft"
                >
                  <td className="px-3 py-2.5 text-xs text-secondary">{accountLabel(trade.accountId, accounts)}</td>
                  <td className="px-3 py-2.5 font-mono font-semibold text-primary" dir="ltr">{trade.symbol || '—'}</td>
                  <td className="hidden px-3 py-2.5 capitalize text-secondary compact:table-cell">{trade.market || '—'}</td>
                  <td className="px-3 py-2.5"><DirectionBadge direction={trade.direction} /></td>
                  <td className="px-3 py-2.5 text-secondary" dir="ltr">{formatDatetime(trade.entryDatetime)}</td>
                  <td className="hidden px-3 py-2.5 text-secondary compact:table-cell" dir="ltr">{formatDatetime(trade.exitDatetime)}</td>
                  <td className="px-3 py-2.5 text-end font-mono tabular-nums text-primary" dir="ltr">{formatCurrency(trade.entryPrice)}</td>
                  <td className="hidden px-3 py-2.5 text-end font-mono tabular-nums text-primary compact:table-cell" dir="ltr">{formatCurrency(trade.exitPrice)}</td>
                  <td className="px-3 py-2.5 text-end font-mono tabular-nums text-secondary" dir="ltr">{trade.quantity ?? '—'}</td>
                  <td className="px-3 py-2.5 text-end"><FinancialValue value={trade.pnlNet} formatter={formatSignedCurrency} /></td>
                  <td className="hidden px-3 py-2.5 text-end compact:table-cell"><FinancialValue value={trade.rMultiple} formatter={formatR} /></td>
                  <td className="hidden px-3 py-2.5 text-end font-mono tabular-nums text-secondary wide:table-cell" dir="ltr">{formatDuration(trade.durationMinutes)}</td>
                  <td className="px-3 py-2.5"><StatusBadge status={trade.status} /></td>
                  <td className="px-2 py-2.5 text-end"><TradeDeleteButton tradeId={trade.id} pending={pending} onDelete={handleDelete} /></td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="grid gap-3 adaptive:hidden" aria-label="Recorded trades">
        {trades.map((trade) => {
          const pending = deleteMutation.isPending && deleteMutation.variables === trade.id;
          return (
            <Card as="article" key={trade.id} density="compact" className="relative p-0">
              <Link to={`/trades/${trade.id}`} aria-label={`Open ${trade.symbol} trade details`} className="block rounded-lg p-4 pe-16 transition-colors hover:bg-surface-raised">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-mono text-base font-semibold text-primary" dir="ltr">{trade.symbol || '—'}</span>
                      <DirectionBadge direction={trade.direction} />
                      <StatusBadge status={trade.status} />
                    </div>
                    <p className="mt-1 truncate text-xs text-secondary">{accountLabel(trade.accountId, accounts)}</p>
                  </div>
                  <FinancialValue value={trade.pnlNet} formatter={formatSignedCurrency} className="text-sm font-semibold" />
                </div>
                <dl className="mt-4 grid grid-cols-2 gap-x-4 gap-y-3 text-xs">
                  <div><dt className="text-muted">Entry</dt><dd className="mt-1 text-secondary" dir="ltr">{formatDatetime(trade.entryDatetime)}</dd></div>
                  <div><dt className="text-muted">Quantity</dt><dd className="mt-1 font-mono text-secondary" dir="ltr">{trade.quantity ?? '—'}</dd></div>
                  <div><dt className="text-muted">Entry / exit</dt><dd className="mt-1 font-mono text-primary" dir="ltr">{formatCurrency(trade.entryPrice)} / {formatCurrency(trade.exitPrice)}</dd></div>
                  <div><dt className="text-muted">R multiple</dt><dd className="mt-1"><FinancialValue value={trade.rMultiple} formatter={formatR} /></dd></div>
                </dl>
                {(trade.strategy || trade.setup) && <p className="mt-3 truncate border-t border-default pt-3 text-xs text-secondary">{[trade.strategy, trade.setup].filter(Boolean).join(' · ')}</p>}
              </Link>
              <div className="absolute end-2 top-2">
                <TradeDeleteButton tradeId={trade.id} pending={pending} onDelete={handleDelete} mobile />
              </div>
            </Card>
          );
        })}
      </div>
    </>
  );
}
