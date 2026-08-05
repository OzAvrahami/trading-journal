import { describe, expect, it } from 'vitest';
import {
  DEFAULT_TIMEZONE,
  addDaysToDateKey,
  currentDateKey,
  formatDateKey,
  getMonthRange,
  isValidTimezone,
  mondayForDateKey,
  normalizeDateKey,
  periodRange,
  weekdayForDateKey,
} from './dateOnly.js';

describe('date-only calendar helpers', () => {
  it('keeps API calendar keys on their stated day', () => {
    expect(normalizeDateKey('2026-08-03')).toBe('2026-08-03');
    expect(normalizeDateKey('2026-08-03T00:00:00.000Z')).toBe('2026-08-03');
    expect(formatDateKey('2026-08-03', { month: 'short', day: 'numeric' })).toBe('Aug 3');
  });

  it('builds month boundaries and day increments without local-time drift', () => {
    expect(getMonthRange('2024-02-18')).toEqual({ monthStart: '2024-02-01', monthEnd: '2024-02-29' });
    expect(addDaysToDateKey('2026-08-31', 1)).toBe('2026-09-01');
    expect(weekdayForDateKey('2026-08-02')).toBe(0);
  });

  it('uses Asia/Jerusalem as the fallback user timezone', () => {
    const instant = new Date('2026-08-01T21:30:00.000Z');
    expect(DEFAULT_TIMEZONE).toBe('Asia/Jerusalem');
    expect(currentDateKey(undefined, instant)).toBe('2026-08-02');
    expect(currentDateKey('Not/A_Zone', instant)).toBe('2026-08-02');
  });

  it('derives different calendar dates in Asia/Jerusalem and UTC at one instant', () => {
    const instant = new Date('2026-08-01T21:30:00.000Z');
    expect(currentDateKey('Asia/Jerusalem', instant)).toBe('2026-08-02');
    expect(currentDateKey('UTC', instant)).toBe('2026-08-01');
  });

  it('accepts native IANA zones and rejects arbitrary labels', () => {
    expect(isValidTimezone('America/New_York')).toBe(true);
    expect(isValidTimezone('Europe/London')).toBe(true);
    expect(isValidTimezone('Jerusalem time')).toBe(false);
  });

  it('starts WTD on Monday and MTD on the first user-local calendar date', () => {
    const instant = new Date('2026-08-02T10:00:00.000Z');
    expect(mondayForDateKey('2026-08-02')).toBe('2026-07-27');
    expect(periodRange('wtd', 'UTC', instant)).toEqual({ from: '2026-07-27', to: '2026-08-02' });
    expect(periodRange('mtd', 'UTC', instant)).toEqual({ from: '2026-08-01', to: '2026-08-02' });
  });

  it('leaves Journal, Rules, and Goal date-only values on their stated day', () => {
    const values = {
      journalEntryDate: normalizeDateKey('2026-03-27'),
      ruleCheckDate: normalizeDateKey('2026-03-27'),
      goalStartDate: normalizeDateKey('2026-03-27'),
      goalEndDate: normalizeDateKey('2026-03-28'),
    };
    expect(values).toEqual({
      journalEntryDate: '2026-03-27',
      ruleCheckDate: '2026-03-27',
      goalStartDate: '2026-03-27',
      goalEndDate: '2026-03-28',
    });
  });
});
