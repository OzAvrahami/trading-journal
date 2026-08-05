import { describe, expect, it } from 'vitest';
import { currentLocalDateTime, instantToLocalDateTime, localDateTimeToInstant } from './zonedDateTime.js';

describe('zoned datetime form boundary', () => {
  it('round-trips instants through the user timezone without using the machine timezone', () => {
    expect(instantToLocalDateTime('2026-08-04T09:30:00.000Z', 'Asia/Jerusalem')).toBe('2026-08-04T12:30');
    expect(localDateTimeToInstant('2026-08-04T12:30', 'Asia/Jerusalem')).toBe('2026-08-04T09:30:00.000Z');
    expect(instantToLocalDateTime('2026-08-04T09:30:00.000Z', 'America/New_York')).toBe('2026-08-04T05:30');
    expect(localDateTimeToInstant('2026-08-04T09:30', 'UTC')).toBe('2026-08-04T09:30:00.000Z');
  });

  it('rejects invalid and nonexistent local times rather than shifting them', () => {
    expect(localDateTimeToInstant('2026-02-30T10:00', 'UTC')).toBeNull();
    expect(localDateTimeToInstant('2026-03-08T02:30', 'America/New_York')).toBeNull();
    expect(localDateTimeToInstant('not-a-date', 'Asia/Jerusalem')).toBeNull();
  });

  it('creates a local default from an explicit instant', () => {
    expect(currentLocalDateTime('Asia/Jerusalem', new Date('2026-08-04T21:30:00Z'))).toBe('2026-08-05T00:30');
  });
});
