import { useForm } from 'react-hook-form';
import { DEFAULT_TIMEZONE, addDaysToDateKey, localTodayKey } from '../../utils/dateOnly.js';
import { Button } from '../ui/Button.jsx';
import { Field, Input, Select } from '../ui/FormControls.jsx';
import { GOAL_METRICS, GOAL_STATUSES, metricMeta } from './goalTypes.js';

export function GoalForm({ goal, timezone = DEFAULT_TIMEZONE, onSubmit, loading = false }) {
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
  const metricRegistration = register('metricKey', { required: 'Choose a metric.' });

  function validateTarget(value) {
    if (value === '' || value == null) return 'Enter a target value.';
    const parsed = Number(value);
    if (!Number.isFinite(parsed)) return 'Enter a valid number.';
    if (parsed < metric.min || parsed > metric.max) return `Enter a value from ${metric.min} to ${metric.max}.`;
    if (metric.unit === 'count' && !Number.isInteger(parsed)) return 'Count targets must be whole numbers.';
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
      <Field label="Goal name" required error={errors.name?.message}>
        {(fieldProps) => <Input data-autofocus maxLength={120} {...fieldProps} {...register('name', { required: 'Enter a goal name.', validate: (value) => value.trim().length > 0 || 'Enter a goal name.', maxLength: { value: 120, message: 'Use 120 characters or fewer.' } })} />}
      </Field>

      <Field label="Description" helpText="Optional context for why this goal matters." error={errors.description?.message}>
        {(fieldProps) => <textarea rows={3} maxLength={1000} className="input min-h-20 resize-y" {...fieldProps} {...register('description', { maxLength: { value: 1000, message: 'Use 1,000 characters or fewer.' } })} />}
      </Field>

      <Field label="Metric" required helpText={metric.help} error={errors.metricKey?.message}>
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
        <Field label="Comparison" helpText="Derived from the selected metric.">
          {({ id, ...fieldProps }) => <output id={id} className="input flex items-center bg-surface-sunken text-secondary" {...fieldProps}>{metric.comparisonLabel}</output>}
        </Field>
        <Field label={`Target (${metric.unit === 'currency' ? 'USD' : metric.unit === 'percent' ? '%' : metric.unit === 'r_multiple' ? 'R' : 'count'})`} required error={errors.targetValue?.message}>
          {(fieldProps) => <Input type="number" numeric inputMode={metric.unit === 'count' ? 'numeric' : 'decimal'} step={metric.step} min={metric.min} max={metric.max} {...fieldProps} {...register('targetValue', { validate: validateTarget })} />}
        </Field>
      </div>

      <div className="grid gap-4 adaptive:grid-cols-2">
        <Field label="Start date" required error={errors.startDate?.message}>
          {(fieldProps) => <Input type="date" dir="ltr" max={watch('endDate') || undefined} {...fieldProps} {...register('startDate', { required: 'Choose a start date.' })} />}
        </Field>
        <Field label="End date" required error={errors.endDate?.message}>
          {(fieldProps) => <Input type="date" dir="ltr" min={startDate || undefined} {...fieldProps} {...register('endDate', { required: 'Choose an end date.', validate: (value) => !startDate || value >= startDate || 'End date must not precede start date.' })} />}
        </Field>
      </div>

      <Field label="Status" required error={errors.status?.message}>
        {(fieldProps) => <Select {...fieldProps} {...register('status', { required: 'Choose a status.' })}>{GOAL_STATUSES.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}</Select>}
      </Field>

      <Button type="submit" variant="primary" size="mobile" className="w-full" loading={loading}>
        {isEdit ? 'Save goal' : 'Create goal'}
      </Button>
    </form>
  );
}
