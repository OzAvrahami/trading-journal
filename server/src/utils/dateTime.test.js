import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import {
  DEFAULT_TIMEZONE,
  addTimestampDateRange,
  dateKeyInTimezone,
  getUserTimezone,
  isValidDateKey,
  isValidTimezone,
  localDateStartInstant,
  mondayOfDateKey,
  monthStartDateKey,
  normalizeTimezone,
} from './dateTime.js';

describe('timezone and calendar validation', () => {
  test('uses Asia/Jerusalem as the product default', () => {
    assert.equal(DEFAULT_TIMEZONE, 'Asia/Jerusalem');
  });

  test('accepts supported IANA identifiers and trims only whitespace', () => {
    for (const timezone of ['Asia/Jerusalem', 'UTC', 'America/New_York', 'Europe/London']) {
      assert.equal(isValidTimezone(timezone), true, timezone);
    }
    assert.equal(normalizeTimezone('  America/New_York  '), 'America/New_York');
  });

  test('rejects blanks, arbitrary labels, invalid zones, and excessive length', () => {
    for (const timezone of ['', '   ', 'Jerusalem time', 'Mars/Olympus_Mons', 'A'.repeat(65)]) {
      assert.equal(isValidTimezone(timezone), false, timezone);
    }
  });

  test('validates strict real date keys and derives Monday and month starts', () => {
    assert.equal(isValidDateKey('2026-08-03'), true);
    assert.equal(isValidDateKey('2026-02-30'), false);
    assert.equal(isValidDateKey('2026-8-3'), false);
    assert.equal(mondayOfDateKey('2026-08-09'), '2026-08-03');
    assert.equal(monthStartDateKey('2026-08-09'), '2026-08-01');
  });

  test('gets different local dates for the same instant without machine-timezone dependence', () => {
    const instant = new Date('2026-08-01T21:30:00.000Z');
    assert.equal(dateKeyInTimezone('UTC', instant), '2026-08-01');
    assert.equal(dateKeyInTimezone('Asia/Jerusalem', instant), '2026-08-02');
  });

  test('loads timezone by user ID and safely falls back for legacy rows', async () => {
    const calls = [];
    const queryable = {
      async query(sql, params) {
        calls.push({ sql, params });
        return { rows: [{ timezone: calls.length === 1 ? 'Europe/London' : null }] };
      },
    };
    assert.equal(await getUserTimezone('user-1', queryable), 'Europe/London');
    assert.equal(await getUserTimezone('user-2', queryable), 'Asia/Jerusalem');
    assert.match(calls[0].sql, /WHERE id = \$1/);
    assert.deepEqual(calls.map((call) => call.params), [['user-1'], ['user-2']]);
  });
});

describe('DST-safe boundaries and parameterized SQL', () => {
  test('Asia/Jerusalem spring transition produces a 23-hour local day', () => {
    const start = localDateStartInstant('2026-03-27', 'Asia/Jerusalem');
    const next = localDateStartInstant('2026-03-28', 'Asia/Jerusalem');
    assert.equal(start.toISOString(), '2026-03-26T22:00:00.000Z');
    assert.equal((next - start) / 3600000, 23);
  });

  test('America/New_York spring transition produces a 23-hour local day', () => {
    const start = localDateStartInstant('2026-03-08', 'America/New_York');
    const next = localDateStartInstant('2026-03-09', 'America/New_York');
    assert.equal(start.toISOString(), '2026-03-08T05:00:00.000Z');
    assert.equal((next - start) / 3600000, 23);
  });

  test('UTC boundaries remain exact 24-hour midnights', () => {
    const start = localDateStartInstant('2026-03-08', 'UTC');
    const next = localDateStartInstant('2026-03-09', 'UTC');
    assert.equal(start.toISOString(), '2026-03-08T00:00:00.000Z');
    assert.equal((next - start) / 3600000, 24);
  });

  test('builds an inclusive product range as parameterized half-open SQL', () => {
    const conditions = ['t.user_id = $1'];
    const params = ['user-id'];
    addTimestampDateRange({
      conditions,
      params,
      column: 't.entry_datetime',
      from: '2026-03-27',
      to: '2026-03-28',
      timezone: 'Asia/Jerusalem',
    });
    assert.match(conditions[1], />= \(\$2::date::timestamp AT TIME ZONE \$3\)/);
    assert.match(conditions[2], /< \(\(\$4::date \+ 1\)::timestamp AT TIME ZONE \$3\)/);
    assert.deepEqual(params, ['user-id', '2026-03-27', 'Asia/Jerusalem', '2026-03-28']);
    assert.doesNotMatch(conditions.join(' '), /Asia\/Jerusalem/);
  });
});
