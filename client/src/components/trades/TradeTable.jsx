import { formatCurrency, formatDatetime, formatDuration, formatR, pnlColor } from '../../utils/formatters.js';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { tradesApi } from '../../api/trades.js';
import { useToast } from '../ui/Toast.jsx';
import { useNavigate } from 'react-router-dom';

function DirectionBadge({ direction }) {
  return (
    <span className={`badge ${direction === 'long' ? 'badge-green' : 'badge-red'}`}>
      {direction === 'long' ? '▲ Long' : '▼ Short'}
    </span>
  );
}

function StatusBadge({ status }) {
  return (
    <span className={`badge ${status === 'closed' ? 'badge-gray' : 'badge-blue'}`}>
      {status}
    </span>
  );
}

export function TradeTable({ trades, loading }) {
  const qc = useQueryClient();
  const toast = useToast();
  const navigate = useNavigate();

  const deleteMutation = useMutation({
    mutationFn: (id) => tradesApi.remove(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['trades'] });
      qc.invalidateQueries({ queryKey: ['analytics'] });
      toast.success('Trade deleted.');
    },
    onError: () => toast.error('Failed to delete trade.'),
  });

  function handleDelete(e, id) {
    e.stopPropagation();
    if (!confirm('Delete this trade?')) return;
    deleteMutation.mutate(id);
  }

  if (loading) {
    return (
      <div className="card text-center py-16 text-gray-500">Loading trades…</div>
    );
  }

  if (!trades?.length) {
    return (
      <div className="card text-center py-16 text-gray-500">
        No trades found. Add your first trade to get started.
      </div>
    );
  }

  return (
    <div className="overflow-x-auto rounded-xl border border-gray-800">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-gray-800 bg-gray-900">
            {['Symbol','Market','Direction','Entry','Exit','Entry $','Exit $','Qty','PnL Net','R','Duration','Status',''].map(h => (
              <th key={h} className="px-3 py-3 text-left text-xs font-medium text-gray-500 whitespace-nowrap">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-800">
          {trades.map(trade => (
            <tr
              key={trade.id}
              onClick={() => navigate(`/trades/${trade.id}`)}
              className="bg-gray-950 hover:bg-gray-900 cursor-pointer transition"
            >
              <td className="px-3 py-3 font-medium text-gray-100 whitespace-nowrap">{trade.symbol}</td>
              <td className="px-3 py-3 text-gray-400 capitalize">{trade.market}</td>
              <td className="px-3 py-3"><DirectionBadge direction={trade.direction} /></td>
              <td className="px-3 py-3 text-gray-400 whitespace-nowrap">{formatDatetime(trade.entryDatetime)}</td>
              <td className="px-3 py-3 text-gray-400 whitespace-nowrap">{trade.exitDatetime ? formatDatetime(trade.exitDatetime) : '—'}</td>
              <td className="px-3 py-3 text-gray-300">{formatCurrency(trade.entryPrice)}</td>
              <td className="px-3 py-3 text-gray-300">{trade.exitPrice ? formatCurrency(trade.exitPrice) : '—'}</td>
              <td className="px-3 py-3 text-gray-400">{trade.quantity}</td>
              <td className={`px-3 py-3 font-semibold ${pnlColor(trade.pnlNet)}`}>
                {trade.pnlNet != null ? formatCurrency(trade.pnlNet) : '—'}
              </td>
              <td className={`px-3 py-3 font-medium ${pnlColor(trade.rMultiple)}`}>
                {trade.rMultiple != null ? formatR(trade.rMultiple) : '—'}
              </td>
              <td className="px-3 py-3 text-gray-400 whitespace-nowrap">{formatDuration(trade.durationMinutes)}</td>
              <td className="px-3 py-3"><StatusBadge status={trade.status} /></td>
              <td className="px-3 py-3">
                <button
                  onClick={(e) => handleDelete(e, trade.id)}
                  className="text-gray-600 hover:text-red-400 transition text-xs px-2 py-1"
                  title="Delete trade"
                >
                  ✕
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
