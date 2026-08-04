import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { afterEach, describe, test } from 'node:test';
import pool from '../db/client.js';
import {
  buildGoalsListQueryParts,
  calculateGoalProgress,
  computeProgressForGoals,
  createGoal,
  deleteGoal,
  deriveGoalState,
  getGoal,
  listGoals,
  queryJournalGoalMetrics,
  queryRulesGoalMetrics,
  queryTradeGoalMetrics,
  updateGoal,
  validateGoalDefinition,
} from './goalsService.js';
import { createGoalSchema, goalIdSchema, listGoalsSchema, updateGoalSchema } from '../routes/goals.js';

const originalQuery = pool.query;
const userId = '11111111-1111-4111-8111-111111111111';
const goalId = '22222222-2222-4222-8222-222222222222';
const otherGoalId = '33333333-3333-4333-8333-333333333333';
const migrationSql = readFileSync(new URL('../db/migrations/007_goals.sql', import.meta.url), 'utf8');

const goalRow = {
  id: goalId,
  user_id: userId,
  name: 'Reach target',
  description: null,
  metric_key: 'net_pnl',
  comparison: 'at_least',
  target_value: '1000.0000',
  start_date: '2026-08-01',
  end_date: '2026-08-31',
  status: 'active',
  created_at: '2026-08-01T00:00:00Z',
  updated_at: '2026-08-01T00:00:00Z',
};
const goal = {
  id: goalId,
  name: 'Reach target',
  description: null,
  metricKey: 'net_pnl',
  comparison: 'at_least',
  targetValue: 1000,
  startDate: '2026-08-01',
  endDate: '2026-08-31',
  status: 'active',
};

afterEach(() => { pool.query = originalQuery; });

function createPayload(overrides = {}) {
  return {
    name: 'Goal', description: null, metricKey: 'net_pnl', comparison: 'at_least', targetValue: 1000,
    startDate: '2026-08-01', endDate: '2026-08-31', status: 'active', ...overrides,
  };
}

describe('goals validation', () => {
  test('whitelists all seven metrics and rejects unknown metrics', () => {
    const metrics = ['net_pnl', 'closed_trades', 'win_rate', 'average_r', 'rule_adherence', 'journal_entries', 'broken_rule_checks'];
    metrics.forEach((metricKey) => {
      const comparison = metricKey === 'broken_rule_checks' ? 'at_most' : 'at_least';
      assert.equal(createGoalSchema.safeParse(createPayload({ metricKey, comparison, targetValue: metricKey === 'average_r' ? 1 : 10 })).success, true);
    });
    assert.equal(createGoalSchema.safeParse(createPayload({ metricKey: 'portfolio_value' })).success, false);
  });

  test('enforces comparison whitelist and metric mapping without coercion', () => {
    assert.equal(createGoalSchema.safeParse(createPayload({ comparison: 'greater_than' })).success, false);
    assert.equal(createGoalSchema.safeParse(createPayload({ metricKey: 'broken_rule_checks', comparison: 'at_least' })).success, false);
    assert.equal(createGoalSchema.safeParse(createPayload({ metricKey: 'win_rate', comparison: 'at_most' })).success, false);
    assert.deepEqual(validateGoalDefinition(createPayload({ metricKey: 'broken_rule_checks', comparison: 'at_least' })).field, 'comparison');
  });

  test('trims names, rejects blank or long names, and normalizes blank descriptions', () => {
    const parsed = createGoalSchema.parse(createPayload({ name: '  Consistency  ', description: '  ' }));
    assert.equal(parsed.name, 'Consistency');
    assert.equal(parsed.description, null);
    assert.equal(createGoalSchema.safeParse(createPayload({ name: ' ' })).success, false);
    assert.equal(createGoalSchema.safeParse(createPayload({ name: 'x'.repeat(121) })).success, false);
    assert.equal(createGoalSchema.safeParse(createPayload({ description: 'x'.repeat(1001) })).success, false);
  });

  test('whitelists lifecycle status and validates non-empty partial updates', () => {
    ['active', 'paused', 'archived'].forEach((status) => assert.equal(createGoalSchema.safeParse(createPayload({ status })).success, true));
    assert.equal(createGoalSchema.safeParse(createPayload({ status: 'achieved' })).success, false);
    assert.equal(updateGoalSchema.safeParse({}).success, false);
    assert.equal(updateGoalSchema.safeParse({ status: 'paused' }).success, true);
  });

  test('requires strict real dates and rejects reversed ranges', () => {
    assert.equal(createGoalSchema.safeParse(createPayload({ startDate: '2026-02-29' })).success, false);
    assert.equal(createGoalSchema.safeParse(createPayload({ startDate: '2024-02-29' })).success, true);
    assert.equal(createGoalSchema.safeParse(createPayload({ startDate: '08/01/2026' })).success, false);
    assert.equal(createGoalSchema.safeParse(createPayload({ startDate: '2026-09-01', endDate: '2026-08-31' })).success, false);
  });

  test('enforces whole nonnegative count targets', () => {
    for (const metricKey of ['closed_trades', 'journal_entries', 'broken_rule_checks']) {
      const comparison = metricKey === 'broken_rule_checks' ? 'at_most' : 'at_least';
      assert.equal(createGoalSchema.safeParse(createPayload({ metricKey, comparison, targetValue: 2.5 })).success, false);
      assert.equal(createGoalSchema.safeParse(createPayload({ metricKey, comparison, targetValue: -1 })).success, false);
      assert.equal(createGoalSchema.safeParse(createPayload({ metricKey, comparison, targetValue: 2 })).success, true);
    }
  });

  test('enforces percentage, R, and currency bounds and finite numbers', () => {
    ['win_rate', 'rule_adherence'].forEach((metricKey) => {
      assert.equal(createGoalSchema.safeParse(createPayload({ metricKey, targetValue: -0.1 })).success, false);
      assert.equal(createGoalSchema.safeParse(createPayload({ metricKey, targetValue: 100.1 })).success, false);
    });
    assert.equal(createGoalSchema.safeParse(createPayload({ metricKey: 'average_r', targetValue: 1001 })).success, false);
    assert.equal(createGoalSchema.safeParse(createPayload({ metricKey: 'net_pnl', targetValue: 1000000001 })).success, false);
    assert.equal(createGoalSchema.safeParse(createPayload({ targetValue: Infinity })).success, false);
  });

  test('validates route IDs, filters, and search length', () => {
    assert.equal(goalIdSchema.safeParse(goalId).success, true);
    assert.equal(goalIdSchema.safeParse('bad').success, false);
    assert.deepEqual(listGoalsSchema.parse({}), { status: 'all' });
    assert.equal(listGoalsSchema.safeParse({ status: 'paused', metric: 'average_r' }).success, true);
    assert.equal(listGoalsSchema.safeParse({ search: 'x'.repeat(101) }).success, false);
  });
});

describe('goals migration contract', () => {
  test('defines the exact metric, comparison, status, and mapping constraints', () => {
    assert.match(migrationSql, /CONSTRAINT goals_metric_valid[\s\S]*?'net_pnl'[\s\S]*?'closed_trades'[\s\S]*?'win_rate'[\s\S]*?'average_r'[\s\S]*?'rule_adherence'[\s\S]*?'journal_entries'[\s\S]*?'broken_rule_checks'/);
    assert.match(migrationSql, /CONSTRAINT goals_comparison_valid[\s\S]*?'at_least'[\s\S]*?'at_most'/);
    assert.match(migrationSql, /CONSTRAINT goals_status_valid[\s\S]*?'active'[\s\S]*?'paused'[\s\S]*?'archived'/);
    assert.match(migrationSql, /goals_metric_comparison_valid[\s\S]*?broken_rule_checks[\s\S]*?at_most[\s\S]*?metric_key <> 'broken_rule_checks'[\s\S]*?at_least/);
  });

  test('enforces dates, nonblank text, and metric-specific target bounds', () => {
    assert.match(migrationSql, /goals_name_not_blank[\s\S]*?btrim\(name\) <> ''/);
    assert.match(migrationSql, /goals_description_not_blank[\s\S]*?description IS NULL OR btrim\(description\) <> ''/);
    assert.match(migrationSql, /goals_date_range_valid[\s\S]*?end_date >= start_date/);
    for (const constraint of ['goals_target_value_safe', 'goals_count_target_valid', 'goals_percentage_target_valid', 'goals_average_r_target_valid', 'goals_net_pnl_target_valid']) {
      assert.match(migrationSql, new RegExp(`CONSTRAINT ${constraint}`));
    }
    assert.match(migrationSql, /target_value = trunc\(target_value\)/);
  });

  test('uses a cascading user FK, the shared trigger, and user-leading indexes', () => {
    assert.match(migrationSql, /user_id\s+UUID NOT NULL REFERENCES users\(id\) ON DELETE CASCADE/);
    assert.match(migrationSql, /CREATE TRIGGER goals_updated_at[\s\S]*?EXECUTE FUNCTION update_updated_at_column\(\)/);
    assert.doesNotMatch(migrationSql, /CREATE OR REPLACE FUNCTION update_updated_at_column/);
    assert.match(migrationSql, /idx_goals_user_status_end_date[\s\S]*?goals\(user_id, status, end_date\)/);
    assert.match(migrationSql, /idx_goals_user_metric_dates[\s\S]*?goals\(user_id, metric_key, start_date, end_date\)/);
    assert.match(migrationSql, /idx_goals_user_lower_name[\s\S]*?goals\(user_id, lower\(name\)\)/);
    assert.doesNotMatch(migrationSql, /CREATE INDEX IF NOT EXISTS idx_goals_user\s/);
  });

  test('is transactional, idempotent, isolated, and non-destructive', () => {
    assert.match(migrationSql, /^--[\s\S]*?BEGIN;/);
    assert.match(migrationSql, /CREATE TABLE IF NOT EXISTS goals/);
    assert.match(migrationSql, /COMMIT;\s*$/);
    assert.doesNotMatch(migrationSql, /ALTER TABLE|DROP|TRUNCATE|DELETE FROM|UPDATE trades|UPDATE journal_entries|UPDATE trading_rules|UPDATE rule_checks/i);
  });
});

describe('goal metric calculation and state', () => {
  test('calculates net PnL, preserves a genuine zero, and marks no trades unavailable', () => {
    assert.equal(calculateGoalProgress(goal, { closed_count: 2, net_pnl: '250.125' }, { today: '2026-08-10' }).currentValue, 250.13);
    const zero = calculateGoalProgress(goal, { closed_count: 2, net_pnl: '0' }, { today: '2026-08-10' });
    assert.equal(zero.currentValue, 0);
    assert.equal(zero.hasData, true);
    const none = calculateGoalProgress(goal, { closed_count: 0, net_pnl: null }, { today: '2026-08-10' });
    assert.equal(none.currentValue, null);
    assert.equal(none.hasData, false);
  });

  test('calculates closed trades and win rate with winners over every closed trade', () => {
    const closedGoal = { ...goal, metricKey: 'closed_trades', targetValue: 4 };
    assert.equal(calculateGoalProgress(closedGoal, { closed_count: 3 }, { today: '2026-08-10' }).currentValue, 3);
    const winGoal = { ...goal, metricKey: 'win_rate', targetValue: 50 };
    assert.equal(calculateGoalProgress(winGoal, { closed_count: 4, winners: 2 }, { today: '2026-08-10' }).currentValue, 50);
    assert.equal(calculateGoalProgress(winGoal, { closed_count: 0, winners: 0 }, { today: '2026-08-10' }).hasData, false);
  });

  test('uses stored non-null R values and makes empty R unavailable', () => {
    const rGoal = { ...goal, metricKey: 'average_r', targetValue: 1 };
    assert.equal(calculateGoalProgress(rGoal, { r_count: 2, average_r: '1.23456' }, { today: '2026-08-10' }).currentValue, 1.2346);
    assert.equal(calculateGoalProgress(rGoal, { r_count: 0, average_r: null }, { today: '2026-08-10' }).unavailableReason, 'no_r_data');
  });

  test('calculates Rules adherence from followed plus broken and excludes not applicable', () => {
    const adherenceGoal = { ...goal, metricKey: 'rule_adherence', targetValue: 70 };
    assert.equal(calculateGoalProgress(adherenceGoal, { followed: 3, broken: 1, total_checks: 8 }, { today: '2026-08-10' }).currentValue, 75);
    assert.equal(calculateGoalProgress(adherenceGoal, { followed: 0, broken: 0, total_checks: 3 }, { today: '2026-08-10' }).hasData, false);
  });

  test('returns real zero counts for Journal entries and broken checks', () => {
    const journalGoal = { ...goal, metricKey: 'journal_entries', targetValue: 5 };
    assert.deepEqual(calculateGoalProgress(journalGoal, { journal_count: 0 }, { today: '2026-08-10' }).currentValue, 0);
    const brokenGoal = { ...goal, metricKey: 'broken_rule_checks', comparison: 'at_most', targetValue: 2 };
    assert.equal(calculateGoalProgress(brokenGoal, { broken: 0, total_checks: 0 }, { today: '2026-08-10' }).currentValue, 0);
    assert.equal(calculateGoalProgress(brokenGoal, { broken: 3, total_checks: 5 }, { today: '2026-08-10' }).targetSatisfied, false);
    assert.equal(calculateGoalProgress(brokenGoal, { broken: 3 }, { today: '2026-08-10' }).progressPercent, null);
  });

  test('derives upcoming, in-progress, achieved, missed, paused, and archived in precedence order', () => {
    assert.equal(deriveGoalState(goal, false, '2026-07-31'), 'upcoming');
    assert.equal(deriveGoalState(goal, false, '2026-08-15'), 'in_progress');
    assert.equal(deriveGoalState(goal, true, '2026-08-15'), 'achieved');
    assert.equal(deriveGoalState(goal, false, '2026-09-01'), 'missed');
    assert.equal(deriveGoalState({ ...goal, status: 'paused' }, true, '2026-08-15'), 'paused');
    assert.equal(deriveGoalState({ ...goal, status: 'archived' }, true, '2026-08-15'), 'archived');
  });

  test('handles at-least, at-most, unavailable, and zero targets safely', () => {
    assert.equal(calculateGoalProgress(goal, { closed_count: 1, net_pnl: 1000 }, { today: '2026-08-10' }).targetSatisfied, true);
    const atMost = { ...goal, metricKey: 'broken_rule_checks', comparison: 'at_most', targetValue: 2 };
    assert.equal(calculateGoalProgress(atMost, { broken: 2 }, { today: '2026-08-10' }).targetSatisfied, true);
    assert.equal(calculateGoalProgress(goal, { closed_count: 0 }, { today: '2026-08-10' }).targetSatisfied, false);
    const zeroTarget = { ...goal, targetValue: 0 };
    assert.equal(calculateGoalProgress(zeroTarget, { closed_count: 1, net_pnl: 0 }, { today: '2026-08-10' }).progressPercent, 100);
    assert.equal(calculateGoalProgress(zeroTarget, { closed_count: 1, net_pnl: -1 }, { today: '2026-08-10' }).progressPercent, 0);
  });
});

describe('batched, owned source queries', () => {
  test('trade metrics are one user-scoped inclusive entry-date query', async () => {
    let captured;
    const queryable = { query: async (sql, params) => { captured = { sql, params }; return { rows: [] }; } };
    await queryTradeGoalMetrics(queryable, userId, [goal]);
    assert.match(captured.sql, /t\.user_id = \$1/);
    assert.match(captured.sql, /t\.status = 'closed'/);
    assert.match(captured.sql, /t\.entry_datetime >=/);
    assert.match(captured.sql, /T23:59:59\.999Z/);
    assert.deepEqual(captured.params, [userId, [goalId], ['2026-08-01'], ['2026-08-31']]);
  });

  test('Rules and Journal batches use owned inclusive date fields', async () => {
    const calls = [];
    const queryable = { query: async (sql, params) => { calls.push({ sql, params }); return { rows: [] }; } };
    await queryRulesGoalMetrics(queryable, userId, [goal]);
    await queryJournalGoalMetrics(queryable, userId, [goal]);
    assert.match(calls[0].sql, /rc\.user_id = \$1[\s\S]*?rc\.check_date >=[\s\S]*?rc\.check_date <=/);
    assert.match(calls[1].sql, /je\.user_id = \$1[\s\S]*?je\.entry_date >=[\s\S]*?je\.entry_date <=/);
  });

  test('computes every source in at most one query and degrades only a failed source', async () => {
    const goals = [
      goal,
      { ...goal, id: otherGoalId, metricKey: 'rule_adherence', targetValue: 80 },
      { ...goal, id: '44444444-4444-4444-8444-444444444444', metricKey: 'journal_entries', targetValue: 2 },
    ];
    const calls = [];
    const queryable = { query: async (sql) => {
      calls.push(sql);
      if (/FROM goal_ranges ranges[\s\S]*LEFT JOIN trades/.test(sql)) return { rows: [{ goal_id: goalId, closed_count: 2, winners: 1, net_pnl: 500, r_count: 1, average_r: 1 }] };
      if (/LEFT JOIN rule_checks/.test(sql)) throw new Error('rules unavailable');
      return { rows: [{ goal_id: goals[2].id, journal_count: 1 }] };
    } };
    const result = await computeProgressForGoals(userId, goals, queryable, '2026-08-10');
    assert.equal(calls.length, 3);
    assert.equal(result[0].currentValue, 500);
    assert.equal(result[1].unavailableReason, 'source_unavailable');
    assert.equal(result[2].currentValue, 1);
  });
});

describe('owned persistence and filtering', () => {
  test('keeps status, metric, and search filters parameterized and user-scoped', () => {
    const parts = buildGoalsListQueryParts(userId, { status: 'paused', metric: 'average_r', search: "x%' OR TRUE --" });
    assert.match(parts.where, /^g\.user_id = \$1/);
    assert.match(parts.where, /g\.status = \$2/);
    assert.match(parts.where, /g\.metric_key = \$3/);
    assert.match(parts.where, /ILIKE \$4/);
    assert.doesNotMatch(parts.where, /OR TRUE/);
    assert.deepEqual(parts.params, [userId, 'paused', 'average_r', "%x%' OR TRUE --%"]);
  });

  test('lists owned goals with stable ordering, batched progress, and real summary counts', async () => {
    const calls = [];
    pool.query = async (sql, params) => {
      calls.push({ sql, params });
      if (/SELECT g\.\*/.test(sql)) return { rows: [goalRow] };
      return { rows: [{ goal_id: goalId, closed_count: 2, winners: 1, net_pnl: 1200, r_count: 1, average_r: 1 }] };
    };
    const result = await listGoals(userId, { status: 'all' });
    assert.match(calls[0].sql, /g\.user_id = \$1/);
    assert.match(calls[0].sql, /g\.end_date ASC, g\.created_at ASC, g\.id ASC/);
    assert.equal(calls.length, 2);
    assert.equal(result.goals[0].derivedState, 'achieved');
    assert.deepEqual(result.summary, { total: 1, active: 1, paused: 0, archived: 0, upcoming: 0, inProgress: 0, achieved: 1, missed: 0 });
  });

  test('gets only an owned goal', async () => {
    const calls = [];
    pool.query = async (sql, params) => {
      calls.push({ sql, params });
      return calls.length === 1 ? { rows: [goalRow] } : { rows: [{ goal_id: goalId, closed_count: 1, net_pnl: 10, winners: 1, r_count: 0 }] };
    };
    const result = await getGoal(userId, goalId);
    assert.deepEqual(calls[0].params, [goalId, userId]);
    assert.equal(result.goal.currentValue, 10);
  });

  test('creates an owned goal and computes progress without persisting it', async () => {
    const calls = [];
    pool.query = async (sql, params) => {
      calls.push({ sql, params });
      return /INSERT INTO goals/.test(sql) ? { rows: [goalRow] } : { rows: [{ goal_id: goalId, closed_count: 0, net_pnl: null, r_count: 0 }] };
    };
    const result = await createGoal(userId, createPayload());
    assert.match(calls[0].sql, /INSERT INTO goals/);
    assert.equal(calls[0].params[0], userId);
    assert.doesNotMatch(calls[0].sql, /current_value|progress_percent|derived_state/);
    assert.equal(result.goal.hasData, false);
  });

  test('partially updates only an owned goal and recomputes changed metric and dates', async () => {
    const updatedRow = { ...goalRow, metric_key: 'journal_entries', target_value: '5', start_date: '2026-08-10', comparison: 'at_least' };
    const calls = [];
    pool.query = async (sql, params) => {
      calls.push({ sql, params });
      if (calls.length === 1) return { rows: [goalRow] };
      if (/UPDATE goals/.test(sql)) return { rows: [updatedRow] };
      return { rows: [{ goal_id: goalId, journal_count: 3 }] };
    };
    const result = await updateGoal(userId, goalId, { metricKey: 'journal_entries', comparison: 'at_least', targetValue: 5, startDate: '2026-08-10' });
    assert.match(calls[1].sql, /WHERE id = \$1 AND user_id = \$2/);
    assert.match(calls[2].sql, /LEFT JOIN journal_entries/);
    assert.deepEqual(calls[2].params[2], ['2026-08-10']);
    assert.equal(result.goal.currentValue, 3);
  });

  test('rejects an invalid effective partial update without changing the goal', async () => {
    let calls = 0;
    pool.query = async () => { calls += 1; return { rows: [goalRow] }; };
    await assert.rejects(() => updateGoal(userId, goalId, { comparison: 'at_most' }), (error) => error.code === 'VALIDATION_ERROR' && error.statusCode === 400);
    assert.equal(calls, 1);
  });

  test('deletes only the owned goal and touches no source table', async () => {
    let captured;
    pool.query = async (sql, params) => { captured = { sql, params }; return { rows: [{ id: goalId }] }; };
    assert.deepEqual(await deleteGoal(userId, goalId), { deleted: true, id: goalId });
    assert.equal(captured.sql, 'DELETE FROM goals WHERE id = $1 AND user_id = $2 RETURNING id');
    assert.deepEqual(captured.params, [goalId, userId]);
  });
});
