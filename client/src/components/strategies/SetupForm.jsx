import { useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { Button } from '../ui/Button.jsx';
import { Field, Input, Select } from '../ui/FormControls.jsx';

export function SetupForm({ setup, strategies, selectedStrategyId, onSubmit, loading = false }) {
  const { t } = useTranslation();
  const { register, handleSubmit, formState: { errors } } = useForm({
    defaultValues: {
      strategyId: setup?.strategyId ?? selectedStrategyId ?? '',
      name: setup?.name ?? '',
      description: setup?.description ?? '',
    },
  });
  return (
    <form noValidate className="space-y-4" onSubmit={handleSubmit((values) => onSubmit({
      ...(setup ? {} : { strategyId: values.strategyId }),
      name: values.name.trim(),
      description: values.description.trim() || null,
    }))}>
      <Field label={t('common.strategy')} required error={errors.strategyId?.message}>
        {(props) => (
          <Select dir="auto" disabled={Boolean(setup)} {...props} {...register('strategyId', { required: t('strategies.parentRequired') })}>
            <option value="">{t('strategies.selectStrategy')}</option>
            {strategies.filter((strategy) => strategy.isActive || strategy.id === setup?.strategyId).map((strategy) => <option key={strategy.id} value={strategy.id}>{strategy.name}</option>)}
          </Select>
        )}
      </Field>
      <Field label={t('strategies.setupName')} required error={errors.name?.message}>
        {(props) => <Input data-autofocus dir="auto" maxLength={100} {...props} {...register('name', { required: t('strategies.nameRequired'), validate: (value) => value.trim().length > 0 || t('strategies.nameRequired') })} />}
      </Field>
      <Field label={t('common.description')} error={errors.description?.message}>
        {(props) => <textarea dir="auto" rows={5} maxLength={2000} className="input min-h-28 resize-y" {...props} {...register('description', { maxLength: { value: 2000, message: t('validation.maxLength', { field: t('common.description'), max: 2000 }) } })} />}
      </Field>
      {setup && <p className="text-xs text-muted">{t('strategies.parentImmutable')}</p>}
      <Button type="submit" variant="primary" size="mobile" className="w-full" loading={loading}>
        {setup ? t('strategies.saveSetup') : t('strategies.createSetup')}
      </Button>
    </form>
  );
}
