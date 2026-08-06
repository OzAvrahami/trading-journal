import { useEffect, useId, useMemo, useRef, useState } from 'react';
import { useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { ArrowSquareOut, FloppyDisk, Plus } from '@phosphor-icons/react';
import { useAuth } from '../../context/AuthContext.jsx';
import { Button } from '../ui/Button.jsx';
import { Card } from '../ui/Card.jsx';
import {
  accountDisplayLabel, createTradeFormValues, DIRECTIONS, MARKETS, normalizeTradePayload,
  applyTradeFormMode, readTradeFormMode, TIMEFRAMES, TRADE_FORM_MODE_EVENT, validateTradeForm,
} from './tradeFormModel.js';
import { useOptionalPreferences } from '../../context/PreferencesContext.jsx';

function Field({ id, label, required, error, help, children }) {
  const errorId = error ? `${id}-error` : undefined;
  const helpId = help ? `${id}-help` : undefined;
  return (
    <div className="min-w-0">
      <label htmlFor={id} className="label">{label}{required ? <span aria-hidden="true"> *</span> : null}</label>
      {children({ id, 'aria-invalid': Boolean(error), 'aria-describedby': [errorId, helpId].filter(Boolean).join(' ') || undefined })}
      {help && <p id={helpId} className="mt-1 text-xs text-muted">{help}</p>}
      {error && <p id={errorId} role="alert" className="mt-1 text-xs text-negative">{error.message}</p>}
    </div>
  );
}

function Section({ id, title, detail, children }) {
  return (
    <Card aria-labelledby={id} className="space-y-4">
      <div>
        <h2 id={id} className="text-sm font-semibold text-primary">{title}</h2>
        {detail && <p className="mt-1 text-xs text-muted">{detail}</p>}
      </div>
      {children}
    </Card>
  );
}

export function TradeForm({
  defaultValues,
  accounts = [],
  managedStrategies = [],
  managedSetups = [],
  timezone,
  isEdit = false,
  variant = 'editor',
  loading = false,
  resetVersion = 0,
  preservedAccountId = '',
  onSubmit,
  onCancel,
  onOpenFullForm,
  onDirtyChange,
}) {
  const { t } = useTranslation();
  const { user } = useAuth();
  const preferences = useOptionalPreferences();
  const formId = useId().replace(/:/g, '');
  const initialValues = useMemo(
    () => defaultValues || createTradeFormValues({ user, timezone, accountId: preservedAccountId }),
    [defaultValues, preservedAccountId, timezone, user],
  );
  const [mode, setMode] = useState(variant === 'quick' ? 'simple' : readTradeFormMode);
  const symbolRef = useRef(null);
  const mountedRef = useRef(false);
  const {
    register, handleSubmit, watch, reset, setError, setFocus, setValue,
    formState: { errors, isDirty },
  } = useForm({ defaultValues: initialValues, shouldUnregister: false });
  const status = watch('status');
  const strategyId = watch('strategyId');
  const setupId = watch('setupId');

  useEffect(() => { onDirtyChange?.(isDirty); }, [isDirty, onDirtyChange]);
  useEffect(() => {
    if (variant === 'quick') return undefined;
    const handleModeChange = (event) => setMode(event.detail);
    window.addEventListener(TRADE_FORM_MODE_EVENT, handleModeChange);
    return () => window.removeEventListener(TRADE_FORM_MODE_EVENT, handleModeChange);
  }, [variant]);
  useEffect(() => {
    if (!mountedRef.current) {
      mountedRef.current = true;
      return;
    }
    reset(createTradeFormValues({ user, timezone, accountId: preservedAccountId }));
    requestAnimationFrame(() => symbolRef.current?.focus());
  }, [resetVersion]); // resetVersion intentionally owns the add-another reset

  function changeMode(next) {
    if (preferences) {
      preferences.updatePreference('tradeFormMode', next).catch(() => {});
    } else {
      applyTradeFormMode(next);
    }
  }

  async function submit(values, event) {
    const validation = validateTradeForm(values, { timezone, isEdit, t });
    const entries = Object.entries(validation);
    if (entries.length) {
      entries.forEach(([name, message]) => setError(name, { type: 'manual', message }));
      setFocus(entries[0][0]);
      return;
    }
    const intent = event?.nativeEvent?.submitter?.value || 'save';
    await onSubmit(normalizeTradePayload(values, { timezone, isEdit }), intent, values);
  }

  const field = (name, label, child, options = {}) => (
    <Field id={`${formId}-${name}`} label={label} required={options.required} help={options.help} error={errors[name]}>
      {(accessibility) => child({
        ...register(name, options.rules),
        ...accessibility,
      })}
    </Field>
  );
  const coreLocked = isEdit;
  const selectableAccounts = isEdit ? accounts : accounts.filter((account) => account.status === 'active');
  const strategyOptions = managedStrategies.filter((strategy) => strategy.isActive || strategy.id === strategyId);
  const setupOptions = managedSetups.filter((setup) => setup.strategyId === strategyId && (setup.isActive || setup.id === setupId));
  const grid = 'grid gap-4 adaptive:grid-cols-2 wide:grid-cols-3';

  function changeManagedStrategy(event) {
    const nextId = event.target.value;
    const selected = managedStrategies.find((strategy) => strategy.id === nextId);
    setValue('strategyId', nextId, { shouldDirty: true, shouldValidate: true });
    if (selected) setValue('strategy', selected.name, { shouldDirty: true });
    setValue('setupId', '', { shouldDirty: true });
    setValue('setup', '', { shouldDirty: true });
  }

  function changeManagedSetup(event) {
    const nextId = event.target.value;
    const selected = managedSetups.find((setup) => setup.id === nextId);
    setValue('setupId', nextId, { shouldDirty: true, shouldValidate: true });
    if (selected) setValue('setup', selected.name, { shouldDirty: true });
  }

  const classificationFields = (quick = false) => (
    <div className={quick ? 'grid gap-4' : grid}>
      <Field id={`${formId}-strategyId`} label={t('strategies.managedStrategy')} help={t('strategies.hybridHelp')} error={errors.strategyId}>
        {(accessibility) => (
          <select
            {...register('strategyId')}
            {...accessibility}
            value={strategyId || ''}
            onChange={changeManagedStrategy}
            className="input min-h-11"
            dir="auto"
          >
            <option value="">{t('strategies.customLegacyValue')}</option>
            {strategyOptions.map((strategy) => (
              <option key={strategy.id} value={strategy.id}>{strategy.name}{strategy.isActive ? '' : ` · ${t('status.archived')}`}</option>
            ))}
          </select>
        )}
      </Field>
      {!strategyId && field('strategy', t('common.strategy'), (props) => <input {...props} className="input min-h-11" dir="auto" placeholder={t('trades.strategyPlaceholder')} />)}
      {!quick && strategyId && (
        <Field id={`${formId}-setupId`} label={t('strategies.managedSetup')} error={errors.setupId}>
          {(accessibility) => (
            <select
              {...register('setupId')}
              {...accessibility}
              value={setupId || ''}
              onChange={changeManagedSetup}
              className="input min-h-11"
              dir="auto"
            >
              <option value="">{t('strategies.customLegacyValue')}</option>
              {setupOptions.map((setup) => (
                <option key={setup.id} value={setup.id}>{setup.name}{setup.isActive ? '' : ` · ${t('status.archived')}`}</option>
              ))}
            </select>
          )}
        </Field>
      )}
      {!quick && !setupId && field('setup', t('common.setup'), (props) => <input {...props} className="input min-h-11" dir="auto" placeholder={t('trades.setupPlaceholder')} />)}
    </div>
  );

  return (
    <form noValidate onSubmit={handleSubmit(submit)} className="space-y-4" data-testid={`trade-form-${variant}`}>
      {variant === 'editor' && (
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-sm font-medium text-primary">{t('trades.presentationMode')}</p>
            <p className="text-xs text-muted">{t('trades.presentationModeHelp')}</p>
          </div>
          <div role="group" aria-label={t('trades.presentationMode')} className="flex rounded-md border border-default bg-surface-sunken p-1">
            {['simple', 'advanced'].map((item) => (
              <button key={item} type="button" aria-pressed={mode === item} onClick={() => changeMode(item)} className={`min-h-11 rounded px-4 text-sm font-medium transition-colors ${mode === item ? 'bg-surface text-primary shadow-flat' : 'text-secondary hover:text-primary'}`}>
                {t(`trades.${item}`)}
              </button>
            ))}
          </div>
        </div>
      )}

      <Section id={`${formId}-identity`} title={t('trades.sections.identity')} detail={isEdit ? t('trades.identityLockedHelp') : t('trades.sections.identityHelp')}>
        <div className={grid}>
          {field('accountId', t('common.account'), (props) => (
            <select {...props} className="input min-h-11" disabled={coreLocked} dir="auto">
              <option value="">{t('trades.selectAccount')}</option>
              {selectableAccounts.map((account) => <option key={account.id} value={account.id}>{accountDisplayLabel(account)} · {t(`status.${account.status}`)}</option>)}
            </select>
          ), { required: !isEdit })}
          {field('symbol', t('common.symbol'), (props) => <input {...props} ref={(node) => { props.ref(node); symbolRef.current = node; }} className="input min-h-11 uppercase" dir="ltr" autoComplete="off" placeholder={t('trades.symbolPlaceholder')} disabled={coreLocked} />, { required: true })}
          {field('market', t('common.market'), (props) => (
            <select {...props} className="input min-h-11" disabled={coreLocked}>{MARKETS.map((market) => <option key={market} value={market}>{t(`status.${market}`)}</option>)}</select>
          ), { required: true })}
          {field('direction', t('common.direction'), (props) => (
            <select {...props} className="input min-h-11" disabled={coreLocked}>{DIRECTIONS.map((direction) => <option key={direction} value={direction}>{t(`status.${direction}`)}</option>)}</select>
          ), { required: true })}
          {field('status', t('common.status'), (props) => (
            <select {...props} className="input min-h-11"><option value="open">{t('status.open')}</option><option value="closed">{t('status.closed')}</option></select>
          ), { required: true, help: t('trades.statusHelp') })}
        </div>
      </Section>

      <Section id={`${formId}-entry`} title={t('trades.sections.entry')}>
        <div className={grid}>
          {field('entryDatetime', t('trades.entryDatetime'), (props) => <input {...props} type="datetime-local" className="input min-h-11" dir="ltr" disabled={coreLocked} />, { required: true, help: t('trades.timezoneHelp', { timezone }) })}
          {field('entryPrice', t('common.entryPrice'), (props) => <input {...props} type="number" inputMode="decimal" step="any" className="input min-h-11" dir="ltr" disabled={coreLocked} />, { required: true })}
          {field('quantity', t('common.quantity'), (props) => <input {...props} type="number" inputMode="decimal" step="any" className="input min-h-11" dir="ltr" />, { required: true })}
          {field('fees', t('common.fees'), (props) => <input {...props} type="number" inputMode="decimal" min="0" step="any" className="input min-h-11" dir="ltr" />, { required: true })}
        </div>
      </Section>

      {status === 'closed' && (
        <Section id={`${formId}-exit`} title={t('trades.sections.exit')} detail={t('trades.closedTradeHelp')}>
          <div className="grid gap-4 adaptive:grid-cols-2">
            {field('exitDatetime', t('trades.exitDatetime'), (props) => <input {...props} type="datetime-local" className="input min-h-11" dir="ltr" />, { required: true, help: t('trades.timezoneHelp', { timezone }) })}
            {field('exitPrice', t('common.exitPrice'), (props) => <input {...props} type="number" inputMode="decimal" step="any" className="input min-h-11" dir="ltr" />, { required: true })}
          </div>
        </Section>
      )}

      {variant !== 'quick' && (
        <Section id={`${formId}-context`} title={t('trades.sections.context')}>
          {classificationFields(false)}
          <div className={`${grid} mt-4`}>
            {mode === 'advanced' && field('timeframe', t('common.timeframe'), (props) => (
              <select {...props} className="input min-h-11" dir="ltr"><option value="">—</option>{TIMEFRAMES.map((timeframe) => <option key={timeframe} value={timeframe}>{timeframe}</option>)}</select>
            ))}
          </div>
        </Section>
      )}

      {variant === 'quick' && managedStrategies.length > 0 && (
        <Section id={`${formId}-classification`} title={t('strategies.classification')} detail={t('strategies.quickAddBoundary')}>
          {classificationFields(true)}
        </Section>
      )}

      {variant !== 'quick' && mode === 'advanced' && (
        <Section id={`${formId}-risk`} title={t('trades.sections.risk')} detail={t('trades.sections.riskHelp')}>
          <div className={grid}>
            {field('riskAmount', t('common.riskAmount'), (props) => <input {...props} type="number" inputMode="decimal" step="any" className="input min-h-11" dir="ltr" />)}
            {field('stopLoss', t('common.stopLoss'), (props) => <input {...props} type="number" inputMode="decimal" step="any" className="input min-h-11" dir="ltr" />)}
            {field('takeProfit', t('common.takeProfit'), (props) => <input {...props} type="number" inputMode="decimal" step="any" className="input min-h-11" dir="ltr" />)}
          </div>
        </Section>
      )}

      {variant !== 'quick' && (
        <Section id={`${formId}-notes`} title={t('trades.sections.notes')}>
          <div className="grid gap-4 adaptive:grid-cols-2">
            <div className={mode === 'advanced' ? '' : 'adaptive:col-span-2'}>
              {field('notes', t('common.notes'), (props) => <textarea {...props} rows={5} className="input min-h-32 resize-y" placeholder={t('trades.notesPlaceholder')} />)}
            </div>
            {mode === 'advanced' && (
              <div className="space-y-4">
                {field('emotionPre', t('trades.emotionPre'), (props) => <input {...props} className="input min-h-11" dir="auto" />)}
                {field('emotionDuring', t('trades.emotionDuring'), (props) => <input {...props} className="input min-h-11" dir="auto" />)}
                {field('emotionPost', t('trades.emotionPost'), (props) => <input {...props} className="input min-h-11" dir="auto" />)}
              </div>
            )}
          </div>
          {mode === 'advanced' && field('screenshotLinks', t('trades.screenshots'), (props) => <textarea {...props} rows={3} className="input resize-y" dir="ltr" placeholder="https://…" />, { help: t('trades.screenshotHelp') })}
        </Section>
      )}

      <div className={`flex flex-col-reverse gap-2 border-t border-default pt-4 adaptive:flex-row ${variant === 'editor' ? 'adaptive:justify-end' : ''}`}>
        {onCancel && <Button type="button" size="mobile" className="w-full adaptive:w-auto" onClick={onCancel}>{t('common.cancel')}</Button>}
        {variant === 'quick' && onOpenFullForm && (
          <Button type="button" variant="tertiary" size="mobile" className="w-full adaptive:w-auto" leadingIcon={<ArrowSquareOut size={17} aria-hidden="true" />} onClick={() => onOpenFullForm(isDirty)}>{t('trades.openFullForm')}</Button>
        )}
        {variant === 'editor' && !isEdit && (
          <Button type="submit" name="intent" value="addAnother" size="mobile" className="w-full adaptive:w-auto" disabled={loading} leadingIcon={<Plus size={17} aria-hidden="true" />}>{t('trades.saveAndAddAnother')}</Button>
        )}
        <Button type="submit" name="intent" value="save" variant="primary" size="mobile" className="w-full adaptive:w-auto" loading={loading} leadingIcon={<FloppyDisk size={17} aria-hidden="true" />}>
          {isEdit ? t('trades.saveChanges') : variant === 'quick' ? t('trades.quickAdd') : t('trades.saveTrade')}
        </Button>
      </div>
    </form>
  );
}
