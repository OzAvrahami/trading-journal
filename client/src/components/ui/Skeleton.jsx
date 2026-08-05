import { useTranslation } from 'react-i18next';

export function Skeleton({ className = '', label }) {
  const { t } = useTranslation();
  return (
    <span
      role="status"
      aria-label={label ?? t('common.loading')}
      className={`skeleton-shim block rounded-md bg-surface-sunken ${className}`}
    />
  );
}

export function SkeletonLines({ lines = 3, className = '' }) {
  const { t } = useTranslation();
  return (
    <div className={`space-y-2 ${className}`} role="status" aria-label={t('common.loading')}>
      {Array.from({ length: lines }, (_, index) => (
        <span key={index} className={`skeleton-shim block h-3 rounded-sm bg-surface-sunken ${index === lines - 1 ? 'w-2/3' : 'w-full'}`} />
      ))}
    </div>
  );
}
