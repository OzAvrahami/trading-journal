import { useForm } from 'react-hook-form';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '../../context/AuthContext.jsx';
import { accountsApi } from '../../api/accounts.js';

const MARKETS    = ['stocks', 'crypto', 'futures', 'forex'];
const DIRECTIONS = ['long', 'short'];
const TIMEFRAMES = ['1m', '2m', '3m', '5m', '10m', '15m', '30m', '1h', '2h', '4h', '1d', '1w'];

/**
 * Shared trade form used by QuickAddModal (create) and TradeDetail (edit).
 * In create mode (no defaultValues.id): shows required account selector.
 * In edit mode (defaultValues.id set): account is shown as read-only text.
 */
export function TradeForm({ defaultValues = {}, onSubmit, loading }) {
  const { user } = useAuth();
  const isEdit = Boolean(defaultValues.id);

  const { data: accounts = [] } = useQuery({
    queryKey: ['accounts'],
    queryFn:  accountsApi.list,
  });

  const activeAccounts = accounts.filter(a => a.status === 'active');

  const { register, handleSubmit, formState: { errors } } = useForm({
    defaultValues: {
      market:    defaultValues.market    || user?.defaults?.market    || 'stocks',
      timeframe: defaultValues.timeframe || user?.defaults?.timeframe || '5m',
      direction: 'long',
      fees: 0,
      ...defaultValues,
    },
  });

  function handleFormSubmit(data) {
    if (data.entryDatetime) data.entryDatetime = new Date(data.entryDatetime).toISOString();
    if (data.exitDatetime)  data.exitDatetime  = new Date(data.exitDatetime).toISOString();

    const nums = ['entryPrice', 'exitPrice', 'quantity', 'fees', 'riskAmount', 'stopLoss', 'takeProfit'];
    nums.forEach(k => {
      if (data[k] !== '' && data[k] != null) data[k] = parseFloat(data[k]);
      else delete data[k];
    });

    ['strategy', 'setup', 'notes'].forEach(k => {
      if (data[k] === '') data[k] = null;
    });

    onSubmit(data);
  }

  function accountLabel(a) {
    const base = `${a.company} — ${a.accountNumber}`;
    return a.accountName ? `${base} (${a.accountName})` : base;
  }

  const field = (label, children, error) => (
    <div>
      <label className="label">{label}</label>
      {children}
      {error && <p className="text-xs text-red-400 mt-1">{error.message}</p>}
    </div>
  );

  return (
    <form onSubmit={handleSubmit(handleFormSubmit)} className="space-y-4">
      {/* Account selector (create only) */}
      {!isEdit && field('Account *',
        <select className="input" {...register('accountId', { required: 'Required' })}>
          <option value="">Select account…</option>
          {activeAccounts.map(a => (
            <option key={a.id} value={a.id}>{accountLabel(a)}</option>
          ))}
        </select>,
        errors.accountId
      )}

      {/* Row 1: Symbol + Market + Direction */}
      <div className="grid grid-cols-3 gap-3">
        {field('Symbol *',
          <input className="input uppercase" placeholder="AAPL" {...register('symbol', { required: 'Required' })} />,
          errors.symbol
        )}
        {field('Market *',
          <select className="input" {...register('market', { required: 'Required' })}>
            {MARKETS.map(m => <option key={m}>{m}</option>)}
          </select>,
          errors.market
        )}
        {field('Direction *',
          <select className="input" {...register('direction', { required: 'Required' })}>
            {DIRECTIONS.map(d => <option key={d}>{d}</option>)}
          </select>,
          errors.direction
        )}
      </div>

      {/* Row 2: Entry datetime + Entry price + Quantity */}
      <div className="grid grid-cols-3 gap-3">
        {field('Entry Time *',
          <input type="datetime-local" className="input" {...register('entryDatetime', { required: 'Required' })} />,
          errors.entryDatetime
        )}
        {field('Entry Price *',
          <input type="number" step="any" className="input" placeholder="185.50" {...register('entryPrice', { required: 'Required', valueAsNumber: true })} />,
          errors.entryPrice
        )}
        {field('Quantity *',
          <input type="number" step="any" className="input" placeholder="100" {...register('quantity', { required: 'Required', valueAsNumber: true })} />,
          errors.quantity
        )}
      </div>

      {/* Row 3: Exit datetime + Exit price + Fees */}
      <div className="grid grid-cols-3 gap-3">
        {field('Exit Time',
          <input type="datetime-local" className="input" {...register('exitDatetime')} />
        )}
        {field('Exit Price',
          <input type="number" step="any" className="input" placeholder="187.20" {...register('exitPrice', { valueAsNumber: true })} />
        )}
        {field('Fees',
          <input type="number" step="any" className="input" placeholder="0" {...register('fees', { valueAsNumber: true })} />
        )}
      </div>

      {/* Row 4: Strategy + Setup + Timeframe */}
      <div className="grid grid-cols-3 gap-3">
        {field('Strategy',
          <input className="input" placeholder="breakout" {...register('strategy')} />
        )}
        {field('Setup',
          <input className="input" placeholder="bull-flag" {...register('setup')} />
        )}
        {field('Timeframe',
          <select className="input" {...register('timeframe')}>
            <option value="">—</option>
            {TIMEFRAMES.map(t => <option key={t}>{t}</option>)}
          </select>
        )}
      </div>

      {/* Row 5: Risk / SL / TP */}
      <div className="grid grid-cols-3 gap-3">
        {field('Risk Amount ($)',
          <input type="number" step="any" className="input" placeholder="100" {...register('riskAmount', { valueAsNumber: true })} />
        )}
        {field('Stop Loss',
          <input type="number" step="any" className="input" placeholder="184.50" {...register('stopLoss', { valueAsNumber: true })} />
        )}
        {field('Take Profit',
          <input type="number" step="any" className="input" placeholder="188.50" {...register('takeProfit', { valueAsNumber: true })} />
        )}
      </div>

      {/* Notes */}
      <div>
        <label className="label">Notes</label>
        <textarea
          rows={3}
          className="input resize-none"
          placeholder="Strong volume on breakout..."
          {...register('notes')}
        />
      </div>

      {/* Submit */}
      <div className="pt-2">
        <button type="submit" disabled={loading} className="btn-primary w-full">
          {loading ? 'Saving…' : (isEdit ? 'Update Trade' : 'Add Trade')}
        </button>
      </div>
    </form>
  );
}
