import { Spinner } from './Spinner.jsx';
import { useTranslation } from 'react-i18next';

const variants = {
  primary: 'border-action bg-action text-white hover:bg-action-hover',
  secondary: 'border-strong bg-surface-raised text-primary hover:bg-surface-sunken',
  tertiary: 'border-transparent bg-transparent text-secondary hover:bg-surface-raised hover:text-primary',
  destructive: 'border-negative bg-negative-soft text-negative hover:border-negative',
};

const sizes = {
  sm: 'min-h-8 px-3 py-1 text-xs',
  default: 'min-h-9 px-4 py-2 text-sm',
  mobile: 'min-h-11 px-4 py-2 text-sm',
};

export function Button({
  variant = 'secondary',
  size = 'default',
  loading = false,
  leadingIcon,
  trailingIcon,
  className = '',
  disabled,
  children,
  ...props
}) {
  const { t } = useTranslation();
  return (
    <button
      className={`inline-flex items-center justify-center gap-2 rounded-md border font-medium transition-colors disabled:cursor-not-allowed disabled:border-default disabled:bg-surface-sunken disabled:text-muted ${variants[variant]} ${sizes[size]} ${className}`}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      {...props}
    >
      {loading ? <Spinner className="h-4 w-4" label={t('common.working')} /> : leadingIcon}
      {children}
      {!loading && trailingIcon}
    </button>
  );
}
