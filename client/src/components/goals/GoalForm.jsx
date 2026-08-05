import { useForm } from 'react-hook-form';
import { DEFAULT_TIMEZONE, addDaysToDateKey, localTodayKey } from '../../utils/dateOnly.js';
import { Button } from '../ui/Button.jsx';
import { Field, Input, Select } from '../ui/FormControls.jsx';
import { GOAL_METRICS, GOAL_STATUSES, metricMeta } from './goalTypes.js';
import { useTranslation } from 'react-i18next';

export function GoalForm({ goal, timezone = DEFAULT_TIMEZONE, onSubmit, loading = false }) {
  const { t } = useTranslation();
  const today = localTodayKey(new Date(), timezone);
  const isEdit = Boolean(goal);
  const { register, handleSubmit, setValue, watch, formState: { errors } } = useForm({
    defaultValues: {
      name: goal?.name ?? '',
      description: goal?.description ?? '',
      metricKey: goal?.metricKey ?? 'net_pnl',
      targetValue: goal?.targetValue ?? '',
      startDate: goal?.startDate ?? today,
      endDate: goal?.endDate ?? addDaysToDateKey(today, 30),
      status: goal?.status ?? 'active',
    },
  });
  const metricKey = watch('metricKey');
  const startDate = watch('startDate');
  const metric = metricMeta(metricKey);
  const metricRegistration = register('metricKey', { required: t('validation.required', { field: t('goals.metric') }) });

  function validateTarget(value) {
    if (value === '' || value == null) return t('goals.targetRequired');
    const parsed = Number(value);
    if (!Number.isFinite(parsed)) return t('validation.invalidNumber');
    if (parsed < metric.min || parsed > metric.max) return t('validation.numberRange', { min: metric.min, max: metric.max });
    if (metric.unit === 'count' && !Number.isInteger(parsed)) return t('goals.wholeCount');
    return true;
  }

  function submit(values) {
    onSubmit({
      name: values.name.trim(),
      description: values.description.trim() || null,
      metricKey: values.metricKey,
      comparison: metricMeta(values.metricKey).comparison,
      targetValue: Number(values.targetValue),
      startDate: values.startDate,
      endDate: values.endDate,
      status: values.status,
    });
  }

  return (
    <form onSubmit={handleSubmit(submit)} className="space-y-4" noValidate>
      <Field label={t('goals.goalName')} required error={errors.name?.message}>
        {(fieldProps) => <Input data-autofocus maxLength={120} {...fieldProps} {...register('name', { required: t('goals.nameRequired'), validate: (value) => value.trim().length > 0 || t('goals.nameRequired'), maxLength: { value: 120, message: t('validation.maxLength', { field: t('goals.goalName'), max: 120 }) } })} />}
      </Field>

      <Field label={t('common.description')} helpText={t('routes.goals.description')} error={errors.description?.message}>
        {(fieldProps) => <textarea rows={3} maxLength={1000} className="input min-h-20 resize-y" {...fieldProps} {...register('description', { maxLength: { value: 1000, message: t('validation.maxLength', { field: t('common.description'), max: 1000 }) } })} />}
      </Field>

      <Field label={t('goals.metric')} required helpText={metric.help} error={errors.metricKey?.message}>
        {(fieldProps) => (
          <Select
            {...fieldProps}
            {...metricRegistration}
            onChange={(event) => {
              const changed = event.target.value !== metricKey;
              metricRegistration.onChange(event);
              if (changed) setValue('targetValue', '', { shouldDirty: true, shouldValidate: true });
            }}
          >
            {GOAL_METRICS.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
          </Select>
        )}
      </Field>

      <div className="grid gap-4 adaptive:grid-cols-2">
        <Field label={t('goals.comparison')} helpText={t('routes.goals.description')}>
          {({ id, ...fieldProps }) => <output id={id} className="input flex items-center bg-surface-sunken text-secondary" {...fieldProps}>{metric.comparisonLabel}</output>}
        </Field>
        <Field label={t('goals.targetWithUnit', { unit: metric.unit === 'currency' ? 'USD' : metric.unit === 'percent' ? '%' : metric.unit === 'r_multiple' ? 'R' : t('goals.countUnit') })} required error={errors.targetValue?.message}>
          {(fieldProps) => <Input type="number" numeric inputMode={metric.unit === 'count' ? 'numeric' : 'decimal'} step={metric.step} min={metric.min} max={metric.max} {...fieldProps} {...register('targetValue', { validate: validateTarget })} />}
        </Field>
      </div>

      <div className="grid gap-4 adaptive:grid-cols-2">
        <Field label={t('goals.startDate')} required error={errors.startDate?.message}>
          {(fieldProps) => <Input type="date" dir="ltr" max={watch('endDate') || undefined} {...fieldProps} {...register('startDate', { required: t('validation.required', { field: t('goals.startDate') }) })} />}
        </Field>
        <Field label={t('goals.endDate')} required error={errors.endDate?.message}>
          {(fieldProps) => <Input type="date" dir="ltr" min={startDate || undefined} {...fieldProps} {...register('endDate', { required: t('validation.required', { field: t('goals.endDate') }), validate: (value) => !startDate || value >= startDate || t('goals.endDateOrder') })} />}
        </Field>
      </div>

      <Field label={t('common.status')} required error={errors.status?.message}>
        {(fieldProps) => <Select {...fieldProps} {...register('status', { required: t('validation.required', { field: t('common.status') }) })}>{GOAL_STATUSES.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}</Select>}
      </Field>

      <Button type="submit" variant="primary" size="mobile" className="w-full" loading={loading}>
        {isEdit ? t('goals.saveGoal') : t('goals.createGoal')}
      </Button>
    </form>
  );
}
