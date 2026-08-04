import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { afterEach, describe, test } from 'node:test';
import pool from '../db/client.js';
import {
  buildListQueryParts,
  createJournalEntry,
  deleteJournalEntry,
  getJournalCalendar,
  getJournalEntry,
  listJournalEntries,
  updateJournalEntry,
} from './journalService.js';
import {
  calendarSchema,
  createEntrySchema,
  listJournalSchema,
  updateEntrySchema,
} from '../routes/journal.js';

const originalQuery = pool.query;
const originalConnect = pool.connect;
const userId = '11111111-1111-4111-8111-111111111111';
const entryId = '22222222-2222-4222-8222-222222222222';
const tradeId = '33333333-3333-4333-8333-333333333333';
const otherTradeId = '44444444-4444-4444-8444-444444444444';
const migrationSql = readFileSync(new URL('../db/migrations/005_journal_entries.sql', import.meta.url), 'utf8');

const entryRow = {
  id: entryId,
  user_id: userId,
  entry_type: 'trade_review',
  entry_date: '2026-08-03',
  title: 'Review',
  content: 'Followed the plan.',
  tags: ['Process'],
  is_complete: false,
  created_at: '2026-08-03T10:00:00.000Z',
  updated_at: '2026-08-03T10:00:00.000Z',
};

afterEach(() => {
  pool.query = originalQuery;
  pool.connect = originalConnect;
});

describe('journal validation', () => {
  test('accepts only stable entry type keys', () => {
    for (const entryType of ['note', 'trade_review', 'daily_review', 'weekly_review']) {
      assert.equal(createEntrySchema.safeParse({ entryType, entryDate: '2026-08-03', title: 'T', content: 'C' }).success, true);
    }
    assert.equal(createEntrySchema.safeParse({ entryType: 'portfolio_review', entryDate: '2026-08-03', title: 'T', content: 'C' }).success, false);
  });

  test('requires strict real calendar dates', () => {
    const base = { entryType: 'note', title: 'T', content: 'C' };
    assert.equal(createEntrySchema.safeParse({ ...base, entryDate: '2026-02-29' }).success, false);
    assert.equal(createEntrySchema.safeParse({ ...base, entryDate: '2024-02-29' }).success, true);
    assert.equal(createEntrySchema.safeParse({ ...base, entryDate: '08/03/2026' }).success, false);
  });

  test('trims and validates title and content', () => {
    const parsed = createEntrySchema.parse({ entryType: 'note', entryDate: '2026-08-03', title: ' Title ', content: ' Body ' });
    assert.equal(parsed.title, 'Title');
    assert.equal(parsed.content, 'Body');
    assert.equal(createEntrySchema.safeParse({ entryType: 'note', entryDate: '2026-08-03', title: '  ', content: 'Body' }).success, false);
    assert.equal(createEntrySchema.safeParse({ entryType: 'note', entryDate: '2026-08-03', title: 'T', content: '  ' }).success, false);
  });

  test('normalizes blank and case-insensitive duplicate tags while preserving first casing', () => {
    const parsed = createEntrySchema.parse({
      entryType: 'note', entryDate: '2026-08-03', title: 'T', content: 'C',
      tags: [' Process ', '', 'process', 'Risk', 'RISK'],
    });
    assert.deepEqual(parsed.tags, ['Process', 'Risk']);
    assert.equal(createEntrySchema.safeParse({
      entryType: 'note', entryDate: '2026-08-03', title: 'T', content: 'C', tags: ['x'.repeat(33)],
    }).success, false);
    assert.equal(createEntrySchema.safeParse({
      entryType: 'note', entryDate: '2026-08-03', title: 'T', content: 'C',
      tags: Array.from({ length: 11 }, (_, index) => `tag-${index}`),
    }).success, false);
  });

  test('validates, deduplicates, and caps trade IDs', () => {
    const parsed = createEntrySchema.parse({
      entryType: 'note', entryDate: '2026-08-03', title: 'T', content: 'C', tradeIds: [tradeId, tradeId],
    });
    assert.deepEqual(parsed.tradeIds, [tradeId]);
    assert.equal(createEntrySchema.safeParse({ entryType: 'note', entryDate: '2026-08-03', title: 'T', content: 'C', tradeIds: ['bad'] }).success, false);
    const tooMany = Array.from({ length: 21 }, (_, index) => `00000000-0000-4000-8000-${String(index).padStart(12, '0')}`);
    assert.equal(createEntrySchema.safeParse({ entryType: 'note', entryDate: '2026-08-03', title: 'T', content: 'C', tradeIds: tooMany }).success, false);
  });

  test('rejects reversed ranges and invalid pagination while capping limit at 100', () => {
    assert.equal(listJournalSchema.safeParse({ from: '2026-08-04', to: '2026-08-03' }).success, false);
    assert.equal(listJournalSchema.safeParse({ page: 0 }).success, false);
    assert.equal(listJournalSchema.safeParse({ limit: 101 }).success, false);
    assert.deepEqual(listJournalSchema.parse({}), { status: 'all', page: 1, limit: 25 });
  });

  test('validates calendar months and non-empty patches', () => {
    assert.equal(calendarSchema.safeParse({ month: '2026-08' }).success, true);
    assert.equal(calendarSchema.safeParse({ month: '2026-13' }).success, false);
    assert.equal(updateEntrySchema.safeParse({}).success, false);
    assert.equal(updateEntrySchema.safeParse({ isComplete: false }).success, true);
  });
});

describe('journal migration integrity constraints', () => {
  test('protects blank titles at the database boundary', () => {
    assert.match(migrationSql, /CONSTRAINT journal_entries_title_not_blank\s+CHECK \(btrim\(title\) <> ''\)/);
  });

  test('protects blank content at the database boundary', () => {
    assert.match(migrationSql, /CONSTRAINT journal_entries_content_not_blank\s+CHECK \(btrim\(content\) <> ''\)/);
  });

  test('rejects more than 10 tags at the database boundary', () => {
    assert.match(migrationSql, /CONSTRAINT journal_entries_tags_max_10\s+CHECK \(cardinality\(tags\) <= 10\)/);
  });

  test('allows a valid same-user journal and trade link to return NEW', () => {
    assert.match(migrationSql, /je\.id = NEW\.journal_entry_id\s+AND je\.user_id = NEW\.user_id/);
    assert.match(migrationSql, /t\.id = NEW\.trade_id\s+AND t\.user_id = NEW\.user_id/);
    assert.match(migrationSql, /RETURN NEW;/);
  });

  test('rejects a journal entry owned by another user with an integrity error', () => {
    assert.match(migrationSql, /FROM journal_entries je[\s\S]*?IF NOT EXISTS|IF NOT EXISTS \([\s\S]*?FROM journal_entries je/);
    assert.match(migrationSql, /CONSTRAINT = 'journal_entry_trades_journal_entry_owner'/);
    assert.match(migrationSql, /ERRCODE = '23514'/);
  });

  test('rejects a trade owned by another user with an integrity error', () => {
    assert.match(migrationSql, /IF NOT EXISTS \([\s\S]*?FROM trades t[\s\S]*?t\.user_id = NEW\.user_id/);
    assert.match(migrationSql, /CONSTRAINT = 'journal_entry_trades_trade_owner'/);
    assert.match(migrationSql, /ERRCODE = '23514'/);
  });

  test('rejects updates that change a link to inconsistent ownership', () => {
    assert.match(migrationSql, /CREATE TRIGGER journal_entry_trades_validate_ownership\s+BEFORE INSERT OR UPDATE ON journal_entry_trades/);
    assert.match(migrationSql, /CREATE OR REPLACE FUNCTION validate_journal_entry_trade_ownership\(\)/);
  });

  test('keeps only the two composite user-leading link indexes', () => {
    assert.doesNotMatch(migrationSql, /CREATE INDEX IF NOT EXISTS idx_journal_entry_trades_user\s/);
    assert.match(migrationSql, /idx_journal_entry_trades_user_trade/);
    assert.match(migrationSql, /idx_journal_entry_trades_user_entry/);
  });
});

describe('journal query ownership and responses', () => {
  test('keeps search, type, status, and trade filters parameterized and user-scoped', () => {
    const result = buildListQueryParts(userId, {
      from: '2026-08-01', to: '2026-08-04', type: 'trade_review', status: 'complete',
      search: "plan%' OR TRUE --", tradeId,
    });
    assert.match(result.where, /je\.user_id = \$1/);
    assert.match(result.where, /je\.entry_type = \$4/);
    assert.match(result.where, /je\.is_complete = TRUE/);
    assert.match(result.where, /ILIKE \$5/);
    assert.match(result.where, /jet\.user_id = \$1/);
    assert.match(result.where, /jet\.trade_id = \$6/);
    assert.doesNotMatch(result.where, /OR TRUE/);
    assert.deepEqual(result.params, [userId, '2026-08-01', '2026-08-04', 'trade_review', "%plan%' OR TRUE --%", tradeId]);
  });

  test('lists with stable ordering, offset pagination, and one batch link query', async () => {
    const calls = [];
    pool.query = async (sql, params) => {
      calls.push({ sql, params });
      if (/COUNT\(\*\)/.test(sql)) return { rows: [{ count: '1' }] };
      if (/journal_entry_trades jet/.test(sql)) return { rows: [{
        journal_entry_id: entryId, id: tradeId, account_id: otherTradeId, symbol: 'ES',
        entry_datetime: '2026-08-03T09:00:00Z', exit_datetime: null, status: 'open', pnl_net: null,
      }] };
      return { rows: [entryRow] };
    };
    const result = await listJournalEntries(userId, { page: 2, limit: 10 });
    assert.equal(calls.length, 3);
    const listCall = calls.find(({ sql }) => /SELECT je\.\*/.test(sql));
    assert.match(listCall.sql, /ORDER BY je\.entry_date DESC, je\.created_at DESC, je\.id DESC/);
    assert.deepEqual(listCall.params, [userId, 10, 10]);
    assert.equal(result.entries[0].trades[0].symbol, 'ES');
    assert.deepEqual(result.pagination, { page: 2, limit: 10, total: 1, totalPages: 1 });
  });

  test('returns an empty list without a link hydration query', async () => {
    let calls = 0;
    pool.query = async (sql) => {
      calls += 1;
      return /COUNT/.test(sql) ? { rows: [{ count: '0' }] } : { rows: [] };
    };
    const result = await listJournalEntries(userId, {});
    assert.equal(calls, 2);
    assert.deepEqual(result.entries, []);
    assert.equal(result.pagination.total, 0);
  });

  test('gets only an owned entry and hydrates links', async () => {
    const calls = [];
    pool.query = async (sql, params) => {
      calls.push({ sql, params });
      return /FROM journal_entries WHERE/.test(sql) ? { rows: [entryRow] } : { rows: [] };
    };
    const result = await getJournalEntry(userId, entryId);
    assert.match(calls[0].sql, /id = \$1 AND user_id = \$2/);
    assert.deepEqual(calls[0].params, [entryId, userId]);
    assert.deepEqual(result.trades, []);
  });

  test('groups calendar summaries with real counts and owned month bounds', async () => {
    let captured;
    pool.query = async (sql, params) => {
      captured = { sql, params };
      return { rows: [{ date: '2026-08-03', total: 3, complete: 2, incomplete: 1, entry_types: ['note', 'trade_review'] }] };
    };
    const result = await getJournalCalendar(userId, '2026-08');
    assert.match(captured.sql, /WHERE user_id = \$1/);
    assert.match(captured.sql, /INTERVAL '1 month'/);
    assert.deepEqual(captured.params, [userId, '2026-08-01']);
    assert.deepEqual(result.days[0], { date: '2026-08-03', total: 3, complete: 2, incomplete: 1, entryTypes: ['note', 'trade_review'] });
  });

  test('deletes with entry and user ownership in the same statement', async () => {
    let captured;
    pool.query = async (sql, params) => { captured = { sql, params }; return { rows: [{ id: entryId }] }; };
    assert.deepEqual(await deleteJournalEntry(userId, entryId), { deleted: true, id: entryId });
    assert.match(captured.sql, /id = \$1 AND user_id = \$2/);
    assert.deepEqual(captured.params, [entryId, userId]);
  });
});

function transactionClient(handler) {
  const calls = [];
  let released = false;
  const client = {
    query: async (sql, params) => {
      calls.push({ sql, params });
      return handler(sql, params, calls);
    },
    release: () => { released = true; },
  };
  pool.connect = async () => client;
  return { calls, wasReleased: () => released };
}

describe('journal write transactions', () => {
  test('creates after verifying trade ownership and inserts links atomically', async () => {
    const tx = transactionClient(async (sql) => {
      if (/^BEGIN|^COMMIT/.test(sql)) return { rows: [] };
      if (/SELECT id FROM trades/.test(sql)) return { rows: [{ id: tradeId }] };
      if (/INSERT INTO journal_entries/.test(sql)) return { rows: [entryRow] };
      if (/FROM journal_entry_trades jet/.test(sql)) return { rows: [] };
      return { rows: [] };
    });
    const result = await createJournalEntry(userId, {
      entryType: 'trade_review', entryDate: '2026-08-03', title: 'Review', content: 'Followed the plan.',
      tags: ['Process'], isComplete: false, tradeIds: [tradeId],
    });
    assert.equal(result.id, entryId);
    assert.ok(tx.calls.find(({ sql, params }) => /SELECT id FROM trades/.test(sql) && params[0] === userId));
    assert.ok(tx.calls.find(({ sql }) => /INSERT INTO journal_entry_trades/.test(sql)));
    assert.equal(tx.calls.at(-1).sql, 'COMMIT');
    assert.equal(tx.wasReleased(), true);
  });

  test('rejects a foreign trade and rolls creation back', async () => {
    const tx = transactionClient(async (sql) => {
      if (/SELECT id FROM trades/.test(sql)) return { rows: [] };
      return { rows: [] };
    });
    await assert.rejects(
      () => createJournalEntry(userId, {
        entryType: 'note', entryDate: '2026-08-03', title: 'T', content: 'C', tags: [], isComplete: false, tradeIds: [tradeId],
      }),
      (error) => error.code === 'INVALID_TRADE_LINK',
    );
    assert.equal(tx.calls.at(-1).sql, 'ROLLBACK');
    assert.equal(tx.wasReleased(), true);
  });

  test('rolls back when creation fails after ownership verification', async () => {
    const tx = transactionClient(async (sql) => {
      if (/SELECT id FROM trades/.test(sql)) return { rows: [{ id: tradeId }] };
      if (/INSERT INTO journal_entries/.test(sql)) throw new Error('write failed');
      return { rows: [] };
    });
    await assert.rejects(() => createJournalEntry(userId, {
      entryType: 'note', entryDate: '2026-08-03', title: 'T', content: 'C', tags: [], isComplete: false, tradeIds: [tradeId],
    }), /write failed/);
    assert.equal(tx.calls.at(-1).sql, 'ROLLBACK');
  });

  test('updates an owned row and replaces owned links in one transaction', async () => {
    const tx = transactionClient(async (sql) => {
      if (/FOR UPDATE/.test(sql)) return { rows: [entryRow] };
      if (/SELECT id FROM trades/.test(sql)) return { rows: [{ id: otherTradeId }] };
      if (/UPDATE journal_entries/.test(sql)) return { rows: [{ ...entryRow, title: 'Updated', is_complete: true }] };
      if (/FROM journal_entry_trades jet/.test(sql)) return { rows: [] };
      return { rows: [] };
    });
    const result = await updateJournalEntry(userId, entryId, { title: 'Updated', isComplete: true, tradeIds: [otherTradeId] });
    assert.equal(result.title, 'Updated');
    assert.equal(result.isComplete, true);
    assert.ok(tx.calls.find(({ sql, params }) => /DELETE FROM journal_entry_trades/.test(sql) && params[1] === userId));
    assert.ok(tx.calls.find(({ sql }) => /INSERT INTO journal_entry_trades/.test(sql)));
    assert.equal(tx.calls.at(-1).sql, 'COMMIT');
  });

  test('does not replace links when a patch omits trade IDs', async () => {
    const tx = transactionClient(async (sql) => {
      if (/FOR UPDATE/.test(sql)) return { rows: [entryRow] };
      if (/UPDATE journal_entries/.test(sql)) return { rows: [{ ...entryRow, title: 'Updated' }] };
      if (/FROM journal_entry_trades jet/.test(sql)) return { rows: [] };
      return { rows: [] };
    });
    await updateJournalEntry(userId, entryId, { title: 'Updated' });
    assert.equal(tx.calls.some(({ sql }) => /DELETE FROM journal_entry_trades/.test(sql)), false);
    assert.equal(tx.calls.at(-1).sql, 'COMMIT');
  });
});
