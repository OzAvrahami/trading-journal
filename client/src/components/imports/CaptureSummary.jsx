import { useTranslation } from 'react-i18next';
import { formatNumber } from '../../utils/formatters.js';

export default function CaptureSummary({ source, targetLabel, persisted = false }) {
  const { t } = useTranslation();
  const financial = source.financial;
  const money = value => formatNumber(value, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const fields = [
    [t('capture.externalAccount'), `${source.provider} / ${source.environment} / ${source.account.id} / ${source.account.name}`],
    [t('capture.target'), targetLabel],
    [t('capture.period'), `${source.requestedRange.from} → ${source.requestedRange.to}`],
    [t('capture.captured'), source.capturedAt],
    [t('capture.offset'), `${source.verifiedOffsetMinutes >= 0 ? '+' : ''}${source.verifiedOffsetMinutes} min`],
    [t('capture.requestedZone'), source.requestedTimezone],
  ];
  return <section className="card space-y-4" aria-labelledby="capture-heading">
    <div><h2 id="capture-heading" className="text-lg font-semibold">{t(persisted ? 'capture.persistedTitle' : 'capture.title')}</h2><p className="mt-1 text-sm text-warning" role="status">{t(persisted ? 'capture.persisted' : 'capture.confirmHelp')}</p></div>
    <dl className="grid gap-x-6 gap-y-3 sm:grid-cols-2">{fields.map(([label, value]) => <div key={label} className="min-w-0"><dt className="text-xs text-muted">{label}</dt><dd className="break-words text-sm text-primary" dir="auto"><bdi>{value}</bdi></dd></div>)}</dl>
    <p className="text-xs text-muted">{t('capture.periodHelp')}</p>
    <p className="text-xs text-muted">{t('capture.timeEvidence', { count: source.timestampEvidence.sharedPairs, total: source.timestampEvidence.sourceRows })}</p>
    {source.timestampEvidence.sharedPairs < source.timestampEvidence.sourceRows && <p className="text-sm text-warning" role="alert">{t('capture.partialComparison')}</p>}
    <div className="border-t border-default pt-4"><h3 className="mb-3 font-medium">{t('capture.financialTitle')}</h3>
      {financial ? <>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">{[
          [t('common.grossPnl'), financial.gross], [t('capture.sourcedFees'), financial.tradingFees], [t('capture.aggregateNet'), financial.net],
        ].map(([label, value]) => <div key={label} className="rounded-lg bg-surface-sunken p-3"><div className="text-xs text-muted">{label}</div><div className="mt-1 text-lg font-semibold" dir="ltr">{money(value)} {financial.currency}</div></div>)}</div>
        <p className="mt-3 text-sm text-secondary">{t('capture.coverage', { rows: financial.sourceRows, fills: financial.uniqueFillCount })}</p>
        <p className="mt-2 text-sm text-warning">{t('capture.allocation')}</p>
        <p className="mt-2 text-xs text-muted">{t('capture.financialTimes')} <bdi>{financial.summaryCapturedAt}</bdi> / <bdi>{financial.cashCapturedAt}</bdi></p>
        {Object.keys(financial.otherCashAdjustments).length > 0 && <div className="mt-3 text-sm"><p>{t('capture.adjustments')}</p>{Object.entries(financial.otherCashAdjustments).map(([kind, value]) => <p key={kind}><bdi>{kind}</bdi>: <bdi>{money(value)} {financial.currency}</bdi></p>)}</div>}
      </> : <p className="text-sm text-warning" role="alert">{t('capture.financialMissing')}</p>}
    </div>
    <details className="text-xs text-muted"><summary className="cursor-pointer py-2">{t('capture.provenance')}</summary><p className="break-all" dir="ltr">CSV SHA-256: {source.performanceSha256}</p><p className="mt-1 break-all" dir="ltr">Offset comparison SHA-256: {source.timestampEvidence.comparisonSha256}</p>{financial && <><p className="mt-1 break-all" dir="ltr">Performance SHA-256: {financial.summarySha256}</p><p className="mt-1 break-all" dir="ltr">Cash History SHA-256: {financial.cashSha256}</p></>}<p className="mt-2">{t('capture.integrityLimit')}</p></details>
  </section>;
}
