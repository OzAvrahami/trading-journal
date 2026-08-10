import { useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { parseImport, commitImport, listImportRuns } from '../api/imports.js';
import { accountsApi } from '../api/accounts.js';
import { useToast } from '../components/ui/Toast.jsx';
import { Spinner } from '../components/ui/Spinner.jsx';
import { formatDatetime, formatNumber } from '../utils/formatters.js';
import { invalidateTradeQueries } from '../components/trades/tradeQueryInvalidation.js';
import { useUserTimezone } from '../hooks/useUserTimezone.js';

const BROKERS = [
  { key: 'topstepx', label: 'TopstepX' },
  { key: 'tradovate', label: 'Tradovate' },
];
const STEPS = ['select', 'preview', 'done'];

function StepIndicator({ current }) {
  const { t } = useTranslation();
  const labels = [t('importPage.selectUpload'), t('importPage.preview'), t('importPage.done')];
  return (
    <div className="mb-8 flex items-center gap-2" aria-label={t('importPage.progress')}>
      {labels.map((label, index) => {
        const stepKey = STEPS[index];
        const isActive = current === stepKey;
        const isDone = STEPS.indexOf(current) > index;
        return (
          <div key={stepKey} className="flex items-center gap-2">
            <div aria-current={isActive ? 'step' : undefined} className={`flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold ${isDone ? 'bg-positive text-white' : isActive ? 'bg-action text-white' : 'bg-surface-sunken text-muted'}`}>
              {isDone ? <span aria-label={t('common.complete')}>✓</span> : index + 1}
            </div>
            <span className={`text-sm ${isActive ? 'font-medium text-primary' : 'text-muted'}`}>{label}</span>
            {index < labels.length - 1 && <div className={`h-px w-10 ${isDone ? 'bg-positive' : 'bg-border'}`} aria-hidden="true" />}
          </div>
        );
      })}
    </div>
  );
}

function StatBadge({ label, value, tone = 'neutral' }) {
  const tones = { neutral: 'bg-surface-sunken text-primary', action: 'bg-action-soft text-action', positive: 'bg-positive-soft text-positive', warning: 'bg-warning-soft text-warning' };
  return <div className={`rounded-lg px-4 py-3 text-center ${tones[tone]}`}><div className="text-2xl font-bold" dir="ltr">{formatNumber(value)}</div><div className="mt-0.5 text-xs opacity-80">{label}</div></div>;
}

function PreviewTable({ rows }) {
  const { t } = useTranslation();
  const timezone = useUserTimezone();
  if (!rows.length) return <p className="text-sm text-muted">{t('importPage.noRows')}</p>;
  const columns = [
    ['symbol', t('common.symbol')], ['direction', t('common.direction')], ['entry_datetime', t('common.entry')],
    ['exit_datetime', t('common.exit')], ['entry_price', t('common.entryPrice')], ['exit_price', t('common.exitPrice')],
    ['quantity', t('common.quantity')], ['pnl_net', t('common.netPnl')], ['fees', t('common.fees')],
  ];
  function formatCell(key, value) {
    if (value == null) return '—';
    if (key === 'entry_datetime' || key === 'exit_datetime') return formatDatetime(value, { timezone });
    if (['entry_price', 'exit_price', 'pnl_net', 'fees'].includes(key)) return typeof value === 'number' ? formatNumber(value, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : value;
    if (key === 'direction') return t(`status.${value}`, { defaultValue: value });
    return String(value);
  }
  return (
    <div className="overflow-x-auto rounded-lg border border-default">
      <table className="min-w-full text-sm">
        <caption className="sr-only">{t('importPage.previewTable')}</caption>
        <thead className="bg-surface-sunken"><tr>{columns.map(([key, label]) => <th key={key} className="px-3 py-2 text-start text-xs font-medium uppercase tracking-wider text-muted">{label}</th>)}</tr></thead>
        <tbody className="divide-y divide-default">
          {rows.map((row, index) => <tr key={row.dedup_key ?? index} className="transition hover:bg-surface-raised">{columns.map(([key]) => <td key={key} className="whitespace-nowrap px-3 py-2 text-secondary" dir={['symbol', 'entry_datetime', 'exit_datetime', 'entry_price', 'exit_price', 'quantity', 'pnl_net', 'fees'].includes(key) ? 'ltr' : undefined}>{formatCell(key, row[key])}</td>)}</tr>)}
        </tbody>
      </table>
    </div>
  );
}

function ImportHistory() {
  const { t } = useTranslation();
  const timezone = useUserTimezone();
  const query = useQuery({ queryKey: ['import-runs'], queryFn: () => listImportRuns({ limit: 20 }) });
  return <section className="mt-8 space-y-4" aria-labelledby="import-history-heading">
    <div><h2 id="import-history-heading" className="text-lg font-semibold">{t('importHistory.title')}</h2><p className="text-sm text-muted">{t('importHistory.privacy')}</p></div>
    {query.isLoading && <div className="card flex min-h-28 items-center justify-center" role="status"><Spinner className="h-5 w-5" label={t('importHistory.loading')} /></div>}
    {query.isError && <div className="card text-sm text-negative" role="alert">{t('importHistory.loadFailed')}</div>}
    {query.data?.runs?.length === 0 && <div className="card text-sm text-muted">{t('importHistory.empty')}</div>}
    <div className="grid gap-3">{query.data?.runs?.map(run => <article key={run.id} className="card flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"><div className="min-w-0"><h3 className="truncate font-medium" dir="auto">{run.originalFilename}</h3><p className="text-xs text-muted"><span dir="ltr">{formatDatetime(run.completedAt || run.startedAt, { timezone })}</span> · {t(`importHistory.status.${run.status}`)}</p>{run.account && <Link className="text-xs text-action" to={`/accounts/${run.account.id}`} dir="auto">{run.account.name || run.account.company}</Link>}</div><div className="grid grid-cols-3 gap-3 text-center text-xs"><div><strong dir="ltr">{run.importedRows}</strong><span className="block text-muted">{t('importHistory.imported')}</span></div><div><strong dir="ltr">{run.skippedRows}</strong><span className="block text-muted">{t('importHistory.skipped')}</span></div><div><strong dir="ltr">{run.failedRows}</strong><span className="block text-muted">{t('importHistory.failed')}</span></div></div><Link className="btn-secondary inline-flex min-h-11 items-center justify-center" to={`/import/history/${run.id}`}>{t('importHistory.viewDetails')}</Link></article>)}</div>
  </section>;
}

export default function Import() {
  const { t } = useTranslation();
  const toast = useToast();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const fileRef = useRef(null);
  const [step, setStep] = useState('select');
  const [broker, setBroker] = useState('');
  const [file, setFile] = useState(null);
  const [parsing, setParsing] = useState(false);
  const [sessionId, setSessionId] = useState(null);
  const [preview, setPreview] = useState([]);
  const [parseStats, setParseStats] = useState(null);
  const [accountId, setAccountId] = useState('');
  const [committing, setCommitting] = useState(false);
  const [commitResult, setCommitResult] = useState(null);
  const [duplicateRun, setDuplicateRun] = useState(null);
  const { data: accounts = [] } = useQuery({ queryKey: ['accounts'], queryFn: accountsApi.list });
  const activeAccounts = accounts.filter((account) => account.status === 'active');

  function accountLabel(account) {
    const base = `${account.company} — ${account.accountNumber}`;
    return account.accountName ? `${base} (${account.accountName})` : base;
  }
  function handleFileChange(event) { setFile(event.target.files?.[0] ?? null); }
  async function handleParse() {
    if (!broker) return toast.error(t('importPage.selectBrokerError'));
    if (!file) return toast.error(t('importPage.selectFileError'));
    setParsing(true);
    try {
      const result = await parseImport(broker, file);
      setSessionId(result.sessionId); setPreview(result.preview); setParseStats(result.stats); setDuplicateRun(result.duplicateRun || null); setStep('preview');
    } catch (error) { toast.error(error?.response?.data?.error?.message ?? t('importPage.parseFailed')); }
    finally { setParsing(false); }
  }
  async function handleCommit() {
    if (!accountId) return toast.error(t('importPage.selectAccountError'));
    setCommitting(true);
    try {
      const result = await commitImport(sessionId, accountId);
      await Promise.all([
        invalidateTradeQueries(queryClient),
        queryClient.invalidateQueries({ queryKey: ['import-runs'] }),
      ]);
      setCommitResult(result);
      setStep('done');
    }
    catch (error) {
      const apiError = error?.response?.data?.error;
      if (apiError?.code === 'IMPORT_DUPLICATE_FILE') setDuplicateRun({ id: apiError.details?.existingRunId, ...apiError.details });
      queryClient.invalidateQueries({ queryKey: ['import-runs'] });
      toast.error(t(`errors.${apiError?.code}`, { defaultValue: apiError?.message ?? t('importPage.failed') }));
    }
    finally { setCommitting(false); }
  }
  function handleReset() {
    setBroker(''); setFile(null); setSessionId(null); setPreview([]); setParseStats(null); setAccountId(''); setCommitResult(null); setDuplicateRun(null); setStep('select');
    if (fileRef.current) fileRef.current.value = '';
  }

  return (
    <div className="mx-auto max-w-4xl">
      <StepIndicator current={step} />
      {step === 'select' && <div className="card space-y-5">
        <fieldset><legend className="mb-2 block text-sm font-medium text-secondary">{t('importPage.broker')}</legend><div className="grid grid-cols-2 gap-3 sm:grid-cols-3">{BROKERS.map((item) => <button key={item.key} type="button" aria-pressed={broker === item.key} onClick={() => setBroker(item.key)} className={`min-h-11 rounded-lg border px-4 py-3 text-sm font-medium transition ${broker === item.key ? 'border-action bg-action-soft text-action' : 'border-default bg-surface-sunken text-secondary hover:border-strong'}`}>{item.label}</button>)}</div></fieldset>
        <label className="block"><span className="mb-2 block text-sm font-medium text-secondary">{t('importPage.csvFile')}</span><input ref={fileRef} type="file" accept=".csv,text/csv" onChange={handleFileChange} className="input block w-full cursor-pointer text-sm" /></label>
        {file && <p className="text-xs text-muted" dir="ltr">{file.name} ({formatNumber(file.size / 1024, { maximumFractionDigits: 1 })} KB)</p>}
        <button type="button" onClick={handleParse} disabled={parsing || !broker || !file} className="btn-primary flex min-h-11 items-center gap-2 disabled:cursor-not-allowed disabled:opacity-50">{parsing ? <><Spinner className="h-4 w-4" label={t('importHistory.hashing')} /> {t('importHistory.hashing')}</> : t('importPage.upload')}</button>
      </div>}
      {step === 'preview' && parseStats && <div className="space-y-6">
        {duplicateRun && <div className="rounded-lg border border-warning bg-warning-soft p-4" role="alert"><h2 className="font-semibold text-warning">{t('importHistory.duplicateTitle')}</h2><p className="mt-1 text-sm text-secondary">{t('importHistory.duplicateDetail')}</p>{duplicateRun.id && <Link className="mt-3 inline-flex min-h-11 items-center font-medium text-action" to={`/import/history/${duplicateRun.id}`}>{t('importHistory.viewPrevious')}</Link>}</div>}
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4"><StatBadge label={t('importPage.sourceRows')} value={parseStats.sourceRowCount ?? parseStats.total} /><StatBadge label={t('importPage.logicalTrades')} value={parseStats.logicalTradeCount ?? parseStats.uniqueInFile} tone="action" /><StatBadge label={t('importPage.tradesToImport')} value={parseStats.tradesToImport ?? parseStats.uniqueInFile} tone="positive" /><StatBadge label={t('importPage.inFileDuplicates')} value={parseStats.inFileDuplicates} tone={parseStats.inFileDuplicates > 0 ? 'warning' : 'neutral'} /></div>
        <div className="card"><h2 className="mb-3 text-sm font-medium text-muted">{t('importPage.previewCount', { shown: preview.length, total: parseStats.tradesToImport ?? parseStats.uniqueInFile })}</h2><PreviewTable rows={preview} /></div>
        <div className="card space-y-2"><label className="block text-sm font-medium text-secondary" htmlFor="import-account">{t('importPage.assignAccount')}</label><p className="text-xs text-muted">{t('importPage.assignAccountHelp')}</p><select id="import-account" className="input w-full sm:w-80" value={accountId} onChange={(event) => setAccountId(event.target.value)}><option value="">{t('importPage.chooseAccount')}</option>{activeAccounts.map((account) => <option key={account.id} value={account.id}>{accountLabel(account)}</option>)}</select></div>
        <div className="flex items-center gap-3"><button type="button" onClick={handleCommit} disabled={committing || Boolean(duplicateRun) || (parseStats.tradesToImport ?? parseStats.uniqueInFile) === 0 || !accountId} className="btn-primary flex min-h-11 items-center gap-2 disabled:cursor-not-allowed disabled:opacity-50">{committing ? <><Spinner className="h-4 w-4" label={t('importPage.importing')} /> {t('importPage.importing')}</> : t('importPage.importCount', { count: parseStats.tradesToImport ?? parseStats.uniqueInFile })}</button><button type="button" onClick={handleReset} className="btn-secondary min-h-11">{t('importPage.startOver')}</button></div>
      </div>}
      {step === 'done' && commitResult && <div className="card space-y-6 text-center"><div className="text-5xl" aria-hidden="true">{commitResult.status === 'failed' ? '!' : '✓'}</div><h2 className="text-xl font-bold text-primary">{commitResult.status === 'failed' ? t('importPage.failed') : t('importPage.complete')}</h2><div className="mx-auto grid max-w-md grid-cols-3 gap-3"><StatBadge label={t('importPage.importedCount')} value={commitResult.inserted ?? commitResult.importedRows} tone="positive" /><StatBadge label={t('importHistory.skippedRows')} value={commitResult.skippedRows ?? commitResult.dbDuplicates} tone={(commitResult.skippedRows ?? commitResult.dbDuplicates) > 0 ? 'warning' : 'neutral'} /><StatBadge label={t('importHistory.failedRows')} value={commitResult.failedRows ?? 0} tone={(commitResult.failedRows ?? 0) > 0 ? 'warning' : 'neutral'} /></div><div className="flex flex-wrap justify-center gap-3">{commitResult.runId && <Link to={`/import/history/${commitResult.runId}`} className="btn-primary min-h-11">{t('importHistory.viewDetails')}</Link>}<button type="button" onClick={() => navigate('/trades')} className="btn-secondary min-h-11">{t('importPage.viewTrades')}</button><button type="button" onClick={handleReset} className="btn-secondary min-h-11">{t('importPage.importMore')}</button></div></div>}
      <ImportHistory />
    </div>
  );
}
