import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { CalendarBlank, CaretLeft, CaretRight } from '@phosphor-icons/react';
import { journalApi } from '../../api/journal.js';
import { useDirection } from '../../hooks/useDirection.js';
import {
  addDaysToDateKey,
  DEFAULT_TIMEZONE,
  dateKeyParts,
  formatDateKey,
  getMonthRange,
  localTodayKey,
  normalizeDateKey,
  weekdayForDateKey,
} from '../../utils/dateOnly.js';
import { Button } from '../ui/Button.jsx';
import { Card } from '../ui/Card.jsx';
import { EmptyState, ErrorState } from '../ui/States.jsx';
import { IconButton } from '../ui/IconButton.jsx';
import { Skeleton } from '../ui/Skeleton.jsx';
import { JournalEntryCard } from './JournalTimeline.jsx';

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export function addMonthsToKey(month, amount) {
  const [year, monthNumber] = month.split('-').map(Number);
  const total = year * 12 + (monthNumber - 1) + amount;
  return `${Math.floor(total / 12)}-${String((total % 12 + 12) % 12 + 1).padStart(2, '0')}`;
}

export function buildJournalCalendarGrid(month, summaries = []) {
  const range = getMonthRange(`${month}-01`);
  const byDate = new Map(summaries.map((day) => [normalizeDateKey(day.date), day]));
  const grid = Array.from({ length: weekdayForDateKey(range.monthStart) ?? 0 }, () => null);
  let current = range.monthStart;
  while (current <= range.monthEnd) {
    grid.push({ ...(byDate.get(current) ?? { total: 0, complete: 0, incomplete: 0, entryTypes: [] }), date: current });
    current = addDaysToDateKey(current, 1);
  }
  while (grid.length % 7) grid.push(null);
  return grid;
}

export function JournalCalendar({ month, selectedDate, timezone = DEFAULT_TIMEZONE, onMonthChange, onDateSelect, onEdit, onDelete, deletingId }) {
  const { isRtl } = useDirection();
  const calendarQuery = useQuery({
    queryKey: ['journal', 'calendar', month],
    queryFn: () => journalApi.calendar(month),
    placeholderData: (previous) => previous,
  });
  const selectedQuery = useQuery({
    queryKey: ['journal', 'entries', 'calendar-day', selectedDate],
    queryFn: () => journalApi.list({ from: selectedDate, to: selectedDate, status: 'all', page: 1, limit: 100 }),
    enabled: Boolean(selectedDate),
    placeholderData: (previous) => previous,
  });
  const grid = useMemo(() => buildJournalCalendarGrid(month, calendarQuery.data?.days ?? []), [calendarQuery.data, month]);
  const monthLabel = formatDateKey(`${month}-01`, { month: 'long', year: 'numeric' });
  const PreviousIcon = isRtl ? CaretRight : CaretLeft;
  const NextIcon = isRtl ? CaretLeft : CaretRight;
  const today = localTodayKey(new Date(), timezone);
  const selectedEntries = selectedQuery.data?.entries ?? [];

  function goToday() {
    const todayMonth = today.slice(0, 7);
    onMonthChange(todayMonth);
    onDateSelect(today);
  }

  return (
    <div className="grid min-w-0 gap-4 wide:grid-cols-[minmax(0,1.45fr)_minmax(20rem,0.8fr)]">
      <Card className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <div className="min-w-0 flex-1">
            <h2 className="text-sm font-semibold text-primary">{monthLabel}</h2>
            <p className="mt-0.5 text-xs text-muted">Weeks begin on Sunday. Select a day to review its entries.</p>
          </div>
          <IconButton label="Previous month" size="mobile" className="adaptive:h-9 adaptive:w-9" onClick={() => onMonthChange(addMonthsToKey(month, -1))}>
            <PreviousIcon size={17} aria-hidden="true" />
          </IconButton>
          <Button type="button" size="mobile" className="adaptive:min-h-9" onClick={goToday}>Today</Button>
          <IconButton label="Next month" size="mobile" className="adaptive:h-9 adaptive:w-9" onClick={() => onMonthChange(addMonthsToKey(month, 1))}>
            <NextIcon size={17} aria-hidden="true" />
          </IconButton>
        </div>

        {calendarQuery.isLoading ? (
          <Skeleton className="mt-4 h-[25rem] w-full" label="Loading journal calendar" />
        ) : calendarQuery.isError && !calendarQuery.data ? (
          <div className="mt-4"><ErrorState title="Journal calendar could not be loaded" detail="Month-level entry counts are unavailable." available="Timeline and journal entry form" onRetry={calendarQuery.refetch} /></div>
        ) : (
          <>
            {calendarQuery.isError && <div className="mt-4"><ErrorState title="Journal calendar could not be refreshed" detail="The last available month remains visible." onRetry={calendarQuery.refetch} /></div>}
            {calendarQuery.isFetching && !calendarQuery.isLoading && <p className="mt-2 text-xs text-muted" role="status">Refreshing calendar…</p>}
            {(calendarQuery.data?.days?.length ?? 0) === 0 && (
              <p className="mt-4 rounded-md border border-dashed border-strong bg-surface-raised p-3 text-sm text-secondary">No journal entries this month</p>
            )}
            <div className="mt-4" role="grid" aria-label={`Journal entries for ${monthLabel}`}>
              <div className="grid grid-cols-7 gap-1 adaptive:gap-1.5" role="row">
                {WEEKDAYS.map((day) => <div key={day} role="columnheader" className="pb-1 text-center text-[0.65625rem] font-semibold uppercase tracking-wide text-muted">{day}</div>)}
              </div>
              <div className="grid grid-cols-7 gap-1 adaptive:gap-1.5">
                {grid.map((day, index) => {
                  if (!day) return <div key={`empty-${index}`} aria-hidden="true" className="min-h-16 rounded-sm border border-dashed border-default opacity-40 adaptive:min-h-20" />;
                  const isSelected = day.date === selectedDate;
                  const isToday = day.date === today;
                  return (
                    <button
                      key={day.date}
                      type="button"
                      role="gridcell"
                      aria-selected={isSelected}
                      aria-current={isToday ? 'date' : undefined}
                      aria-label={`${formatDateKey(day.date)}, ${day.total} ${day.total === 1 ? 'entry' : 'entries'}, ${day.complete} complete, ${day.incomplete} incomplete`}
                      onClick={() => onDateSelect(day.date)}
                      className={`flex min-h-16 min-w-0 flex-col items-start rounded-sm border p-1.5 text-start transition-colors adaptive:min-h-20 adaptive:p-2 ${day.total ? 'border-strong bg-surface-raised hover:border-action' : 'border-default bg-surface-sunken text-muted'} ${isSelected ? 'ring-2 ring-action ring-offset-1 ring-offset-surface' : ''}`}
                    >
                      <span className="font-mono text-[0.65625rem] tabular-nums" dir="ltr">{dateKeyParts(day.date)?.day}</span>
                      {day.total > 0 && (
                        <>
                          <span className="mt-2 font-mono text-xs font-semibold text-primary" dir="ltr">{day.total}</span>
                          <span className="mt-1 flex gap-1" aria-hidden="true">
                            {day.complete > 0 && <span className="h-1.5 w-1.5 rounded-pill bg-information" />}
                            {day.incomplete > 0 && <span className="h-1.5 w-1.5 rounded-pill bg-warning" />}
                          </span>
                        </>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          </>
        )}
      </Card>

      <section aria-labelledby="selected-day-heading" className="min-w-0 space-y-3">
        <div className="flex items-center gap-2">
          <CalendarBlank size={17} className="text-muted" aria-hidden="true" />
          <h2 id="selected-day-heading" className="text-sm font-semibold text-primary">
            {selectedDate ? formatDateKey(selectedDate) : 'Selected day'}
          </h2>
        </div>
        {!selectedDate ? (
          <EmptyState title="Select a calendar day" detail="Choose a day to see its real journal entries." />
        ) : selectedQuery.isLoading ? (
          <Skeleton className="h-40 w-full" label="Loading selected day entries" />
        ) : selectedQuery.isError && !selectedQuery.data ? (
          <ErrorState title="Selected day could not be loaded" detail="Entries for this day are unavailable." available="Month counts and navigation" onRetry={selectedQuery.refetch} />
        ) : selectedEntries.length === 0 ? (
          <EmptyState title="No journal entries on this day" detail="The selected calendar date has no saved entries." />
        ) : (
          <div className="space-y-3">
            {selectedQuery.isError && <ErrorState title="Selected day could not be refreshed" detail="The last available entries remain visible." onRetry={selectedQuery.refetch} />}
            {selectedEntries.map((entry) => <JournalEntryCard key={entry.id} entry={entry} compact onEdit={onEdit} onDelete={onDelete} deleting={deletingId === entry.id} />)}
          </div>
        )}
      </section>
    </div>
  );
}
