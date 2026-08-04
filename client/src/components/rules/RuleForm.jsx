import { useForm } from 'react-hook-form';
import { Button } from '../ui/Button.jsx';
import { Checkbox, Field, Input, Select } from '../ui/FormControls.jsx';
import { RULE_SCOPES } from './ruleTypes.js';

export function RuleForm({ rule, onSubmit, loading = false }) {
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
      <Field label="Rule name" required error={errors.name?.message}>
        {(fieldProps) => (
          <Input
            data-autofocus
            maxLength={120}
            {...fieldProps}
            {...register('name', {
              required: 'Enter a rule name.',
              validate: (value) => value.trim().length > 0 || 'Enter a rule name.',
              maxLength: { value: 120, message: 'Use 120 characters or fewer.' },
            })}
          />
        )}
      </Field>

      <Field label="Description" helpText="Optional context that explains what following this rule means." error={errors.description?.message}>
        {(fieldProps) => (
          <textarea
            rows={4}
            maxLength={1000}
            className="input min-h-24 resize-y"
            {...fieldProps}
            {...register('description', { maxLength: { value: 1000, message: 'Use 1,000 characters or fewer.' } })}
          />
        )}
      </Field>

      <Field label="Scope" required error={errors.scope?.message}>
        {(fieldProps) => (
          <Select {...fieldProps} {...register('scope', { required: 'Choose a rule scope.' })}>
            {RULE_SCOPES.map((scope) => <option key={scope.value} value={scope.value}>{scope.label}</option>)}
          </Select>
        )}
      </Field>

      <Checkbox label="Rule is active" {...register('isActive')} />

      <Button type="submit" variant="primary" size="mobile" className="w-full" loading={loading}>
        {isEdit ? 'Save rule' : 'Create rule'}
      </Button>
    </form>
  );
}
