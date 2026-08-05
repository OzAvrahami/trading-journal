import { useForm } from 'react-hook-form';
import { Button } from '../ui/Button.jsx';
import { Checkbox, Field, Input, Select } from '../ui/FormControls.jsx';
import { RULE_SCOPES } from './ruleTypes.js';
import { useTranslation } from 'react-i18next';

export function RuleForm({ rule, onSubmit, loading = false }) {
  const { t } = useTranslation();
  const isEdit = Boolean(rule);
  const { register, handleSubmit, formState: { errors } } = useForm({
    defaultValues: {
      name: rule?.name ?? '',
      description: rule?.description ?? '',
      scope: rule?.scope ?? 'trade',
      isActive: rule?.isActive ?? true,
    },
  });

  function submit(values) {
    onSubmit({
      name: values.name.trim(),
      description: values.description.trim() || null,
      scope: values.scope,
      isActive: Boolean(values.isActive),
    });
  }

  return (
    <form onSubmit={handleSubmit(submit)} className="space-y-4" noValidate>
      <Field label={t('rules.ruleName')} required error={errors.name?.message}>
        {(fieldProps) => (
          <Input
            data-autofocus
            maxLength={120}
            {...fieldProps}
            {...register('name', {
              required: t('rules.nameRequired'),
              validate: (value) => value.trim().length > 0 || t('rules.nameRequired'),
              maxLength: { value: 120, message: t('validation.maxLength', { field: t('rules.ruleName'), max: 120 }) },
            })}
          />
        )}
      </Field>

      <Field label={t('common.description')} helpText={t('routes.rules.description')} error={errors.description?.message}>
        {(fieldProps) => (
          <textarea
            rows={4}
            maxLength={1000}
            className="input min-h-24 resize-y"
            {...fieldProps}
            {...register('description', { maxLength: { value: 1000, message: t('validation.maxLength', { field: t('common.description'), max: 1000 }) } })}
          />
        )}
      </Field>

      <Field label={t('common.scope')} required error={errors.scope?.message}>
        {(fieldProps) => (
          <Select {...fieldProps} {...register('scope', { required: t('validation.required', { field: t('common.scope') }) })}>
            {RULE_SCOPES.map((scope) => <option key={scope.value} value={scope.value}>{scope.label}</option>)}
          </Select>
        )}
      </Field>

      <Checkbox label={t('status.active')} {...register('isActive')} />

      <Button type="submit" variant="primary" size="mobile" className="w-full" loading={loading}>
        {isEdit ? t('rules.saveRule') : t('rules.createRule')}
      </Button>
    </form>
  );
}
