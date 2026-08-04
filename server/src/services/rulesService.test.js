import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { afterEach, describe, test } from 'node:test';
import pool, { parsePostgresDate } from '../db/client.js';
import {
  buildAdherenceQueryParts,
  buildChecksQueryParts,
  buildRulesListQueryParts,
  calculateAdherenceRate,
  createRuleCheck,
  deleteRule,
  deleteRuleCheck,
  getAdherence,
  getRule,
  listRuleChecks,
  listRules,
  updateRule,
  updateRuleCheck,
} from './rulesService.js';
import {
  adherenceSchema,
  createCheckSchema,
  createRuleSchema,
  listChecksSchema,
  listRulesSchema,
  updateCheckSchema,
  updateRuleSchema,
} from '../routes/rules.js';

const originalQuery = pool.query;
const originalConnect = pool.connect;
const userId = '11111111-1111-4111-8111-111111111111';
const ruleId = '22222222-2222-4222-8222-222222222222';
const checkId = '33333333-3333-4333-8333-333333333333';
const tradeId = '44444444-4444-4444-8444-444444444444';
const entryId = '55555555-5555-4555-8555-555555555555';
const migrationSql = readFileSync(new URL('../db/migrations/006_rules_adherence.sql', import.meta.url), 'utf8');

const ruleRow = {
  id: ruleId, user_id: userId, name: 'Wait for confirmation', description: null,
  scope: 'trade', is_active: true, sort_order: 0,
  created_at: '2026-08-01T10:00:00Z', updated_at: '2026-08-01T10:00:00Z', check_count: 2,
};
const checkRow = {
  id: checkId, user_id: userId, rule_id: ruleId, check_date: parsePostgresDate('2026-08-03'), outcome: 'followed', notes: 'Patient entry.',
  trade_id: tradeId, journal_entry_id: entryId, created_at: '2026-08-03T10:00:00Z', updated_at: '2026-08-03T10:00:00Z',
  rule_name: ruleRow.name, rule_scope: 'trade', rule_is_active: true,
  trade_symbol: 'ES', trade_entry_datetime: '2026-08-03T09:00:00Z', trade_exit_datetime: null,
  trade_status: 'open', trade_pnl_net: null, account_id: '66666666-6666-4666-8666-666666666666',
  account_name: 'Primary', account_company: 'broker', account_number: 'A1',
  journal_entry_type: 'trade_review', journal_entry_date: parsePostgresDate('2026-08-03'), journal_entry_title: 'Review', journal_entry_is_complete: true,
};

afterEach(() => {
  pool.query = originalQuery;
  pool.connect = originalConnect;
});

describe('rules validation', () => {
  test('whitelists rule scopes and outcomes', () => {
    for (const scope of ['trade', 'daily', 'general']) {
      assert.equal(createRuleSchema.safeParse({ name: 'Rule', scope }).success, true);
    }
    assert.equal(createRuleSchema.safeParse({ name: 'Rule', scope: 'portfolio' }).success, false);
    for (const outcome of ['followed', 'broken', 'not_applicable']) {
      assert.equal(createCheckSchema.safeParse({ ruleId, checkDate: '2026-08-03', outcome }).success, true);
    }
    assert.equal(createCheckSchema.safeParse({ ruleId, checkDate: '2026-08-03', outcome: 'skipped' }).success, false);
  });

  test('requires strict real dates', () => {
    const base = { ruleId, outcome: 'followed' };
    assert.equal(createCheckSchema.safeParse({ ...base, checkDate: '2026-02-29' }).success, false);
    assert.equal(createCheckSchema.safeParse({ ...base, checkDate: '2024-02-29' }).success, true);
    assert.equal(createCheckSchema.safeParse({ ...base, checkDate: '08/03/2026' }).success, false);
  });

  test('trims names and normalizes optional blank text', () => {
    const rule = createRuleSchema.parse({ name: '  Rule  ', description: ' ', scope: 'trade' });
    assert.equal(rule.name, 'Rule');
    assert.equal(rule.description, null);
    const check = createCheckSchema.parse({ ruleId, checkDate: '2026-08-03', outcome: 'broken', notes: ' ' });
    assert.equal(check.notes, null);
    assert.equal(createRuleSchema.safeParse({ name: ' ', scope: 'trade' }).success, false);
    assert.equal(createRuleSchema.safeParse({ name: 'x'.repeat(121), scope: 'trade' }).success, false);
  });

  test('validates UUIDs, sort bounds, booleans, and non-empty patches', () => {
    assert.equal(createCheckSchema.safeParse({ ruleId: 'bad', checkDate: '2026-08-03', outcome: 'followed' }).success, false);
    assert.equal(createRuleSchema.safeParse({ name: 'R', scope: 'daily', sortOrder: -1 }).success, false);
    assert.equal(createRuleSchema.safeParse({ name: 'R', scope: 'daily', isActive: 'true' }).success, false);
    assert.equal(updateRuleSchema.safeParse({}).success, false);
    assert.equal(updateCheckSchema.safeParse({}).success, false);
    assert.equal(updateRuleSchema.safeParse({ isActive: false }).success, true);
  });

  test('rejects reversed ranges and invalid pagination', () => {
    assert.equal(adherenceSchema.safeParse({ from: '2026-08-04', to: '2026-08-03' }).success, false);
    assert.equal(listChecksSchema.safeParse({ from: '2026-08-04', to: '2026-08-03' }).success, false);
    assert.equal(listChecksSchema.safeParse({ page: 0 }).success, false);
    assert.equal(listChecksSchema.safeParse({ limit: 101 }).success, false);
    assert.deepEqual(listChecksSchema.parse({}), { page: 1, limit: 25 });
  });

  test('defaults rule listing to active and caps search', () => {
    assert.deepEqual(listRulesSchema.parse({}), { status: 'active' });
    assert.equal(listRulesSchema.safeParse({ status: 'all' }).success, true);
    assert.equal(listRulesSchema.safeParse({ search: 'x'.repeat(101) }).success, false);
  });
});

describe('rules migration contract', () => {
  test('defines named nonblank and stable enum constraints', () => {
    assert.match(migrationSql, /CONSTRAINT trading_rules_name_not_blank[\s\S]*?btrim\(name\) <> ''/);
    assert.match(migrationSql, /trading_rules_description_not_blank[\s\S]*?description IS NULL OR btrim\(description\) <> ''/);
    assert.match(migrationSql, /trading_rules_scope_valid[\s\S]*?'trade'[\s\S]*?'daily'[\s\S]*?'general'/);
    assert.match(migrationSql, /rule_checks_outcome_valid[\s\S]*?'followed'[\s\S]*?'broken'[\s\S]*?'not_applicable'/);
  });

  test('preserves user cascades, rule history, and nullable context links', () => {
    assert.match(migrationSql, /CREATE TABLE IF NOT EXISTS trading_rules[\s\S]*?user_id\s+UUID NOT NULL REFERENCES users\(id\) ON DELETE CASCADE/);
    assert.match(migrationSql, /CREATE TABLE IF NOT EXISTS rule_checks[\s\S]*?user_id\s+UUID NOT NULL REFERENCES users\(id\) ON DELETE CASCADE/);
    assert.match(migrationSql, /rule_id\s+UUID NOT NULL REFERENCES trading_rules\(id\) ON DELETE NO ACTION/);
    assert.doesNotMatch(migrationSql, /rule_id\s+UUID NOT NULL REFERENCES trading_rules\(id\) ON DELETE (?:CASCADE|RESTRICT)/);
    assert.match(migrationSql, /trade_id\s+UUID REFERENCES trades\(id\) ON DELETE SET NULL/);
    assert.match(migrationSql, /journal_entry_id UUID REFERENCES journal_entries\(id\) ON DELETE SET NULL/);
  });

  test('enforces all linked ownership on insert and update', () => {
    assert.match(migrationSql, /r\.id = NEW\.rule_id[\s\S]*?r\.user_id = NEW\.user_id/);
    assert.match(migrationSql, /t\.id = NEW\.trade_id[\s\S]*?t\.user_id = NEW\.user_id/);
    assert.match(migrationSql, /je\.id = NEW\.journal_entry_id[\s\S]*?je\.user_id = NEW\.user_id/);
    assert.match(migrationSql, /BEFORE INSERT OR UPDATE ON rule_checks/);
    assert.match(migrationSql, /ERRCODE = '23514'/);
    assert.match(migrationSql, /RETURN NEW;/);
  });

  test('is transactional, idempotent, and non-destructive', () => {
    assert.match(migrationSql, /^--[\s\S]*?BEGIN;/);
    assert.match(migrationSql, /CREATE TABLE IF NOT EXISTS trading_rules/);
    assert.match(migrationSql, /CREATE TABLE IF NOT EXISTS rule_checks/);
    assert.match(migrationSql, /COMMIT;\s*$/);
    assert.doesNotMatch(migrationSql, /\b(DROP|TRUNCATE|ALTER TABLE trades|ALTER TABLE journal_entries|DELETE FROM)\b/i);
    assert.doesNotMatch(migrationSql, /CREATE OR REPLACE FUNCTION update_updated_at_column/);
  });

  test('uses user-leading access-path indexes without a standalone user index', () => {
    assert.match(migrationSql, /idx_trading_rules_user_active_order/);
    assert.match(migrationSql, /idx_rule_checks_user_rule_date/);
    assert.match(migrationSql, /idx_rule_checks_user_trade[\s\S]*?WHERE trade_id IS NOT NULL/);
    assert.doesNotMatch(migrationSql, /CREATE INDEX IF NOT EXISTS idx_rule_checks_user\s/);
  });
});

describe('parameterized ownership filters and adherence', () => {
  test('keeps rule search and status user-scoped and parameterized', () => {
    const result = buildRulesListQueryParts(userId, { status: 'all', scope: 'trade', search: "x%' OR TRUE --" });
    assert.match(result.where, /r\.user_id = \$1/);
    assert.match(result.where, /r\.scope = \$2/);
    assert.match(result.where, /ILIKE \$3/);
    assert.doesNotMatch(result.where, /OR TRUE/);
    assert.deepEqual(result.params, [userId, 'trade', "%x%' OR TRUE --%"]);
  });

  test('keeps adherence date, scope, and rule filters in owned query parts', () => {
    const result = buildAdherenceQueryParts(userId, { from: '2026-08-01', to: '2026-08-04', scope: 'daily', ruleId });
    assert.match(result.join, /rc\.user_id = \$1/);
    assert.match(result.join, /check_date >= \$2/);
    assert.match(result.where, /r\.user_id = \$1/);
    assert.match(result.where, /r\.scope = \$4/);
    assert.deepEqual(result.params, [userId, '2026-08-01', '2026-08-04', 'daily', ruleId]);
  });

  test('calculates followed plus broken denominator with stable rounding', () => {
    assert.equal(calculateAdherenceRate(2, 3), 66.7);
    assert.equal(calculateAdherenceRate(1, 6), 16.7);
    assert.equal(calculateAdherenceRate(0, 0), null);
  });

  test('returns summary counts, excludes not-applicable, and retains inactive history', async () => {
    let captured;
    pool.query = async (sql, params) => {
      captured = { sql, params };
      return { rows: [
        { ...ruleRow, total_checks: 3, followed: 2, broken: 0, not_applicable: 1, last_check_date: '2026-08-03' },
        { ...ruleRow, id: '77777777-7777-4777-8777-777777777777', name: 'Old', is_active: false, total_checks: 1, followed: 0, broken: 1, not_applicable: 0, last_check_date: '2026-08-02' },
      ] };
    };
    const result = await getAdherence(userId, { from: '2026-08-01' });
    assert.match(captured.sql, /HAVING r\.is_active = TRUE OR COUNT\(rc\.id\) > 0/);
    assert.deepEqual(result.summary, { activeRules: 1, totalChecks: 4, eligibleChecks: 3, followed: 2, broken: 1, notApplicable: 1, adherenceRate: 66.7 });
    assert.equal(result.rules[1].isActive, false);
  });

  test('returns null adherence and zero counts for an empty result', async () => {
    pool.query = async () => ({ rows: [] });
    const result = await getAdherence(userId, {});
    assert.deepEqual(result.summary, { activeRules: 0, totalChecks: 0, eligibleChecks: 0, followed: 0, broken: 0, notApplicable: 0, adherenceRate: null });
    assert.deepEqual(result.rules, []);
  });
});

describe('rules and checks persistence', () => {
  test('lists rules with one aggregate query and stable ordering', async () => {
    let captured;
    pool.query = async (sql, params) => { captured = { sql, params }; return { rows: [ruleRow] }; };
    const result = await listRules(userId, { status: 'all' });
    assert.match(captured.sql, /COUNT\(rc\.id\)/);
    assert.match(captured.sql, /r\.sort_order ASC, r\.created_at ASC, r\.id ASC/);
    assert.deepEqual(captured.params, [userId]);
    assert.equal(result.rules[0].checkCount, 2);
  });

  test('gets and updates only an owned rule', async () => {
    const calls = [];
    pool.query = async (sql, params) => {
      calls.push({ sql, params });
      return /UPDATE/.test(sql) ? { rows: [{ ...ruleRow, is_active: false }] } : { rows: [{ ...ruleRow, followed: 1, broken: 1, not_applicable: 0, last_check_date: '2026-08-03' }] };
    };
    const detail = await getRule(userId, ruleId);
    assert.match(calls[0].sql, /r\.id = \$1 AND r\.user_id = \$2/);
    assert.equal(detail.rule.summary.adherenceRate, 50);
    const updated = await updateRule(userId, ruleId, { isActive: false });
    assert.match(calls[1].sql, /WHERE id = \$1 AND user_id = \$2/);
    assert.equal(updated.rule.isActive, false);
  });

  test('prevents deleting a rule with checks and preserves it', async () => {
    let calls = 0;
    pool.query = async () => { calls += 1; return { rows: [{ id: ruleId, check_count: 1 }] }; };
    await assert.rejects(() => deleteRule(userId, ruleId), (error) => error.code === 'RULE_HAS_CHECKS' && error.statusCode === 409);
    assert.equal(calls, 1);
  });

  test('deletes an owned rule without checks', async () => {
    const calls = [];
    pool.query = async (sql, params) => {
      calls.push({ sql, params });
      return /SELECT/.test(sql) ? { rows: [{ id: ruleId, check_count: 0 }] } : { rows: [] };
    };
    assert.deepEqual(await deleteRule(userId, ruleId), { deleted: true, id: ruleId });
    assert.match(calls[1].sql, /id = \$1 AND user_id = \$2/);
  });

  test('keeps every check filter parameterized and user-scoped', () => {
    const filters = { from: '2026-08-01', to: '2026-08-04', ruleId, outcome: 'broken', tradeId, journalEntryId: entryId };
    const result = buildChecksQueryParts(userId, filters);
    assert.match(result.where, /^rc\.user_id = \$1/);
    assert.match(result.where, /rc\.journal_entry_id = \$7/);
    assert.deepEqual(result.params, [userId, '2026-08-01', '2026-08-04', ruleId, 'broken', tradeId, entryId]);
  });

  test('lists checks with stable pagination and one joined hydration query', async () => {
    const calls = [];
    pool.query = async (sql, params) => {
      calls.push({ sql, params });
      return /COUNT\(\*\)/.test(sql) ? { rows: [{ count: 1 }] } : { rows: [checkRow] };
    };
    const result = await listRuleChecks(userId, { page: 2, limit: 10 });
    assert.equal(calls.length, 2);
    assert.match(calls[0].sql, /LEFT JOIN trades/);
    assert.match(calls[0].sql, /LEFT JOIN journal_entries/);
    assert.match(calls[0].sql, /ORDER BY rc\.check_date DESC, rc\.created_at DESC, rc\.id DESC/);
    assert.deepEqual(calls[0].params, [userId, 10, 10]);
    assert.equal(result.checks[0].checkDate, '2026-08-03');
    assert.equal(result.checks[0].trade.symbol, 'ES');
    assert.equal(result.checks[0].journalEntry.entryDate, '2026-08-03');
    assert.equal(result.checks[0].journalEntry.title, 'Review');
    assert.deepEqual(result.pagination, { page: 2, limit: 10, total: 1, totalPages: 1 });
  });

  test('deletes only an owned check', async () => {
    let captured;
    pool.query = async (sql, params) => { captured = { sql, params }; return { rows: [{ id: checkId }] }; };
    assert.deepEqual(await deleteRuleCheck(userId, checkId), { deleted: true, id: checkId });
    assert.match(captured.sql, /id = \$1 AND user_id = \$2/);
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

describe('rule check write transactions and ownership', () => {
  test('creates after verifying same-user rule, trade, and Journal links', async () => {
    const tx = transactionClient(async (sql) => {
      if (/SELECT id FROM (trading_rules|trades|journal_entries)/.test(sql)) return { rows: [{ id: 'owned' }] };
      if (/INSERT INTO rule_checks/.test(sql)) return { rows: [{ id: checkId }] };
      if (/FROM rule_checks rc/.test(sql)) return { rows: [checkRow] };
      return { rows: [] };
    });
    const result = await createRuleCheck(userId, { ruleId, checkDate: '2026-08-03', outcome: 'followed', notes: null, tradeId, journalEntryId: entryId });
    assert.equal(result.check.id, checkId);
    assert.equal(tx.calls.filter(({ sql }) => /SELECT id FROM/.test(sql)).length, 3);
    assert.equal(tx.calls.at(-1).sql, 'COMMIT');
    assert.equal(tx.wasReleased(), true);
  });

  test('rejects a foreign rule and rolls creation back', async () => {
    const tx = transactionClient(async (sql) => /SELECT id FROM trading_rules/.test(sql) ? { rows: [] } : { rows: [] });
    await assert.rejects(
      () => createRuleCheck(userId, { ruleId, checkDate: '2026-08-03', outcome: 'followed', notes: null, tradeId: null, journalEntryId: null }),
      (error) => error.code === 'INVALID_RULE_LINK',
    );
    assert.equal(tx.calls.at(-1).sql, 'ROLLBACK');
  });

  test('rejects a foreign trade and rolls creation back', async () => {
    const tx = transactionClient(async (sql) => {
      if (/trading_rules/.test(sql)) return { rows: [{ id: ruleId }] };
      if (/SELECT id FROM trades/.test(sql)) return { rows: [] };
      return { rows: [] };
    });
    await assert.rejects(
      () => createRuleCheck(userId, { ruleId, checkDate: '2026-08-03', outcome: 'followed', notes: null, tradeId, journalEntryId: null }),
      (error) => error.code === 'INVALID_TRADE_LINK',
    );
    assert.equal(tx.calls.at(-1).sql, 'ROLLBACK');
  });

  test('rejects a foreign Journal entry and rolls creation back', async () => {
    const tx = transactionClient(async (sql) => {
      if (/trading_rules/.test(sql)) return { rows: [{ id: ruleId }] };
      if (/journal_entries/.test(sql)) return { rows: [] };
      return { rows: [] };
    });
    await assert.rejects(
      () => createRuleCheck(userId, { ruleId, checkDate: '2026-08-03', outcome: 'followed', notes: null, tradeId: null, journalEntryId: entryId }),
      (error) => error.code === 'INVALID_JOURNAL_LINK',
    );
    assert.equal(tx.calls.at(-1).sql, 'ROLLBACK');
  });

  test('rolls back when a check insert fails', async () => {
    const tx = transactionClient(async (sql) => {
      if (/trading_rules/.test(sql)) return { rows: [{ id: ruleId }] };
      if (/INSERT INTO rule_checks/.test(sql)) throw new Error('write failed');
      return { rows: [] };
    });
    await assert.rejects(
      () => createRuleCheck(userId, { ruleId, checkDate: '2026-08-03', outcome: 'followed', notes: null, tradeId: null, journalEntryId: null }),
      /write failed/,
    );
    assert.equal(tx.calls.at(-1).sql, 'ROLLBACK');
  });

  test('updates an owned check atomically and permits clearing links', async () => {
    const tx = transactionClient(async (sql) => {
      if (/FOR UPDATE/.test(sql)) return { rows: [checkRow] };
      if (/SELECT id FROM trading_rules/.test(sql)) return { rows: [{ id: ruleId }] };
      if (/FROM rule_checks rc/.test(sql)) return { rows: [{ ...checkRow, trade_id: null, journal_entry_id: null, outcome: 'broken' }] };
      return { rows: [] };
    });
    const result = await updateRuleCheck(userId, checkId, { outcome: 'broken', tradeId: null, journalEntryId: null });
    const update = tx.calls.find(({ sql }) => /UPDATE rule_checks/.test(sql));
    assert.equal(update.params[6], null);
    assert.equal(update.params[7], null);
    assert.equal(result.check.outcome, 'broken');
    assert.equal(tx.calls.at(-1).sql, 'COMMIT');
  });

  test('rolls an update back when the owned check is missing', async () => {
    const tx = transactionClient(async () => ({ rows: [] }));
    await assert.rejects(() => updateRuleCheck(userId, checkId, { outcome: 'broken' }), (error) => error.code === 'RULE_CHECK_NOT_FOUND');
    assert.equal(tx.calls.at(-1).sql, 'ROLLBACK');
  });
});
