import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { afterEach, describe, test } from 'node:test';
import pool, { parsePostgresDate } from '../db/client.js';
import { dailyReviewDateSchema, dailyReviewPayloadSchema } from '../routes/dailyReviews.js';
import { daySummarySchema } from '../routes/analytics.js';
import { getDailyReview, mapDailyReview, putDailyReview } from './dailyReviewService.js';
import { getDaySummary } from './analyticsService.js';

const migration = readFileSync(new URL('../db/migrations/010_daily_review_details.sql', import.meta.url), 'utf8');
const originalQuery = pool.query;
const originalConnect = pool.connect;
const userId = '11111111-1111-4111-8111-111111111111';
const entryId = '22222222-2222-4222-8222-222222222222';
const date = '2026-08-04';
const row = {
  id: entryId, entry_type: 'daily_review', entry_date: parsePostgresDate(date), title: `Daily Review — ${date}`,
  content: 'Reviewed the session.', is_complete: false, created_at: '2026-08-04T15:00:00Z', updated_at: '2026-08-04T15:00:00Z',
  went_well: null, improve: null, next_session_plan: null, emotions: null, mistakes: null,
};

afterEach(() => { pool.query = originalQuery; pool.connect = originalConnect; });

describe('Daily Review validation', () => {
  test('requires a strict real DATE and Boolean completion', () => {
    assert.equal(dailyReviewDateSchema.safeParse(date).success, true);
    assert.equal(dailyReviewDateSchema.safeParse('2026-02-30').success, false);
    assert.equal(daySummarySchema.safeParse({ date }).success, true);
    assert.equal(daySummarySchema.safeParse({ date: '08/04/2026' }).success, false);
    assert.equal(dailyReviewPayloadSchema.safeParse({ content: 'Notes', emotions: [], mistakes: [], isComplete: 'yes' }).success, false);
  });

  test('normalizes optional text and case-insensitive list duplicates', () => {
    const value = dailyReviewPayloadSchema.parse({
      content: ' Notes ', wentWell: '  ', improve: ' Improve ', nextSessionPlan: '',
      emotions: [' Focused ', '', 'focused', 'Calm'], mistakes: ['Moved stop', 'moved STOP'], isComplete: true,
    });
    assert.deepEqual(value, { content: 'Notes', wentWell: null, improve: 'Improve', nextSessionPlan: null, emotions: ['Focused', 'Calm'], mistakes: ['Moved stop'], isComplete: true });
  });

  test('enforces text, item length, and ten-item maxima', () => {
    const base = { content: 'Notes', emotions: [], mistakes: [], isComplete: false };
    assert.equal(dailyReviewPayloadSchema.safeParse({ ...base, content: ' ' }).success, false);
    assert.equal(dailyReviewPayloadSchema.safeParse({ ...base, emotions: Array.from({ length: 11 }, (_, i) => `e${i}`) }).success, false);
    assert.equal(dailyReviewPayloadSchema.safeParse({ ...base, mistakes: ['x'.repeat(49)] }).success, false);
  });
});

describe('Daily Review migration contract', () => {
  test('creates the one-to-one subtype and owned date uniqueness', () => {
    assert.match(migration, /CREATE TABLE IF NOT EXISTS daily_review_details/);
    assert.match(migration, /journal_entry_id\s+UUID PRIMARY KEY REFERENCES journal_entries\(id\) ON DELETE CASCADE/);
    assert.match(migration, /CONSTRAINT daily_review_details_user_date_unique UNIQUE \(user_id, review_date\)/);
  });

  test('enforces optional text, list cardinality, shared timestamp trigger, and linked context', () => {
    assert.match(migration, /went_well IS NULL OR btrim\(went_well\) <> ''/);
    assert.match(migration, /cardinality\(emotions\) <= 10/);
    assert.match(migration, /cardinality\(mistakes\) <= 10/);
    assert.match(migration, /EXECUTE FUNCTION update_updated_at_column\(\)/);
    assert.match(migration, /id = NEW\.journal_entry_id\s+AND user_id = NEW\.user_id/);
    assert.match(migration, /entry_type <> 'daily_review'/);
    assert.match(migration, /entry_date <> NEW\.review_date/);
  });

  test('is transactional, idempotent, non-destructive, and never alters Journal', () => {
    assert.match(migration, /^--[\s\S]*?BEGIN;/);
    assert.match(migration, /COMMIT;\s*$/);
    assert.doesNotMatch(migration, /\b(?:DELETE FROM|TRUNCATE|DROP TABLE|ALTER TABLE journal_entries)\b/i);
  });
});

describe('Daily Review owned persistence', () => {
  test('maps exact DATE strings and legacy entries to empty structured fields', () => {
    assert.deepEqual(mapDailyReview(row), {
      id: entryId, entryType: 'daily_review', entryDate: date, title: row.title, content: row.content,
      isComplete: false, createdAt: row.created_at, updatedAt: row.updated_at,
      wentWell: null, improve: null, nextSessionPlan: null, emotions: [], mistakes: [],
    });
  });

  test('GET scopes by user/date and rejects duplicate legacy entries', async () => {
    const calls = [];
    const queryable = { query: async (sql, params) => { calls.push({ sql, params }); return { rows: [row] }; } };
    const result = await getDailyReview(userId, date, 'Asia/Jerusalem', queryable);
    assert.equal(result.review.id, entryId);
    assert.match(calls[0].sql, /je\.user_id = \$1/);
    assert.deepEqual(calls[0].params, [userId, date]);
    await assert.rejects(() => getDailyReview(userId, date, 'UTC', { query: async () => ({ rows: [row, { ...row, id: '33333333-3333-4333-8333-333333333333' }] }) }), (error) => error.code === 'DAILY_REVIEW_DUPLICATE_ENTRIES' && error.statusCode === 409);
  });

  test('updates a legacy Journal entry and creates details atomically while preserving title', async () => {
    const calls = [];
    const client = { query: async (sql, params) => {
      calls.push({ sql, params });
      if (sql.includes('FROM journal_entries je')) return { rows: [row] };
      return { rows: [] };
    }, release() {} };
    pool.connect = async () => client;
    const result = await putDailyReview(userId, date, 'Asia/Jerusalem', { content: 'Updated', wentWell: 'Risk', improve: null, nextSessionPlan: 'Prepare', emotions: ['Focused'], mistakes: [], isComplete: true });
    assert.equal(result.review.id, entryId);
    assert.ok(calls.some((call) => /UPDATE journal_entries/.test(call.sql) && /WHERE id = \$1 AND user_id = \$2/.test(call.sql)));
    assert.ok(calls.some((call) => /INSERT INTO daily_review_details/.test(call.sql)));
    assert.equal(calls.some((call) => /SET title/.test(call.sql)), false);
    assert.equal(calls.at(-1).sql, 'COMMIT');
  });

  test('creates one Journal row when absent and rolls back detail failures', async () => {
    const calls = [];
    let readCount = 0;
    const client = { query: async (sql) => {
      calls.push(sql);
      if (sql.includes('FROM journal_entries je')) { readCount += 1; return { rows: readCount === 1 ? [] : [row] }; }
      if (sql.includes('INSERT INTO journal_entries')) return { rows: [{ id: entryId }] };
      if (sql.includes('INSERT INTO daily_review_details')) throw new Error('detail failed');
      return { rows: [] };
    }, release() {} };
    pool.connect = async () => client;
    await assert.rejects(() => putDailyReview(userId, date, 'UTC', { content: 'Notes', wentWell: null, improve: null, nextSessionPlan: null, emotions: [], mistakes: [], isComplete: false }), /detail failed/);
    assert.ok(calls.some((sql) => sql.includes('INSERT INTO journal_entries')));
    assert.equal(calls.at(-1), 'ROLLBACK');
    assert.equal(calls.includes('COMMIT'), false);
  });
});

describe('Daily Review day summary', () => {
  test('keeps owned entry-date boundaries and maps real closed/open metrics', async () => {
    let captured;
    const queryable = { query: async (sql, params) => {
      captured = { sql, params };
      return { rows: [{ closed_trades: 3, open_trades: 1, winners: 1, losers: 1, breakeven: 1, pnl_net: '75.5', total_fees: '8', best_trade: { id: entryId, symbol: 'NQ', pnlNet: 100, direction: 'long', accountId: null, entryDatetime: '2026-08-04T06:00:00Z', exitDatetime: '2026-08-04T06:10:00Z' }, worst_trade: null }] };
    } };
    const result = await getDaySummary(userId, date, 'Asia/Jerusalem', queryable);
    assert.match(captured.sql, /t\.user_id = \$1/);
    assert.match(captured.sql, /t\.entry_datetime >= \(\$2::date::timestamp AT TIME ZONE \$3\)/);
    assert.match(captured.sql, /t\.entry_datetime < \(\(\$4::date \+ 1\)::timestamp AT TIME ZONE \$3\)/);
    assert.deepEqual(captured.params, [userId, date, 'Asia/Jerusalem', date]);
    assert.deepEqual({ closed: result.closedTrades, open: result.openTrades, winners: result.winners, losers: result.losers, breakeven: result.breakeven, pnl: result.pnlNet, fees: result.totalFees, winRate: result.winRate }, { closed: 3, open: 1, winners: 1, losers: 1, breakeven: 1, pnl: 75.5, fees: 8, winRate: 33.33 });
  });

  test('returns unavailable PnL, rate, and identities with no closed trades', async () => {
    const result = await getDaySummary(userId, date, 'UTC', { query: async () => ({ rows: [{ closed_trades: 0, open_trades: 2, winners: 0, losers: 0, breakeven: 0, pnl_net: null, total_fees: 1, best_trade: null, worst_trade: null }] }) });
    assert.equal(result.pnlNet, null);
    assert.equal(result.winRate, null);
    assert.equal(result.bestTrade, null);
    assert.equal(result.worstTrade, null);
  });
});
