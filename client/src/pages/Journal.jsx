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

const DEFAULT_FILTERS = Object.freeze({
  search: '', type: '', status: 'all', from: '', to: '', page: 1, limit: 25,
});

function TimelineSkeleton() {
  return (
    <div className="mx-auto max-w-4xl space-y-3" aria-label="Loading journal timeline">
      {Array.from({ length: 3 }, (_, index) => (
        <div key={index} className="rounded-lg border border-default bg-surface p-4">
          <Skeleton className="h-5 w-1/3" label="Loading journal entry" />
          <Skeleton className="mt-4 h-4 w-2/3" label="Loading journal title" />
          <Skeleton className="mt-3 h-16 w-full" label="Loading journal content" />
        </div>
      ))}
    </div>
  );
}

function queryParams(filters) {
  return Object.fromEntries(Object.entries(filters).filter(([, value]) => value !== '' && value != null));
}

export default function Journal() {
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
    ? 'End date must not precede start date.'
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
      toast.success('Journal entry created.');
    },
    onError: () => toast.error('Journal entry could not be created.'),
  });
  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => journalApi.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['journal'] });
      setFormOpen(false);
      setEditingEntry(null);
      toast.success('Journal entry updated.');
    },
    onError: () => toast.error('Journal entry could not be updated.'),
  });
  const deleteMutation = useMutation({
    mutationFn: journalApi.remove,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['journal'] });
      toast.success('Journal entry deleted.');
    },
    onError: () => toast.error('Journal entry could not be deleted.'),
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
    if (!window.confirm(`Delete “${entry.title}”?`)) return;
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
          New Entry
        </Button>
      </RouteHeaderControls>

      <section aria-label="Journal controls" className="rounded-lg border border-default bg-surface p-3">
        <div className="flex flex-wrap items-center gap-2">
          <div role="group" aria-label="Journal view" className="flex min-h-11 rounded-md border border-default bg-surface-sunken p-0.5 adaptive:min-h-9">
            <button
              type="button"
              aria-pressed={view === 'timeline'}
              onClick={() => setView('timeline')}
              className={`inline-flex min-w-28 items-center justify-center gap-2 rounded-sm px-3 text-sm transition-colors ${view === 'timeline' ? 'bg-surface font-semibold text-primary shadow-flat' : 'text-muted hover:text-primary'}`}
            >
              <ListBullets size={16} aria-hidden="true" /> Timeline
            </button>
            <button
              type="button"
              aria-pressed={view === 'calendar'}
              onClick={() => setView('calendar')}
              className={`inline-flex min-w-28 items-center justify-center gap-2 rounded-sm px-3 text-sm transition-colors ${view === 'calendar' ? 'bg-surface font-semibold text-primary shadow-flat' : 'text-muted hover:text-primary'}`}
            >
              <CalendarBlank size={16} aria-hidden="true" /> Calendar
            </button>
          </div>

          <label className="min-w-52 flex-[2_1_18rem]">
            <span className="sr-only">Search journal entries</span>
            <input
              type="search"
              value={filters.search}
              onChange={(event) => updateFilter('search', event.target.value)}
              placeholder="Search title, content, or tags"
              className="input min-h-11 adaptive:min-h-9"
            />
          </label>
          <label className="min-w-40 flex-1">
            <span className="sr-only">Entry type</span>
            <select aria-label="Entry type" value={filters.type} onChange={(event) => updateFilter('type', event.target.value)} className="input min-h-11 adaptive:min-h-9">
              <option value="">All entry types</option>
              {JOURNAL_ENTRY_TYPES.map((type) => <option key={type.value} value={type.value}>{type.label}</option>)}
            </select>
          </label>
          <label className="min-w-40 flex-1">
            <span className="sr-only">Completion status</span>
            <select aria-label="Completion status" value={filters.status} onChange={(event) => updateFilter('status', event.target.value)} className="input min-h-11 adaptive:min-h-9">
              <option value="all">All statuses</option>
              <option value="complete">Complete</option>
              <option value="incomplete">Incomplete</option>
            </select>
          </label>
        </div>
        <div className="mt-2 flex flex-wrap items-start gap-2">
          <label className="min-w-40 flex-1 adaptive:max-w-48">
            <span className="label">From</span>
            <input aria-label="From date" type="date" dir="ltr" value={filters.from} max={filters.to || undefined} onChange={(event) => updateFilter('from', event.target.value)} className="input min-h-11 adaptive:min-h-9" />
          </label>
          <label className="min-w-40 flex-1 adaptive:max-w-48">
            <span className="label">To</span>
            <input aria-label="To date" type="date" dir="ltr" value={filters.to} min={filters.from || undefined} onChange={(event) => updateFilter('to', event.target.value)} className="input min-h-11 adaptive:min-h-9" />
          </label>
          {hasActiveFilters && <Button type="button" size="mobile" className="mt-5 adaptive:min-h-9" onClick={clearFilters}>Clear filters</Button>}
        </div>
      </section>

      {view === 'timeline' ? (
        <>
          {timelineQuery.isError && timelineData && (
            <ErrorState title="Journal entries could not be refreshed" detail="The last available timeline remains visible." available="Filters, calendar, and entry form" onRetry={timelineQuery.refetch} />
          )}
          {pagination && (
            <div className="flex min-h-8 flex-wrap items-center justify-between gap-2 text-xs text-secondary" role="status" aria-live="polite">
              <span dir="ltr">{pagination.total} {pagination.total === 1 ? 'entry' : 'entries'}</span>
              {timelineQuery.isFetching && !timelineQuery.isLoading && <span className="text-muted">Refreshing timeline…</span>}
            </div>
          )}
          {rangeError ? (
            <ErrorState title="Date range is invalid" detail="Choose an end date on or after the start date." available="Your existing entries and filters remain unchanged" />
          ) : timelineQuery.isLoading ? (
            <TimelineSkeleton />
          ) : timelineQuery.isError && !timelineData ? (
            <ErrorState title="Journal entries could not be loaded" detail="The timeline request failed." available="Calendar and entry form" onRetry={timelineQuery.refetch} />
          ) : entries.length === 0 ? (
            <EmptyState
              filtered={hasActiveFilters}
              title={hasActiveFilters ? 'No entries match the current filters' : 'No journal entries yet'}
              detail={hasActiveFilters ? 'Clear the current filters to return to the full journal.' : 'Use New Entry in the page header when you are ready to write.'}
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

      <Modal open={formOpen} onClose={closeForm} title={editingEntry ? 'Edit journal entry' : 'New journal entry'} size="lg">
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
