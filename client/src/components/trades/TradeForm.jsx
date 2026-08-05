import { useForm } from 'react-hook-form';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '../../context/AuthContext.jsx';
import { accountsApi } from '../../api/accounts.js';
import { useTranslation } from 'react-i18next';

const MARKETS    = ['stocks', 'crypto', 'futures', 'forex'];
const DIRECTIONS = ['long', 'short'];
const TIMEFRAMES = ['1m', '2m', '3m', '5m', '10m', '15m', '30m', '1h', '2h', '4h', '1d', '1w'];

/**
 * Shared trade form used by QuickAddModal (create) and TradeDetail (edit).
 * In create mode (no defaultValues.id): shows required account selector.
 * In edit mode (defaultValues.id set): account is shown as read-only text.
 */
export function TradeForm({ defaultValues = {}, onSubmit, loading }) {
  const { t } = useTranslation();
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
      {!isEdit && field(`${t('common.account')} *`,
        <select className="input" {...register('accountId', { required: t('common.required') })}>
          <option value="">{t('accounts.chooseAccount', { defaultValue: 'Select account…' })}</option>
          {activeAccounts.map(a => (
            <option key={a.id} value={a.id}>{accountLabel(a)}</option>
          ))}
        </select>,
        errors.accountId
      )}

      {/* Row 1: Symbol + Market + Direction */}
      <div className="grid grid-cols-3 gap-3">
        {field(`${t('common.symbol')} *`,
          <input dir="ltr" className="input uppercase" placeholder="AAPL" {...register('symbol', { required: t('common.required') })} />,
          errors.symbol
        )}
        {field(`${t('common.market')} *`,
          <select className="input" {...register('market', { required: t('common.required') })}>
            {MARKETS.map(m => <option key={m} value={m}>{t(`status.${m}`, { defaultValue: m })}</option>)}
          </select>,
          errors.market
        )}
        {field(`${t('common.direction')} *`,
          <select className="input" {...register('direction', { required: t('common.required') })}>
            {DIRECTIONS.map(d => <option key={d} value={d}>{t(`status.${d}`)}</option>)}
          </select>,
          errors.direction
        )}
      </div>

      {/* Row 2: Entry datetime + Entry price + Quantity */}
      <div className="grid grid-cols-3 gap-3">
        {field(`${t('common.entry')} *`,
          <input type="datetime-local" dir="ltr" className="input" {...register('entryDatetime', { required: t('common.required') })} />,
          errors.entryDatetime
        )}
        {field(`${t('common.entryPrice')} *`,
          <input type="number" dir="ltr" step="any" className="input" placeholder="185.50" {...register('entryPrice', { required: t('common.required'), valueAsNumber: true })} />,
          errors.entryPrice
        )}
        {field(`${t('common.quantity')} *`,
          <input type="number" dir="ltr" step="any" className="input" placeholder="100" {...register('quantity', { required: t('common.required'), valueAsNumber: true })} />,
          errors.quantity
        )}
      </div>

      {/* Row 3: Exit datetime + Exit price + Fees */}
      <div className="grid grid-cols-3 gap-3">
        {field(t('common.exit'),
          <input type="datetime-local" dir="ltr" className="input" {...register('exitDatetime')} />
        )}
        {field(t('common.exitPrice'),
          <input type="number" dir="ltr" step="any" className="input" placeholder="187.20" {...register('exitPrice', { valueAsNumber: true })} />
        )}
        {field(t('common.fees'),
          <input type="number" dir="ltr" step="any" className="input" placeholder="0" {...register('fees', { valueAsNumber: true })} />
        )}
      </div>

      {/* Row 4: Strategy + Setup + Timeframe */}
      <div className="grid grid-cols-3 gap-3">
        {field(t('common.strategy'),
          <input className="input" placeholder="breakout" {...register('strategy')} />
        )}
        {field(t('common.setup'),
          <input className="input" placeholder="bull-flag" {...register('setup')} />
        )}
        {field(t('common.timeframe'),
          <select className="input" {...register('timeframe')}>
            <option value="">—</option>
            {TIMEFRAMES.map(t => <option key={t}>{t}</option>)}
          </select>
        )}
      </div>

      {/* Row 5: Risk / SL / TP */}
      <div className="grid grid-cols-3 gap-3">
        {field(t('common.riskAmount'),
          <input type="number" step="any" className="input" placeholder="100" {...register('riskAmount', { valueAsNumber: true })} />
        )}
        {field(t('common.stopLoss'),
          <input type="number" step="any" className="input" placeholder="184.50" {...register('stopLoss', { valueAsNumber: true })} />
        )}
        {field(t('common.takeProfit'),
          <input type="number" step="any" className="input" placeholder="188.50" {...register('takeProfit', { valueAsNumber: true })} />
        )}
      </div>

      {/* Notes */}
      <div>
        <label className="label">{t('common.notes')}</label>
        <textarea
          rows={3}
          className="input resize-none"
          placeholder={t('trades.notesPlaceholder')}
          {...register('notes')}
        />
      </div>

      {/* Submit */}
      <div className="pt-2">
        <button type="submit" disabled={loading} className="btn-primary w-full">
          {loading ? t('common.saving') : (isEdit ? t('trades.editTrade') : t('trades.addTrade'))}
        </button>
      </div>
    </form>
  );
}
