import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { ArrowSquareOut, PencilSimple, Trash } from '@phosphor-icons/react';
import { tradesApi } from '../api/trades.js';
import { accountsApi } from '../api/accounts.js';
import { TradeForm } from '../components/trades/TradeForm.jsx';
import { DirectionBadge, StatusBadge } from '../components/trades/TradeTable.jsx';
import { Badge } from '../components/ui/Badge.jsx';
import { Button } from '../components/ui/Button.jsx';
import { Card } from '../components/ui/Card.jsx';
import { ErrorState } from '../components/ui/States.jsx';
import { Skeleton } from '../components/ui/Skeleton.jsx';
import { ValueIndicator } from '../components/ui/ValueIndicator.jsx';
import { useToast } from '../components/ui/Toast.jsx';
import { formatCurrency, formatDatetime, formatDuration, formatR, formatSignedCurrency } from '../utils/formatters.js';
import { RouteHeaderControls } from '../components/layout/HeaderControls.jsx';
import { useTranslation } from 'react-i18next';

function accountLabel(accountId, accounts) {
  const account = accounts.find((item) => item.id === accountId);
  if (!account) return '—';
  return account.accountName || `${account.company} — ${account.accountNumber}`;
}

function DataPoint({ label, value, numeric = false, children }) {
  const available = value != null && value !== '';
  return (
    <div>
      <dt className="text-xs text-muted">{label}</dt>
      <dd className={`mt-1 text-sm font-medium text-primary ${numeric ? 'font-mono tabular-nums' : ''}`} dir={numeric ? 'ltr' : undefined}>
        {children ?? (available ? value : '—')}
      </dd>
    </div>
  );
}

function FinancialMetric({ label, value, formatter = formatSignedCurrency, prominent = false, semantic = false }) {
  return (
    <div className={`rounded-md border border-default bg-surface-raised p-3 ${prominent ? 'sm:col-span-2' : ''}`}>
      <dt className="text-xs text-muted">{label}</dt>
      <dd className={`mt-1 ${prominent ? 'text-xl' : 'text-base'} font-semibold`}>
        {value == null
          ? <span className="font-mono text-muted" dir="ltr">—</span>
          : semantic
            ? <ValueIndicator value={value}>{formatter(value)}</ValueIndicator>
            : <span className="font-mono text-primary" dir="ltr">{formatter(value)}</span>}
      </dd>
    </div>
  );
}

function formatEmotionValue(value) {
  if (value == null || value === '') return '—';
  if (Array.isArray(value)) return value.map(formatEmotionValue).join(', ');
  if (typeof value === 'object') return JSON.stringify(value);
  return String(value);
}

function Emotions({ emotions }) {
  if (emotions == null || emotions === '' || (Array.isArray(emotions) && emotions.length === 0)) return null;
  if (Array.isArray(emotions)) {
    return (
      <ul className="flex flex-wrap gap-2">
        {emotions.map((emotion, index) => <li key={`${formatEmotionValue(emotion)}-${index}`}><Badge>{formatEmotionValue(emotion)}</Badge></li>)}
      </ul>
    );
  }
  if (typeof emotions === 'object') {
    const entries = Object.entries(emotions);
    if (entries.length === 0) return null;
    return (
      <dl className="grid gap-3 sm:grid-cols-2">
        {entries.map(([key, value]) => <DataPoint key={key} label={key} value={formatEmotionValue(value)} />)}
      </dl>
    );
  }
  return <p className="text-sm text-secondary">{formatEmotionValue(emotions)}</p>;
}

function hasEmotionData(emotions) {
  if (emotions == null || emotions === '') return false;
  if (Array.isArray(emotions)) return emotions.length > 0;
  if (typeof emotions === 'object') return Object.keys(emotions).length > 0;
  return true;
}

function safeScreenshotLinks(links) {
  if (!Array.isArray(links)) return [];
  return links.flatMap((link) => {
    if (typeof link !== 'string' || !link.trim()) return [];
    try {
      const url = new URL(link);
      if (!['http:', 'https:'].includes(url.protocol)) return [];
      return [{ href: url.href, host: url.hostname }];
    } catch {
      return [];
    }
  });
}

function DetailSkeleton() {
  const { t } = useTranslation();
  return (
    <div className="mx-auto max-w-6xl space-y-4" aria-label={t('trades.loadingDetails')}>
      <Skeleton className="h-10 w-32" />
      <Skeleton className="h-36" />
      <div className="grid gap-4 adaptive:grid-cols-2"><Skeleton className="h-64" /><Skeleton className="h-64" /></div>
    </div>
  );
}

export default function TradeDetail() {
  const { t } = useTranslation();
  const { id } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const toast = useToast();
  const [editing, setEditing] = useState(false);

  const tradeQuery = useQuery({
    queryKey: ['trade', id],
    queryFn: () => tradesApi.get(id),
  });

  const { data: accounts = [] } = useQuery({
    queryKey: ['accounts'],
    queryFn: accountsApi.list,
  });

  const updateMutation = useMutation({
    mutationFn: (data) => tradesApi.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['trade', id] });
      queryClient.invalidateQueries({ queryKey: ['trades'] });
      queryClient.invalidateQueries({ queryKey: ['analytics'] });
      setEditing(false);
      toast.success(t('trades.tradeUpdated'));
    },
    onError: (error) => toast.error(error.response?.data?.error?.code ? t(`errors.${error.response.data.error.code}`, { defaultValue: error.response.data.error.message }) : t('trades.updateFailed')),
  });

  const deleteMutation = useMutation({
    mutationFn: () => tradesApi.remove(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['trades'] });
      queryClient.invalidateQueries({ queryKey: ['analytics'] });
      navigate('/trades');
      toast.success(t('trades.tradeDeleted'));
    },
    onError: () => toast.error(t('trades.deleteFailed')),
  });

  if (tradeQuery.isLoading) return <DetailSkeleton />;
  if (tradeQuery.isError) {
    return <ErrorState title={t('trades.loadError')} detail={t('trades.unavailableRecord')} onRetry={tradeQuery.refetch} />;
  }

  const trade = tradeQuery.data;
  if (!trade) return <ErrorState title={t('trades.notFound')} detail={t('trades.notFoundDetail')} />;

  function handleDelete() {
    if (!window.confirm(t('trades.deleteConfirm'))) return;
    deleteMutation.mutate();
  }

  const toLocalInput = (iso) => iso ? new Date(iso).toISOString().slice(0, 16) : '';
  const editDefaults = {
    ...trade,
    entryDatetime: toLocalInput(trade.entryDatetime),
    exitDatetime: toLocalInput(trade.exitDatetime),
  };
  const screenshots = safeScreenshotLinks(trade.screenshotLinks);

  return (
    <div className="mx-auto max-w-6xl space-y-4">
      <RouteHeaderControls slot="tradeActions">
        <div className="flex flex-wrap items-center gap-2">
          <Button type="button" variant="tertiary" size="mobile" onClick={() => navigate(-1)}>{t('trades.back')}</Button>
          <Button
            type="button"
            size="mobile"
            leadingIcon={<PencilSimple size={17} aria-hidden="true" />}
            onClick={() => setEditing((current) => !current)}
          >
            {editing ? t('trades.cancelEdit') : t('trades.editTrade')}
          </Button>
          <Button
            type="button"
            variant="destructive"
            size="mobile"
            loading={deleteMutation.isPending}
            leadingIcon={<Trash size={17} aria-hidden="true" />}
            onClick={handleDelete}
          >
            {t('common.delete')}
          </Button>
        </div>
      </RouteHeaderControls>

      <Card className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="font-mono text-2xl font-semibold text-primary" dir="ltr">{trade.symbol || '—'}</h2>
            <DirectionBadge direction={trade.direction} />
            <StatusBadge status={trade.status} />
          </div>
          <p className="mt-2 text-sm capitalize text-secondary">{[trade.market, trade.timeframe].filter(Boolean).join(' · ') || 'Trade details'}</p>
          <p className="mt-1 text-xs text-muted">{accountLabel(trade.accountId, accounts)}</p>
        </div>
        <div className="sm:text-end">
          <p className="text-xs text-muted">{t('common.netPnl')}</p>
          <div className="mt-1 text-2xl font-semibold">
            {trade.pnlNet == null ? <span className="font-mono text-muted" dir="ltr">—</span> : <ValueIndicator value={trade.pnlNet}>{formatSignedCurrency(trade.pnlNet)}</ValueIndicator>}
          </div>
        </div>
      </Card>

      {editing && (
        <Card aria-labelledby="edit-trade-heading">
          <h2 id="edit-trade-heading" className="mb-4 text-sm font-semibold text-primary">{t('trades.editTrade')}</h2>
          <TradeForm defaultValues={editDefaults} onSubmit={updateMutation.mutate} loading={updateMutation.isPending} />
        </Card>
      )}

      <Card aria-labelledby="financial-summary-heading">
        <h2 id="financial-summary-heading" className="mb-3 text-sm font-semibold text-primary">{t('trades.financialResult')}</h2>
        <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <FinancialMetric label={t('common.netPnl')} value={trade.pnlNet} prominent semantic />
          <FinancialMetric label={t('common.grossPnl')} value={trade.pnlGross} semantic />
          <FinancialMetric label={t('common.fees')} value={trade.fees} formatter={formatCurrency} />
          <FinancialMetric label={t('common.rMultiple')} value={trade.rMultiple} formatter={formatR} semantic />
          <FinancialMetric label={t('common.duration')} value={trade.durationMinutes} formatter={formatDuration} />
          <FinancialMetric label={t('common.quantity')} value={trade.quantity} formatter={(value) => String(value)} />
        </dl>
      </Card>

      <div className="grid gap-4 adaptive:grid-cols-2">
        <Card aria-labelledby="entry-exit-heading">
          <h2 id="entry-exit-heading" className="mb-4 text-sm font-semibold text-primary">{t('trades.entryExit')}</h2>
          <dl className="grid grid-cols-2 gap-x-5 gap-y-4">
            <DataPoint label={t('trades.entryTime')} numeric value={formatDatetime(trade.entryDatetime)} />
            <DataPoint label={t('trades.exitTime')} numeric value={formatDatetime(trade.exitDatetime)} />
            <DataPoint label={t('common.entryPrice')} numeric value={formatCurrency(trade.entryPrice)} />
            <DataPoint label={t('common.exitPrice')} numeric value={formatCurrency(trade.exitPrice)} />
            <DataPoint label={t('common.quantity')} numeric value={trade.quantity} />
            <DataPoint label={t('common.direction')} value={trade.direction}><DirectionBadge direction={trade.direction} /></DataPoint>
            <DataPoint label={t('common.status')} value={trade.status}><StatusBadge status={trade.status} /></DataPoint>
          </dl>
        </Card>

        <Card aria-labelledby="plan-heading">
          <h2 id="plan-heading" className="mb-4 text-sm font-semibold text-primary">{t('trades.planOutcome')}</h2>
          <dl className="grid grid-cols-2 gap-x-5 gap-y-4">
            <DataPoint label={t('common.riskAmount')} numeric value={formatCurrency(trade.riskAmount)} />
            <DataPoint label={t('common.stopLoss')} numeric value={formatCurrency(trade.stopLoss)} />
            <DataPoint label={t('common.takeProfit')} numeric value={formatCurrency(trade.takeProfit)} />
            <DataPoint label={t('trades.outcomeR')} numeric value={formatR(trade.rMultiple)} />
          </dl>
        </Card>

        <Card aria-labelledby="context-heading">
          <h2 id="context-heading" className="mb-4 text-sm font-semibold text-primary">{t('trades.context')}</h2>
          <dl className="grid grid-cols-2 gap-x-5 gap-y-4">
            <DataPoint label={t('common.account')} value={accountLabel(trade.accountId, accounts)} />
            <DataPoint label={t('common.market')} value={trade.market} />
            <DataPoint label={t('common.timeframe')} numeric value={trade.timeframe} />
            <DataPoint label={t('common.strategy')} value={trade.strategy} />
            <DataPoint label={t('common.setup')} value={trade.setup} />
          </dl>
        </Card>

        {trade.notes && (
          <Card aria-labelledby="notes-heading">
            <h2 id="notes-heading" className="mb-3 text-sm font-semibold text-primary">{t('common.notes')}</h2>
            <p className="whitespace-pre-wrap text-sm leading-relaxed text-secondary">{trade.notes}</p>
          </Card>
        )}

        {hasEmotionData(trade.emotions) && (
          <Card aria-labelledby="emotions-heading">
            <h2 id="emotions-heading" className="mb-3 text-sm font-semibold text-primary">{t('trades.emotions')}</h2>
            <Emotions emotions={trade.emotions} />
          </Card>
        )}

        {screenshots.length > 0 && (
          <Card aria-labelledby="attachments-heading">
            <h2 id="attachments-heading" className="mb-3 text-sm font-semibold text-primary">{t('trades.attachments')}</h2>
            <ul className="space-y-2">
              {screenshots.map((link, index) => (
                <li key={link.href}>
                  <a
                    href={link.href}
                    target="_blank"
                    rel="noreferrer noopener"
                    className="inline-flex min-h-11 max-w-full items-center gap-2 rounded-md text-sm font-medium text-action hover:underline"
                    aria-label={t('trades.openAttachment', { number: index + 1, host: link.host })}
                  >
                    <ArrowSquareOut size={17} aria-hidden="true" />
                    <span className="truncate">Attachment {index + 1} · {link.host}</span>
                  </a>
                </li>
              ))}
            </ul>
          </Card>
        )}
      </div>
    </div>
  );
}
