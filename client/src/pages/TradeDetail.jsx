import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { tradesApi } from '../api/trades.js';
import { TradeForm } from '../components/trades/TradeForm.jsx';
import { Spinner } from '../components/ui/Spinner.jsx';
import { useToast } from '../components/ui/Toast.jsx';
import { formatCurrency, formatDatetime, formatDuration, formatR, pnlColor } from '../utils/formatters.js';

export default function TradeDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const toast = useToast();
  const [editing, setEditing] = useState(false);

  const { data: trade, isLoading } = useQuery({
    queryKey: ['trade', id],
    queryFn: () => tradesApi.get(id),
  });

  const updateMutation = useMutation({
    mutationFn: (data) => tradesApi.update(id, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['trade', id] });
      qc.invalidateQueries({ queryKey: ['trades'] });
      qc.invalidateQueries({ queryKey: ['analytics'] });
      setEditing(false);
      toast.success('Trade updated!');
    },
    onError: (err) => toast.error(err.response?.data?.error?.message || 'Update failed.'),
  });

  const deleteMutation = useMutation({
    mutationFn: () => tradesApi.remove(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['trades'] });
      qc.invalidateQueries({ queryKey: ['analytics'] });
      navigate('/trades');
      toast.success('Trade deleted.');
    },
    onError: () => toast.error('Failed to delete trade.'),
  });

  if (isLoading) return <div className="flex justify-center py-24"><Spinner className="w-8 h-8" /></div>;
  if (!trade) return <div className="text-center py-24 text-gray-500">Trade not found.</div>;

  function handleDelete() {
    if (!confirm('Delete this trade permanently?')) return;
    deleteMutation.mutate();
  }

  // Prepare default values for the edit form (convert ISO to datetime-local format)
  const toLocalInput = (iso) => iso ? new Date(iso).toISOString().slice(0, 16) : '';

  const editDefaults = {
    ...trade,
    entryDatetime: toLocalInput(trade.entryDatetime),
    exitDatetime:  toLocalInput(trade.exitDatetime),
  };

  const Row = ({ label, value, valueClass }) => (
    <div className="flex justify-between items-center py-2 border-b border-gray-800 last:border-0">
      <span className="text-xs text-gray-500">{label}</span>
      <span className={`text-sm font-medium ${valueClass || 'text-gray-200'}`}>{value || '—'}</span>
    </div>
  );

  return (
    <div className="max-w-2xl mx-auto space-y-4">
      {/* Back button */}
      <button onClick={() => navigate(-1)} className="text-sm text-gray-500 hover:text-gray-300 transition">
        ← Back to Trades
      </button>

      {/* Header */}
      <div className="card">
        <div className="flex items-start justify-between mb-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-100">{trade.symbol}</h1>
            <p className="text-sm text-gray-500 capitalize">{trade.market} · {trade.direction} · {trade.timeframe || 'N/A'}</p>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => setEditing(e => !e)}
              className="btn-secondary text-xs"
            >
              {editing ? 'Cancel' : 'Edit'}
            </button>
            <button onClick={handleDelete} className="btn-danger text-xs">
              Delete
            </button>
          </div>
        </div>

        {/* Computed results */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 p-3 bg-gray-800 rounded-lg mb-4">
          <div className="text-center">
            <p className="text-xs text-gray-500 mb-1">PnL Net</p>
            <p className={`text-xl font-bold ${pnlColor(trade.pnlNet)}`}>
              {formatCurrency(trade.pnlNet)}
            </p>
          </div>
          <div className="text-center">
            <p className="text-xs text-gray-500 mb-1">R-Multiple</p>
            <p className={`text-xl font-bold ${pnlColor(trade.rMultiple)}`}>
              {formatR(trade.rMultiple)}
            </p>
          </div>
          <div className="text-center">
            <p className="text-xs text-gray-500 mb-1">Duration</p>
            <p className="text-xl font-bold text-gray-200">{formatDuration(trade.durationMinutes)}</p>
          </div>
          <div className="text-center">
            <p className="text-xs text-gray-500 mb-1">Status</p>
            <p className={`text-xl font-bold ${trade.status === 'closed' ? 'text-gray-400' : 'text-blue-400'}`}>
              {trade.status}
            </p>
          </div>
        </div>

        {/* Details rows */}
        <Row label="Entry Time"   value={formatDatetime(trade.entryDatetime)} />
        <Row label="Exit Time"    value={formatDatetime(trade.exitDatetime)} />
        <Row label="Entry Price"  value={formatCurrency(trade.entryPrice)} />
        <Row label="Exit Price"   value={trade.exitPrice ? formatCurrency(trade.exitPrice) : null} />
        <Row label="Quantity"     value={trade.quantity} />
        <Row label="Fees"         value={formatCurrency(trade.fees)} />
        <Row label="Gross PnL"    value={formatCurrency(trade.pnlGross)} valueClass={pnlColor(trade.pnlGross)} />
        <Row label="Risk Amount"  value={trade.riskAmount ? formatCurrency(trade.riskAmount) : null} />
        <Row label="Stop Loss"    value={trade.stopLoss ? formatCurrency(trade.stopLoss) : null} />
        <Row label="Take Profit"  value={trade.takeProfit ? formatCurrency(trade.takeProfit) : null} />
        <Row label="Strategy"     value={trade.strategy} />
        <Row label="Setup"        value={trade.setup} />
        {trade.emotions && (
          <>
            <Row label="Emotion (Pre)"    value={trade.emotions.pre} />
            <Row label="Emotion (During)" value={trade.emotions.during} />
            <Row label="Emotion (Post)"   value={trade.emotions.post} />
          </>
        )}
        {trade.notes && (
          <div className="pt-3">
            <p className="text-xs text-gray-500 mb-1">Notes</p>
            <p className="text-sm text-gray-300 leading-relaxed whitespace-pre-wrap">{trade.notes}</p>
          </div>
        )}
      </div>

      {/* Edit form */}
      {editing && (
        <div className="card">
          <h2 className="text-sm font-semibold text-gray-300 mb-4">Edit Trade</h2>
          <TradeForm
            defaultValues={editDefaults}
            onSubmit={updateMutation.mutate}
            loading={updateMutation.isPending}
          />
        </div>
      )}
    </div>
  );
}
