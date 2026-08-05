import assert from 'node:assert/strict';
import { afterEach, describe, test } from 'node:test';
import pg from 'pg';
import {
  POSTGRES_DATE_OID,
  parsePostgresDate,
} from './client.js';
import { mapPostgresDate } from '../utils/dateTime.js';

const originalTimezone = process.env.TZ;

afterEach(() => {
  if (originalTimezone === undefined) delete process.env.TZ;
  else process.env.TZ = originalTimezone;
});

describe('PostgreSQL calendar-date boundary', () => {
  test('registers OID 1082 as an exact string parser', () => {
    const parser = pg.types.getTypeParser(POSTGRES_DATE_OID, 'text');
    assert.equal(parser('2026-08-04'), '2026-08-04');
    assert.equal(parsePostgresDate('2026-08-04'), '2026-08-04');
  });

  test('does not shift DATE values in Jerusalem, New York, or UTC', () => {
    const parser = pg.types.getTypeParser(POSTGRES_DATE_OID, 'text');
    for (const timezone of ['Asia/Jerusalem', 'America/New_York', 'UTC']) {
      process.env.TZ = timezone;
      assert.equal(parser('2026-08-04'), '2026-08-04', timezone);
      assert.equal(mapPostgresDate(parser('2026-08-04')), '2026-08-04', timezone);
    }
  });

  test('rejects the old local-midnight Date shape instead of shifting it through UTC', () => {
    process.env.TZ = 'Asia/Jerusalem';
    const previousPgShape = new Date(2026, 7, 4);
    assert.equal(previousPgShape.toISOString().slice(0, 10), '2026-08-03');
    assert.throws(() => mapPostgresDate(previousPgShape), /exact YYYY-MM-DD string/);
  });

  test('leaves the TIMESTAMPTZ parser returning real instants', () => {
    const timestampParser = pg.types.getTypeParser(1184, 'text');
    const instant = timestampParser('2026-08-04 06:35:00+00');
    assert.ok(instant instanceof Date);
    assert.equal(instant.toISOString(), '2026-08-04T06:35:00.000Z');
  });
});
