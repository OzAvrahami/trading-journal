import { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { CalendarBlank, ListBullets, Plus } from '@phosphor-icons/react';
import { useSearchParams } from 'react-router-dom';
import { journalApi } from '../api/journal.js';
import { JournalCalendar } from '../components/journal/JournalCalendar.jsx';
import { JournalEntryForm } from '../components/journal/JournalEntryForm.jsx';
import { JournalTimeline } from '../components/journal/JournalTimeline.jsx';
import { JOURNAL_ENTRY_TYPES } from '../components/journal/journalTypes.js';
import { RouteHeaderControls } from '../components/layout/HeaderControls.jsx';
import { Button } from '../components/ui/Button.jsx';
import { EmptyState, ErrorState } from '../components/ui/States.jsx';
import { Modal } from '../components/ui/Modal.jsx';
import { Skeleton } from '../components/ui/Skeleton.jsx';
import { useToast } from '../components/ui/Toast.jsx';
import { localTodayKey } from '../utils/dateOnly.js';
import { useUserTimezone } from '../hooks/useUserTimezone.js';
import { useTranslation } from 'react-i18next';

const DEFAULT_FILTERS = Object.freeze({
  search: '', type: '', status: 'all', from: '', to: '', page: 1, limit: 25,
});

function TimelineSkeleton() {
  const { t } = useTranslation();
  return (
    <div className="mx-auto max-w-4xl space-y-3" aria-label={t('journal.loadingTimeline')}>
      {Array.from({ length: 3 }, (_, index) => (
        <div key={index} className="rounded-lg border border-default bg-surface p-4">
          <Skeleton className="h-5 w-1/3" label={t('journal.loadingEntry')} />
          <Skeleton className="mt-4 h-4 w-2/3" label={t('journal.loadingTitle')} />
          <Skeleton className="mt-3 h-16 w-full" label={t('journal.loadingContent')} />
        </div>
      ))}
    </div>
  );
}

function queryParams(filters) {
  return Object.fromEntries(Object.entries(filters).filter(([, value]) => value !== '' && value != null));
}

export default function Journal() {
  const { t } = useTranslation();
  const timezone = useUserTimezone();
  const [view, setView] = useState('timeline');
  const [filters, setFilters] = useState({ ...DEFAULT_FILTERS });
  const [month, setMonth] = useState(() => localTodayKey(new Date(), timezone).slice(0, 7));
  const [selectedDate, setSelectedDate] = useState(() => localTodayKey(new Date(), timezone));
  const [formOpen, setFormOpen] = useState(false);
  const [editingEntry, setEditingEntry] = useState(null);
  const [searchParams, setSearchParams] = useSearchParams();
  const queryClient = useQueryClient();
  const toast = useToast();
  const rangeError = filters.from && filters.to && filters.from > filters.to
    ? t('validation.dateRange')
    : '';
  const params = useMemo(() => queryParams(filters), [filters]);
  const hasActiveFilters = Boolean(filters.search || filters.type || filters.status !== 'all' || filters.from || filters.to);

  useEffect(() => {
    if (searchParams.get('new') !== '1') return;
    setEditingEntry(null);
    setFormOpen(true);
    const next = new URLSearchParams(searchParams);
    next.delete('new');
    setSearchParams(next, { replace: true });
  }, [searchParams, setSearchParams]);

  const timelineQuery = useQuery({
    queryKey: ['journal', 'entries', 'timeline', params],
    queryFn: () => journalApi.list(params),
    enabled: !rangeError,
    placeholderData: (previous) => previous,
  });

  const createMutation = useMutation({
    mutationFn: journalApi.create,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['journal'] });
      setFormOpen(false);
      toast.success(t('journal.entrySaved'));
    },
    onError: () => toast.error(t('journal.saveFailed')),
  });
  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => journalApi.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['journal'] });
      setFormOpen(false);
      setEditingEntry(null);
      toast.success(t('journal.entrySaved'));
    },
    onError: () => toast.error(t('journal.saveFailed')),
  });
  const deleteMutation = useMutation({
    mutationFn: journalApi.remove,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['journal'] });
      toast.success(t('journal.entryDeleted'));
    },
    onError: () => toast.error(t('journal.deleteFailed')),
  });

  function openCreate() {
    setEditingEntry(null);
    setFormOpen(true);
  }

  function openEdit(entry) {
    setEditingEntry(entry);
    setFormOpen(true);
  }

  function closeForm() {
    if (createMutation.isPending || updateMutation.isPending) return;
    setFormOpen(false);
    setEditingEntry(null);
  }

  function submitEntry(data) {
    if (editingEntry) updateMutation.mutate({ id: editingEntry.id, data });
    else createMutation.mutate(data);
  }

  function deleteEntry(entry) {
    if (!window.confirm(t('journal.deleteNamedConfirm', { title: entry.title }))) return;
    deleteMutation.mutate(entry.id);
  }

  function updateFilter(key, value) {
    setFilters((current) => ({ ...current, [key]: value, page: 1 }));
  }

  function clearFilters() {
    setFilters({ ...DEFAULT_FILTERS });
  }

  function changeMonth(nextMonth) {
    setMonth(nextMonth);
    setSelectedDate(`${nextMonth}-01`);
  }

  const timelineData = timelineQuery.data;
  const entries = timelineData?.entries ?? [];
  const pagination = timelineData?.pagination;

  return (
    <div className="space-y-4 adaptive:space-y-5">
      <RouteHeaderControls slot="journalActions">
        <Button type="button" variant="primary" size="mobile" className="adaptive:min-h-9" leadingIcon={<Plus size={17} aria-hidden="true" />} onClick={openCreate}>
          {t('journal.newEntry')}
        </Button>
      </RouteHeaderControls>

      <section aria-label={t('journal.controls')} className="rounded-lg border border-default bg-surface p-3">
        <div className="flex flex-wrap items-center gap-2">
          <div role="group" aria-label={t('journal.view')} className="flex min-h-11 rounded-md border border-default bg-surface-sunken p-0.5 adaptive:min-h-9">
            <button
              type="button"
              aria-pressed={view === 'timeline'}
              onClick={() => setView('timeline')}
              className={`inline-flex min-w-28 items-center justify-center gap-2 rounded-sm px-3 text-sm transition-colors ${view === 'timeline' ? 'bg-surface font-semibold text-primary shadow-flat' : 'text-muted hover:text-primary'}`}
            >
              <ListBullets size={16} aria-hidden="true" /> {t('common.timeline')}
            </button>
            <button
              type="button"
              aria-pressed={view === 'calendar'}
              onClick={() => setView('calendar')}
              className={`inline-flex min-w-28 items-center justify-center gap-2 rounded-sm px-3 text-sm transition-colors ${view === 'calendar' ? 'bg-surface font-semibold text-primary shadow-flat' : 'text-muted hover:text-primary'}`}
            >
              <CalendarBlank size={16} aria-hidden="true" /> {t('common.calendar')}
            </button>
          </div>

          <label className="min-w-52 flex-[2_1_18rem]">
            <span className="sr-only">{t('journal.search')}</span>
            <input
              type="search"
              value={filters.search}
              onChange={(event) => updateFilter('search', event.target.value)}
              placeholder={t('journal.searchPlaceholder')}
              className="input min-h-11 adaptive:min-h-9"
            />
          </label>
          <label className="min-w-40 flex-1">
            <span className="sr-only">{t('journal.entryType')}</span>
            <select aria-label={t('journal.entryType')} value={filters.type} onChange={(event) => updateFilter('type', event.target.value)} className="input min-h-11 adaptive:min-h-9">
              <option value="">{t('common.all')}</option>
              {JOURNAL_ENTRY_TYPES.map((type) => <option key={type.value} value={type.value}>{type.label}</option>)}
            </select>
          </label>
          <label className="min-w-40 flex-1">
            <span className="sr-only">{t('journal.completionStatus')}</span>
            <select aria-label={t('journal.completionStatus')} value={filters.status} onChange={(event) => updateFilter('status', event.target.value)} className="input min-h-11 adaptive:min-h-9">
              <option value="all">{t('common.all')}</option>
              <option value="complete">{t('common.complete')}</option>
              <option value="incomplete">{t('common.incomplete')}</option>
            </select>
          </label>
        </div>
        <div className="mt-2 flex flex-wrap items-start gap-2">
          <label className="min-w-40 flex-1 adaptive:max-w-48">
            <span className="label">{t('common.from')}</span>
            <input aria-label={t('journal.fromDate')} type="date" dir="ltr" value={filters.from} max={filters.to || undefined} onChange={(event) => updateFilter('from', event.target.value)} className="input min-h-11 adaptive:min-h-9" />
          </label>
          <label className="min-w-40 flex-1 adaptive:max-w-48">
            <span className="label">{t('common.to')}</span>
            <input aria-label={t('journal.toDate')} type="date" dir="ltr" value={filters.to} min={filters.from || undefined} onChange={(event) => updateFilter('to', event.target.value)} className="input min-h-11 adaptive:min-h-9" />
          </label>
          {hasActiveFilters && <Button type="button" size="mobile" className="mt-5 adaptive:min-h-9" onClick={clearFilters}>{t('common.clearFilters')}</Button>}
        </div>
      </section>

      {view === 'timeline' ? (
        <>
          {timelineQuery.isError && timelineData && (
            <ErrorState title={t('journal.refreshFailed')} detail={t('journal.lastTimelineVisible')} available={t('journal.filtersCalendarForm')} onRetry={timelineQuery.refetch} />
          )}
          {pagination && (
            <div className="flex min-h-8 flex-wrap items-center justify-between gap-2 text-xs text-secondary" role="status" aria-live="polite">
              <span>{t('journal.entryCount', { count: pagination.total })}</span>
              {timelineQuery.isFetching && !timelineQuery.isLoading && <span className="text-muted">{t('journal.refreshingTimeline')}</span>}
            </div>
          )}
          {rangeError ? (
            <ErrorState title={t('journal.invalidRange')} detail={t('journal.invalidRangeDetail')} available={t('journal.entriesFiltersUnchanged')} />
          ) : timelineQuery.isLoading ? (
            <TimelineSkeleton />
          ) : timelineQuery.isError && !timelineData ? (
            <ErrorState title={t('journal.loadFailed')} detail={t('journal.loadFailedDetail')} available={t('journal.calendarAndForm')} onRetry={timelineQuery.refetch} />
          ) : entries.length === 0 ? (
            <EmptyState
              filtered={hasActiveFilters}
              title={hasActiveFilters ? t('journal.filteredEmpty') : t('journal.noEntries')}
              detail={t('journal.noEntriesDetail')}
            />
          ) : (
            <JournalTimeline
              entries={entries}
              pagination={pagination}
              page={filters.page}
              onPageChange={(page) => setFilters((current) => ({ ...current, page }))}
              onEdit={openEdit}
              onDelete={deleteEntry}
              deletingId={deleteMutation.isPending ? deleteMutation.variables : null}
            />
          )}
        </>
      ) : (
        <JournalCalendar
          timezone={timezone}
          month={month}
          selectedDate={selectedDate}
          onMonthChange={changeMonth}
          onDateSelect={setSelectedDate}
          onEdit={openEdit}
          onDelete={deleteEntry}
          deletingId={deleteMutation.isPending ? deleteMutation.variables : null}
        />
      )}

      <Modal open={formOpen} onClose={closeForm} title={editingEntry ? t('journal.editEntryDialog') : t('journal.newEntryDialog')} size="lg">
        <JournalEntryForm
          key={editingEntry?.id ?? 'new'}
          entry={editingEntry}
          timezone={timezone}
          onSubmit={submitEntry}
          loading={createMutation.isPending || updateMutation.isPending}
        />
      </Modal>
    </div>
  );
}
