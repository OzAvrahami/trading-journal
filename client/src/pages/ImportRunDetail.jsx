import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { getImportRun } from '../api/imports.js';
import { formatDatetime, formatNumber } from '../utils/formatters.js';
import { Spinner } from '../components/ui/Spinner.jsx';
import { useUserTimezone } from '../hooks/useUserTimezone.js';

const FILTERS = ['all', 'imported', 'skipped', 'failed'];
const ROW_PAGE_SIZE = 50;

function statusClass(status) {
  if (status === 'completed' || status === 'imported') return 'bg-positive-soft text-positive';
  if (status === 'failed' || status.startsWith('failed_')) return 'bg-negative-soft text-negative';
  return 'bg-warning-soft text-warning';
}

export default function ImportRunDetail() {
  const { runId } = useParams();
  const { t } = useTranslation();
  const timezone = useUserTimezone();
  const [filter, setFilter] = useState('all');
  const [rowOffset, setRowOffset] = useState(0);
  const rowStatus = filter === 'all' ? undefined : filter === 'skipped' ? 'skipped_duplicate' : filter;
  const query = useQuery({ queryKey: ['import-runs', runId, rowStatus, rowOffset], queryFn: () => getImportRun(runId, { rowLimit: ROW_PAGE_SIZE, rowOffset, rowStatus }), retry: false });
  if (query.isLoading) return <div className="flex min-h-48 items-center justify-center"><Spinner className="h-7 w-7" label={t('importHistory.loadingDetail')} /></div>;
  if (query.isError) return <div className="card space-y-3" role="alert"><h2 className="text-lg font-semibold">{t('importHistory.notFound')}</h2><p className="text-muted">{t('importHistory.notFoundDetail')}</p><Link className="btn-secondary inline-flex min-h-11 items-center" to="/import">{t('importHistory.back')}</Link></div>;
  const run = query.data;
  const rows = run.rows;
  return <div className="space-y-6">
    <Link to="/import" className="inline-flex min-h-11 items-center text-sm font-medium text-action">{t('importHistory.back')}</Link>
    <section className="card space-y-4" aria-labelledby="run-summary"><div className="flex flex-wrap items-start justify-between gap-3"><div><h2 id="run-summary" className="text-lg font-semibold" dir="auto">{run.originalFilename}</h2><p className="text-sm text-muted">{t('importHistory.noRawFile')}</p></div><span className={`rounded-full px-3 py-1 text-xs font-medium ${statusClass(run.status)}`}>{t(`importHistory.status.${run.status}`)}</span></div>
      <dl className="grid grid-cols-2 gap-4 md:grid-cols-4">{[
        [t('importHistory.sourceType'), run.sourceType], [t('importHistory.fileSize'), `${formatNumber(run.fileSizeBytes)} B`],
        [t('importHistory.started'), formatDatetime(run.startedAt, { timezone })], [t('importHistory.completedAt'), formatDatetime(run.completedAt, { timezone })],
        [t('importHistory.totalRows'), formatNumber(run.totalRows)], [t('importHistory.importedRows'), formatNumber(run.importedRows)],
        [t('importHistory.skippedRows'), formatNumber(run.skippedRows)], [t('importHistory.failedRows'), formatNumber(run.failedRows)],
      ].map(([label, value]) => <div key={label}><dt className="text-xs text-muted">{label}</dt><dd className="mt-1 font-medium" dir="auto">{value}</dd></div>)}</dl>
      {run.account && <Link to={`/accounts/${run.account.id}`} className="text-sm text-action" dir="auto">{run.account.name || `${run.account.company} - ${run.account.accountNumber}`}</Link>}
      {run.failureCode && <p role="alert" className="rounded-lg bg-negative-soft p-3 text-sm text-negative">{t(`importHistory.errors.${run.failureCode}`, { defaultValue: run.failureDetail || t('importHistory.unknownFailure') })}</p>}
    </section>
    <section className="card space-y-3" aria-labelledby="mapping"><h2 id="mapping" className="text-lg font-semibold">{t('importHistory.mapping')}</h2><dl>{Object.entries(run.mapping || {}).map(([key, value]) => <div key={key} className="flex gap-2 text-sm"><dt className="text-muted" dir="ltr">{key}</dt><dd dir="auto">{String(value)}</dd></div>)}</dl></section>
    <section className="card space-y-4" aria-labelledby="row-results"><h2 id="row-results" className="text-lg font-semibold">{t('importHistory.rowResults')}</h2><div className="flex flex-wrap gap-2" role="group" aria-label={t('importHistory.rowFilters')}>{FILTERS.map(key => <button key={key} type="button" aria-pressed={filter === key} onClick={() => { setFilter(key); setRowOffset(0); }} className={`btn-secondary min-h-11 ${filter === key ? 'ring-2 ring-action' : ''}`}>{t(`importHistory.filters.${key}`)}</button>)}</div>
      <div className="space-y-2">{rows.length === 0 && <p className="text-sm text-muted">{t('importHistory.noMatchingRows')}</p>}{rows.map(row => <article key={row.rowNumber} className="rounded-lg border border-default p-3"><div className="flex flex-wrap items-center justify-between gap-2"><div><span className="font-medium" dir="ltr">#{row.rowNumber}</span>{row.symbol && <span className="ms-3" dir="ltr">{row.symbol}</span>}</div><span className={`rounded-full px-2 py-1 text-xs ${statusClass(row.status)}`}>{t(`importHistory.rowStatus.${row.status}`)}</span></div>{row.sourceIdentifier && <p className="mt-1 truncate text-xs text-muted" dir="ltr">{row.sourceIdentifier}</p>}{row.status === 'imported' && (row.tradeAvailable ? <Link className="mt-2 inline-flex min-h-11 items-center text-sm text-action" to={`/trades/${row.tradeId}`}>{t('importHistory.linkedTrade')}</Link> : <p className="mt-2 text-sm text-muted">{t('importHistory.tradeUnavailable')}</p>)}{row.errorCode && <p className="mt-2 text-sm text-secondary">{t(`importHistory.errors.${row.errorCode}`, { defaultValue: row.errorDetail || t('importHistory.unknownFailure') })}</p>}</article>)}</div>
      {run.rowTotal > ROW_PAGE_SIZE && <nav className="flex items-center justify-between gap-3" aria-label={t('importHistory.rowPagination')}><button type="button" className="btn-secondary min-h-11" disabled={rowOffset === 0} onClick={() => setRowOffset(Math.max(0, rowOffset - ROW_PAGE_SIZE))}>{t('importHistory.previousRows')}</button><span className="text-sm text-muted" dir="ltr">{rowOffset + 1}-{Math.min(rowOffset + ROW_PAGE_SIZE, run.rowTotal)} / {run.rowTotal}</span><button type="button" className="btn-secondary min-h-11" disabled={rowOffset + ROW_PAGE_SIZE >= run.rowTotal} onClick={() => setRowOffset(rowOffset + ROW_PAGE_SIZE)}>{t('importHistory.nextRows')}</button></nav>}
    </section>
  </div>;
}
