import { CheckCircle, WarningCircle } from '@phosphor-icons/react';
import { Button } from './Button.jsx';
import { useTranslation } from 'react-i18next';

export function EmptyState({ title, detail, filtered = false, onClear, action }) {
  const { t } = useTranslation();
  return (
    <section className="rounded-lg border border-dashed border-strong bg-surface p-6 text-center">
      <h2 className="text-sm font-semibold text-primary">{title || (filtered ? t('states.noMatching') : t('states.nothingYet'))}</h2>
      {detail && <p className="mx-auto mt-2 max-w-lg text-sm text-secondary">{detail}</p>}
      {(action || (filtered && onClear)) && (
        <div className="mt-4 flex justify-center gap-2">
          {filtered && onClear && <Button onClick={onClear}>{t('common.clearFilters')}</Button>}
          {action}
        </div>
      )}
    </section>
  );
}

export function ErrorState({ title, detail, available, onRetry }) {
  const { t } = useTranslation();
  return (
    <section className="rounded-lg border border-negative bg-negative-soft p-4" role="alert">
      <div className="flex items-start gap-3">
        <WarningCircle size={18} className="mt-0.5 shrink-0 text-negative" aria-hidden="true" />
        <div>
          <h2 className="text-sm font-semibold text-primary">{title || t('states.somethingWrong')}</h2>
          {detail && <p className="mt-1 text-sm text-secondary">{detail}</p>}
          {available && <p className="mt-1 text-xs text-muted">{t('states.stillAvailable', { available })}</p>}
          {onRetry && <Button variant="secondary" size="sm" className="mt-3" onClick={onRetry}>{t('common.retry')}</Button>}
        </div>
      </div>
    </section>
  );
}

export function SuccessBanner({ title, detail, action }) {
  return (
    <section className="rounded-lg border border-positive bg-positive-soft p-4" role="status">
      <div className="flex items-start gap-3">
        <CheckCircle size={18} className="mt-0.5 shrink-0 text-positive" aria-hidden="true" />
        <div className="min-w-0">
          <h2 className="text-sm font-semibold text-primary">{title}</h2>
          {detail && <p className="mt-1 text-sm text-secondary">{detail}</p>}
          {action && <div className="mt-3">{action}</div>}
        </div>
      </div>
    </section>
  );
}
