import { useTranslation } from 'react-i18next';
import { formatSignedCurrency } from '../../utils/formatters.js';
export function FinancialCoverage({ count, gross, currency = 'USD' }) {
  const { t } = useTranslation();
  if (!count) return null;
  return <div role="status" className="my-3 min-w-0 self-start whitespace-normal break-words rounded-md border border-warning bg-warning-soft p-3 text-sm text-warning">
    <p>{t('capture.netUnavailable', { count })}</p>
    {gross != null && <p>{t('common.grossPnl')}: <bdi>{formatSignedCurrency(gross, { currency })}</bdi></p>}
  </div>;
}
