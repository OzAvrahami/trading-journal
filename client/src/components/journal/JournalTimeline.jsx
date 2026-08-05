import { CheckCircle, Clock, LinkSimple, PencilSimple, Trash } from '@phosphor-icons/react';
import { Link } from 'react-router-dom';
import { formatDateKey, normalizeDateKey } from '../../utils/dateOnly.js';
import { formatSignedCurrency } from '../../utils/formatters.js';
import { Badge } from '../ui/Badge.jsx';
import { Button } from '../ui/Button.jsx';
import { Card } from '../ui/Card.jsx';
import { IconButton } from '../ui/IconButton.jsx';
import { ValueIndicator } from '../ui/ValueIndicator.jsx';
import { journalType } from './journalTypes.js';
import { useTranslation } from 'react-i18next';

function LinkedTrade({ trade }) {
  const { t } = useTranslation();
  return (
    <li>
      <Link
        to={`/trades/${trade.id}`}
        className="flex min-h-11 flex-wrap items-center gap-x-2 gap-y-1 rounded-md border border-default bg-surface-raised px-3 py-2 text-xs transition-colors hover:border-strong"
      >
        <span className="font-mono font-semibold text-primary" dir="ltr">{trade.symbol}</span>
        <span className="text-muted" dir="ltr">{formatDateKey(normalizeDateKey(trade.entryDatetime), { month: 'short', day: 'numeric', year: 'numeric' })}</span>
        <span className="capitalize text-secondary">{trade.status ? t(`status.${trade.status}`, { defaultValue: trade.status }) : t('common.unavailable')}</span>
        <span className="ms-auto">
          {trade.pnlNet == null ? (
            <span className="font-mono text-muted" dir="ltr"><span className="sr-only">{t('journal.netPnlUnavailable')}: </span>—</span>
          ) : (
            <ValueIndicator value={trade.pnlNet}><span className="sr-only">{t('common.netPnl')}: </span>{formatSignedCurrency(trade.pnlNet)}</ValueIndicator>
          )}
        </span>
      </Link>
    </li>
  );
}

export function JournalEntryCard({ entry, onEdit, onDelete, deleting = false, compact = false }) {
  const { t } = useTranslation();
  const type = journalType(entry.entryType);
  const CompleteIcon = entry.isComplete ? CheckCircle : Clock;
  return (
    <Card as="article" density="compact" className={compact ? '' : 'mx-auto w-full max-w-4xl'}>
      <div className="flex flex-wrap items-center gap-2">
        <Badge variant={type.variant}>{type.label}</Badge>
        <span className="font-mono text-xs text-muted" dir="ltr">{formatDateKey(entry.entryDate)}</span>
        <Badge variant={entry.isComplete ? 'information' : 'warning'}>
          <CompleteIcon size={13} aria-hidden="true" />
          {t(`status.${entry.isComplete ? 'complete' : 'incomplete'}`)}
        </Badge>
        {(onEdit || onDelete) && (
          <div className="ms-auto flex items-center gap-1">
            {onEdit && (
              <IconButton label={t('journal.editNamed', { title: entry.title })} size="mobile" className="adaptive:h-8 adaptive:w-8" onClick={() => onEdit(entry)}>
                <PencilSimple size={16} aria-hidden="true" />
              </IconButton>
            )}
            {onDelete && (
              <IconButton label={t('journal.deleteNamed', { title: entry.title })} variant="destructive" size="mobile" className="adaptive:h-8 adaptive:w-8" disabled={deleting} aria-busy={deleting || undefined} onClick={() => onDelete(entry)}>
                <Trash size={16} aria-hidden="true" />
              </IconButton>
            )}
          </div>
        )}
      </div>

      <h3 className="mt-3 text-[0.9375rem] font-semibold text-primary">{entry.title}</h3>
      <p className="mt-1 whitespace-pre-wrap break-words text-sm leading-relaxed text-secondary">{entry.content}</p>

      {entry.tags?.length > 0 && (
        <ul className="mt-3 flex flex-wrap gap-1.5" aria-label={t('common.tags')}>
          {entry.tags.map((tag) => <li key={tag}><Badge variant="neutral" dir="auto">{tag}</Badge></li>)}
        </ul>
      )}

      {entry.trades?.length > 0 && (
        <section className="mt-3 border-t border-default pt-3" aria-label={t('common.linkedTrades')}>
          <h4 className="mb-2 flex items-center gap-1.5 text-xs font-semibold text-secondary">
            <LinkSimple size={14} aria-hidden="true" /> {t('common.linkedTrades')}
          </h4>
          <ul className="grid gap-2 adaptive:grid-cols-2">
            {entry.trades.map((trade) => <LinkedTrade key={trade.id} trade={trade} />)}
          </ul>
        </section>
      )}
    </Card>
  );
}

export function JournalTimeline({ entries, pagination, page, onPageChange, onEdit, onDelete, deletingId }) {
  const { t } = useTranslation();
  return (
    <section aria-label={t('journal.timeline')} className="space-y-3">
      {entries.map((entry) => (
        <JournalEntryCard key={entry.id} entry={entry} onEdit={onEdit} onDelete={onDelete} deleting={deletingId === entry.id} />
      ))}
      {pagination?.totalPages > 1 && (
        <nav className="flex flex-wrap items-center justify-center gap-2 pt-2" aria-label={t('journal.pagination')}>
          <Button type="button" size="mobile" disabled={page <= 1} onClick={() => onPageChange(page - 1)}>{t('common.previous')}</Button>
          <span className="px-2 text-sm text-secondary" aria-current="page" dir="ltr">{t('common.pageOf', { page: pagination.page, pages: pagination.totalPages })}</span>
          <Button type="button" size="mobile" disabled={page >= pagination.totalPages} onClick={() => onPageChange(page + 1)}>{t('common.next')}</Button>
        </nav>
      )}
    </section>
  );
}
