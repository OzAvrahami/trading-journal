import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { analyticsApi } from '../../api/analytics.js';
import { Card } from '../ui/Card.jsx';
import { ErrorState } from '../ui/States.jsx';
import { Skeleton } from '../ui/Skeleton.jsx';
import { ValueIndicator } from '../ui/ValueIndicator.jsx';
import { formatSignedCurrency, rawCurrency } from '../../utils/formatters.js';
import {
  addDaysToDateKey,
  dateKeyParts,
  formatDateKey,
  getMonthRange,
  localTodayKey,
  normalizeDateKey,
  weekdayForDateKey,
} from '../../utils/dateOnly.js';

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export function buildCalendarDays(from, to, pnlByDate) {
  const days = [];
  let current = from;
  while (current && current <= to) {
    const existing = pnlByDate.get(current);
    days.push({ date: current, pnlNet: existing?.pnlNet ?? 0, tradesCount: existing?.tradesCount ?? 0 });
    current = addDaysToDateKey(current, 1);
  }
  return days;
}

export function buildCalendarGrid(days, monthStart) {
  const grid = Array.from({ length: weekdayForDateKey(monthStart) ?? 0 }, () => null);
  grid.push(...days);
  while (grid.length % 7 !== 0) grid.push(null);
  return grid;
}

function dayTone(day) {
  if (!day?.tradesCount) return 'border-default bg-surface-sunken text-muted';
  if (day.pnlNet > 0) return 'border-positive bg-positive-soft text-positive';
  if (day.pnlNet < 0) return 'border-negative bg-negative-soft text-negative';
  return 'border-strong bg-surface-raised text-secondary';
}

export function TradingCalendar({ qParams }) {
  const monthRange = getMonthRange(qParams?.from);
  const calendarParams = useMemo(() => (
    monthRange ? { ...qParams, from: monthRange.monthStart, to: monthRange.monthEnd } : null
  ), [monthRange?.monthStart, monthRange?.monthEnd, qParams?.accountId, qParams?.company]);

  const query = useQuery({
    queryKey: ['analytics', 'calendar', calendarParams],
    queryFn: () => analyticsApi.calendar(calendarParams),
    enabled: Boolean(calendarParams),
  });

  if (!calendarParams || query.isLoading) {
    return <Skeleton className="h-[25rem] w-full" label="Loading trading calendar" />;
  }

  if (query.error) {
    return <ErrorState title="Trading calendar could not be loaded" detail="Daily realized PnL is unavailable for this month." available="Dashboard controls and any other successful widgets" onRetry={query.refetch} />;
  }

  const apiDays = query.data?.days ?? [];
  const pnlByDate = new Map(apiDays.map(day => [normalizeDateKey(day.date), day]).filter(([key]) => key));
  const days = buildCalendarDays(calendarParams.from, calendarParams.to, pnlByDate);
  const grid = buildCalendarGrid(days, calendarParams.from);
  const today = localTodayKey();
  const total = apiDays.reduce((sum, day) => sum + Number(day.pnlNet ?? 0), 0);
  const tradingDays = apiDays.filter(day => Number(day.tradesCount ?? 0) > 0).length;
  const monthParts = dateKeyParts(calendarParams.from);
  const monthLabel = formatDateKey(calendarParams.from, { month: 'long', year: 'numeric' });

  return (
    <Card className="min-w-0">
      <div className="flex flex-wrap items-baseline gap-2">
        <div>
          <h2 className="text-sm font-semibold text-primary">Daily realized PnL · {monthLabel}</h2>
          <p className="mt-1 text-xs text-muted">Closed-trade net PnL by entry date; weeks begin on Sunday.</p>
        </div>
        <ValueIndicator value={total} className="ms-auto text-sm font-semibold">{formatSignedCurrency(total)}</ValueIndicator>
      </div>

      {query.isFetching && !query.isLoading && <p className="mt-2 text-xs text-muted" role="status">Refreshing calendar…</p>}
      {tradingDays === 0 && <p className="mt-3 rounded-md border border-dashed border-strong bg-surface-raised p-3 text-sm text-secondary">No closed trades were recorded in this calendar month.</p>}

      <div className="mt-4" role="grid" aria-label={`Daily realized PnL for ${monthLabel}`}>
        <div className="grid grid-cols-7 gap-1 adaptive:gap-1.5" role="row">
          {WEEKDAYS.map(dayName => (
            <div key={dayName} className="pb-1 text-center text-[0.65625rem] font-semibold uppercase tracking-wide text-muted" role="columnheader">{dayName}</div>
          ))}
        </div>
        <div className="grid grid-cols-7 gap-1 adaptive:gap-1.5">
          {grid.map((day, index) => {
            if (!day) return <div key={`empty-${index}`} className="min-h-16 rounded-sm border border-dashed border-default opacity-40 adaptive:min-h-20" aria-hidden="true" />;
            const hasTrades = day.tradesCount > 0;
            const isToday = day.date === today;
            const dayNumber = dateKeyParts(day.date)?.day;
            const ariaLabel = `${formatDateKey(day.date)}, ${hasTrades ? `${rawCurrency(day.pnlNet)}, ${day.tradesCount} ${day.tradesCount === 1 ? 'trade' : 'trades'}` : 'no closed trades'}`;
            return (
              <div
                key={day.date}
                role="gridcell"
                aria-label={ariaLabel}
                aria-current={isToday ? 'date' : undefined}
                className={`min-h-16 min-w-0 rounded-sm border p-1.5 adaptive:min-h-20 adaptive:p-2 ${dayTone(day)} ${isToday ? 'ring-2 ring-action ring-offset-1 ring-offset-surface' : ''}`}
              >
                <span className="block font-mono text-[0.65625rem] tabular-nums text-muted" dir="ltr">{dayNumber}</span>
                <span className="mt-2 block overflow-hidden text-ellipsis font-mono text-[0.625rem] font-semibold tabular-nums adaptive:text-xs" dir="ltr">
                  {hasTrades ? formatSignedCurrency(day.pnlNet, { maximumFractionDigits: 0, minimumFractionDigits: 0 }) : '—'}
                </span>
                {hasTrades && <span className="mt-1 hidden text-[0.625rem] text-muted adaptive:block">{day.tradesCount} {day.tradesCount === 1 ? 'trade' : 'trades'}</span>}
              </div>
            );
          })}
        </div>
      </div>
      <p className="mt-3 text-xs text-muted">{tradingDays} {tradingDays === 1 ? 'trading day' : 'trading days'} in {monthParts?.year}.</p>
    </Card>
  );
}
