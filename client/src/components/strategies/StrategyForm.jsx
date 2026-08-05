import { useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { Button } from '../ui/Button.jsx';
import { Field, Input } from '../ui/FormControls.jsx';

export function StrategyForm({ strategy, onSubmit, loading = false }) {
  const { t } = useTranslation();
  const { register, handleSubmit, formState: { errors } } = useForm({
    defaultValues: { name: strategy?.name ?? '', description: strategy?.description ?? '' },
  });
  return (
    <form noValidate className="space-y-4" onSubmit={handleSubmit((values) => onSubmit({ name: values.name.trim(), description: values.description.trim() || null }))}>
      <Field label={t('strategies.strategyName')} required error={errors.name?.message}>
        {(props) => <Input data-autofocus dir="auto" maxLength={100} {...props} {...register('name', { required: t('strategies.nameRequired'), validate: (value) => value.trim().length > 0 || t('strategies.nameRequired') })} />}
      </Field>
      <Field label={t('common.description')} error={errors.description?.message}>
        {(props) => <textarea dir="auto" rows={5} maxLength={2000} className="input min-h-28 resize-y" {...props} {...register('description', { maxLength: { value: 2000, message: t('validation.maxLength', { field: t('common.description'), max: 2000 }) } })} />}
      </Field>
      <Button type="submit" variant="primary" size="mobile" className="w-full" loading={loading}>
        {strategy ? t('strategies.saveStrategy') : t('strategies.createStrategy')}
      </Button>
    </form>
  );
}
