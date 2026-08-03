import { describe, expect, it } from 'vitest';
import {
  addDaysToDateKey,
  formatDateKey,
  getMonthRange,
  normalizeDateKey,
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
});
