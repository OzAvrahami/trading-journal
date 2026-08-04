import pool from '../db/client.js';
import { createError } from '../middleware/errorHandler.js';
import { DEFAULT_TIMEZONE, dateKeyInTimezone } from '../utils/dateTime.js';

export const GOAL_METRICS = Object.freeze([
  'net_pnl',
  'closed_trades',
  'win_rate',
  'average_r',
  'rule_adherence',
  'journal_entries',
  'broken_rule_checks',
]);
export const GOAL_STATUSES = Object.freeze(['active', 'paused', 'archived']);
export const GOAL_COMPARISONS = Object.freeze(['at_least', 'at_most']);

export const METRIC_CONFIG = Object.freeze({
  net_pnl: { comparison: 'at_least', unit: 'currency', source: 'trades', min: -1000000000, max: 1000000000 },
  closed_trades: { comparison: 'at_least', unit: 'count', source: 'trades', min: 0, max: 1000000000, integer: true },
  win_rate: { comparison: 'at_least', unit: 'percent', source: 'trades', min: 0, max: 100 },
  average_r: { comparison: 'at_least', unit: 'r_multiple', source: 'trades', min: -1000, max: 1000 },
  rule_adherence: { comparison: 'at_least', unit: 'percent', source: 'rules', min: 0, max: 100 },
  journal_entries: { comparison: 'at_least', unit: 'count', source: 'journal', min: 0, max: 1000000000, integer: true },
  broken_rule_checks: { comparison: 'at_most', unit: 'count', source: 'rules', min: 0, max: 1000000000, integer: true },
});

function dateKey(value) {
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  return value == null ? null : String(value).slice(0, 10);
}

function number(value) {
  return value == null ? null : Number(value);
}

function count(value) {
  return Number(value ?? 0);
}

function round(value, decimals = 4) {
  if (value == null || !Number.isFinite(Number(value))) return null;
  const factor = 10 ** decimals;
  return Math.round(Number(value) * factor) / factor;
}

export function goalTodayKey(timezone = DEFAULT_TIMEZONE, now = new Date()) {
  return dateKeyInTimezone(timezone, now);
}

export function validateGoalDefinition(goal) {
  const config = METRIC_CONFIG[goal.metricKey];
  if (!config) return { field: 'metricKey', message: 'Choose a supported goal metric.' };
  if (goal.comparison !== config.comparison) {
    return { field: 'comparison', message: `${goal.metricKey} must use ${config.comparison}.` };
  }
  const target = Number(goal.targetValue);
  if (!Number.isFinite(target)) return { field: 'targetValue', message: 'Enter a finite target value.' };
  if (target < config.min || target > config.max) {
    return { field: 'targetValue', message: `Target must be between ${config.min} and ${config.max}.` };
  }
  if (config.integer && !Number.isInteger(target)) {
    return { field: 'targetValue', message: 'Count targets must be whole numbers.' };
  }
  if (goal.startDate && goal.endDate && goal.startDate > goal.endDate) {
    return { field: 'endDate', message: 'End date must not precede start date.' };
  }
  return null;
}

function assertGoalDefinition(goal) {
  const issue = validateGoalDefinition(goal);
  if (issue) {
    throw createError('VALIDATION_ERROR', 'Goal definition validation failed.', 400, { [issue.field]: [issue.message] });
  }
}

export function mapStoredGoal(row) {
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    metricKey: row.metric_key,
    comparison: row.comparison,
    targetValue: number(row.target_value),
    startDate: dateKey(row.start_date),
    endDate: dateKey(row.end_date),
    status: row.status,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function buildGoalsListQueryParts(userId, filters = {}) {
  const conditions = ['g.user_id = $1'];
  const params = [userId];
  const add = (value) => {
    params.push(value);
    return `$${params.length}`;
  };

  if (filters.status && filters.status !== 'all') conditions.push(`g.status = ${add(filters.status)}`);
  if (filters.metric) conditions.push(`g.metric_key = ${add(filters.metric)}`);
  if (filters.search) {
    const placeholder = add(`%${filters.search}%`);
    conditions.push(`(g.name ILIKE ${placeholder} OR g.description ILIKE ${placeholder})`);
  }
  return { where: conditions.join(' AND '), params };
}

function rangeArrays(goals) {
  return [
    goals.map((goal) => goal.id),
    goals.map((goal) => goal.startDate),
    goals.map((goal) => goal.endDate),
  ];
}

export async function queryTradeGoalMetrics(queryable, userId, goals, timezone = DEFAULT_TIMEZONE) {
  if (!goals.length) return new Map();
  const result = await queryable.query(
    `WITH goal_ranges AS (
       SELECT * FROM unnest($2::uuid[], $3::date[], $4::date[])
         AS ranges(goal_id, start_date, end_date)
     )
     SELECT ranges.goal_id,
            COUNT(t.id)::int AS closed_count,
            COUNT(t.id) FILTER (WHERE t.pnl_net > 0)::int AS winners,
            SUM(t.pnl_net) AS net_pnl,
            COUNT(t.r_multiple)::int AS r_count,
            AVG(t.r_multiple) AS average_r
     FROM goal_ranges ranges
     LEFT JOIN trades t
       ON t.user_id = $1
      AND t.status = 'closed'
      AND t.entry_datetime >= (ranges.start_date::timestamp AT TIME ZONE $5)
      AND t.entry_datetime < ((ranges.end_date + 1)::timestamp AT TIME ZONE $5)
     GROUP BY ranges.goal_id`,
    [userId, ...rangeArrays(goals), timezone],
  );
  return new Map(result.rows.map((row) => [row.goal_id, row]));
}

export async function queryRulesGoalMetrics(queryable, userId, goals) {
  if (!goals.length) return new Map();
  const result = await queryable.query(
    `WITH goal_ranges AS (
       SELECT * FROM unnest($2::uuid[], $3::date[], $4::date[])
         AS ranges(goal_id, start_date, end_date)
     )
     SELECT ranges.goal_id,
            COUNT(rc.id)::int AS total_checks,
            COUNT(rc.id) FILTER (WHERE rc.outcome = 'followed')::int AS followed,
            COUNT(rc.id) FILTER (WHERE rc.outcome = 'broken')::int AS broken
     FROM goal_ranges ranges
     LEFT JOIN rule_checks rc
       ON rc.user_id = $1
      AND rc.check_date >= ranges.start_date
      AND rc.check_date <= ranges.end_date
     GROUP BY ranges.goal_id`,
    [userId, ...rangeArrays(goals)],
  );
  return new Map(result.rows.map((row) => [row.goal_id, row]));
}

export async function queryJournalGoalMetrics(queryable, userId, goals) {
  if (!goals.length) return new Map();
  const result = await queryable.query(
    `WITH goal_ranges AS (
       SELECT * FROM unnest($2::uuid[], $3::date[], $4::date[])
         AS ranges(goal_id, start_date, end_date)
     )
     SELECT ranges.goal_id, COUNT(je.id)::int AS journal_count
     FROM goal_ranges ranges
     LEFT JOIN journal_entries je
       ON je.user_id = $1
      AND je.entry_date >= ranges.start_date
      AND je.entry_date <= ranges.end_date
     GROUP BY ranges.goal_id`,
    [userId, ...rangeArrays(goals)],
  );
  return new Map(result.rows.map((row) => [row.goal_id, row]));
}

function metricResult(goal, raw, sourceFailed) {
  if (sourceFailed) {
    return { currentValue: null, hasData: false, sourceDataCount: 0, unavailableReason: 'source_unavailable' };
  }
  if (goal.metricKey === 'net_pnl') {
    const closed = count(raw?.closed_count);
    return closed > 0
      ? { currentValue: round(raw.net_pnl, 2), hasData: true, sourceDataCount: closed, unavailableReason: null }
      : { currentValue: null, hasData: false, sourceDataCount: 0, unavailableReason: 'no_closed_trades' };
  }
  if (goal.metricKey === 'closed_trades') {
    const closed = count(raw?.closed_count);
    return { currentValue: closed, hasData: true, sourceDataCount: closed, unavailableReason: null };
  }
  if (goal.metricKey === 'win_rate') {
    const closed = count(raw?.closed_count);
    return closed > 0
      ? { currentValue: round((count(raw.winners) / closed) * 100, 2), hasData: true, sourceDataCount: closed, unavailableReason: null }
      : { currentValue: null, hasData: false, sourceDataCount: 0, unavailableReason: 'no_closed_trades' };
  }
  if (goal.metricKey === 'average_r') {
    const rCount = count(raw?.r_count);
    return rCount > 0 && raw?.average_r != null
      ? { currentValue: round(raw.average_r, 4), hasData: true, sourceDataCount: rCount, unavailableReason: null }
      : { currentValue: null, hasData: false, sourceDataCount: 0, unavailableReason: 'no_r_data' };
  }
  if (goal.metricKey === 'rule_adherence') {
    const followed = count(raw?.followed);
    const broken = count(raw?.broken);
    const eligible = followed + broken;
    return eligible > 0
      ? { currentValue: round((followed / eligible) * 100, 1), hasData: true, sourceDataCount: eligible, unavailableReason: null }
      : { currentValue: null, hasData: false, sourceDataCount: 0, unavailableReason: 'no_eligible_rule_checks' };
  }
  if (goal.metricKey === 'broken_rule_checks') {
    const broken = count(raw?.broken);
    return { currentValue: broken, hasData: true, sourceDataCount: count(raw?.total_checks), unavailableReason: null };
  }
  const journalCount = count(raw?.journal_count);
  return { currentValue: journalCount, hasData: true, sourceDataCount: journalCount, unavailableReason: null };
}

export function deriveGoalState(goal, targetSatisfied, today = goalTodayKey()) {
  if (goal.status === 'archived') return 'archived';
  if (goal.status === 'paused') return 'paused';
  if (today < goal.startDate) return 'upcoming';
  if (targetSatisfied) return 'achieved';
  if (today > goal.endDate) return 'missed';
  return 'in_progress';
}

export function calculateGoalProgress(goal, raw, { sourceFailed = false, today = goalTodayKey() } = {}) {
  const config = METRIC_CONFIG[goal.metricKey];
  const metric = metricResult(goal, raw, sourceFailed);
  const targetSatisfied = metric.hasData && (goal.comparison === 'at_least'
    ? metric.currentValue >= goal.targetValue
    : metric.currentValue <= goal.targetValue);
  const differenceToTarget = metric.hasData ? round(metric.currentValue - goal.targetValue, 4) : null;
  let progressPercent = null;
  if (metric.hasData && goal.comparison === 'at_least') {
    if (goal.targetValue > 0) progressPercent = round((metric.currentValue / goal.targetValue) * 100, 1);
    else if (goal.targetValue === 0) progressPercent = targetSatisfied ? 100 : 0;
  }
  return {
    ...goal,
    ...metric,
    unit: config.unit,
    targetSatisfied,
    progressPercent,
    differenceToTarget,
    derivedState: deriveGoalState(goal, targetSatisfied, today),
  };
}

export async function computeProgressForGoals(
  userId,
  goals,
  queryable = pool,
  today = null,
  timezone = DEFAULT_TIMEZONE,
) {
  if (!goals.length) return [];
  const lifecycleDate = today ?? goalTodayKey(timezone);
  const grouped = { trades: [], rules: [], journal: [] };
  goals.forEach((goal) => grouped[METRIC_CONFIG[goal.metricKey].source].push(goal));
  const tasks = Object.entries(grouped)
    .filter(([, sourceGoals]) => sourceGoals.length)
    .map(([source, sourceGoals]) => ({
      source,
      sourceGoals,
      promise: source === 'trades'
        ? queryTradeGoalMetrics(queryable, userId, sourceGoals, timezone)
        : source === 'rules'
          ? queryRulesGoalMetrics(queryable, userId, sourceGoals)
          : queryJournalGoalMetrics(queryable, userId, sourceGoals),
    }));
  const settled = await Promise.allSettled(tasks.map((task) => task.promise));
  const sourceMaps = new Map();
  const failedSources = new Set();
  settled.forEach((result, index) => {
    const source = tasks[index].source;
    if (result.status === 'fulfilled') sourceMaps.set(source, result.value);
    else failedSources.add(source);
  });

  return goals.map((goal) => {
    const source = METRIC_CONFIG[goal.metricKey].source;
    return calculateGoalProgress(goal, sourceMaps.get(source)?.get(goal.id), {
      sourceFailed: failedSources.has(source),
      today: lifecycleDate,
    });
  });
}

function summarize(goals) {
  return goals.reduce((summary, goal) => {
    summary.total += 1;
    summary[goal.status] += 1;
    if (goal.derivedState === 'upcoming') summary.upcoming += 1;
    if (goal.derivedState === 'in_progress') summary.inProgress += 1;
    if (goal.derivedState === 'achieved') summary.achieved += 1;
    if (goal.derivedState === 'missed') summary.missed += 1;
    return summary;
  }, { total: 0, active: 0, paused: 0, archived: 0, upcoming: 0, inProgress: 0, achieved: 0, missed: 0 });
}

async function getOwnedGoalRow(userId, goalId, queryable = pool) {
  const result = await queryable.query('SELECT * FROM goals WHERE id = $1 AND user_id = $2', [goalId, userId]);
  if (!result.rows[0]) throw createError('GOAL_NOT_FOUND', 'Goal not found.', 404);
  return result.rows[0];
}

export async function listGoals(userId, filters = {}, timezone = DEFAULT_TIMEZONE) {
  const { where, params } = buildGoalsListQueryParts(userId, filters);
  const result = await pool.query(
    `SELECT g.* FROM goals g
     WHERE ${where}
     ORDER BY CASE g.status WHEN 'active' THEN 0 WHEN 'paused' THEN 1 ELSE 2 END,
              g.end_date ASC, g.created_at ASC, g.id ASC`,
    params,
  );
  const goals = await computeProgressForGoals(userId, result.rows.map(mapStoredGoal), pool, null, timezone);
  return { goals, summary: summarize(goals) };
}

export async function getGoal(userId, goalId, timezone = DEFAULT_TIMEZONE) {
  const goal = mapStoredGoal(await getOwnedGoalRow(userId, goalId));
  return { goal: (await computeProgressForGoals(userId, [goal], pool, null, timezone))[0] };
}

export async function createGoal(userId, data, timezone = DEFAULT_TIMEZONE) {
  assertGoalDefinition(data);
  const result = await pool.query(
    `INSERT INTO goals
       (user_id, name, description, metric_key, comparison, target_value, start_date, end_date, status)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
     RETURNING *`,
    [userId, data.name, data.description, data.metricKey, data.comparison, data.targetValue, data.startDate, data.endDate, data.status],
  );
  const goal = mapStoredGoal(result.rows[0]);
  return { goal: (await computeProgressForGoals(userId, [goal], pool, null, timezone))[0] };
}

export async function updateGoal(userId, goalId, data, timezone = DEFAULT_TIMEZONE) {
  const existing = mapStoredGoal(await getOwnedGoalRow(userId, goalId));
  const next = { ...existing, ...data };
  assertGoalDefinition(next);
  const columns = {
    name: 'name', description: 'description', metricKey: 'metric_key', comparison: 'comparison',
    targetValue: 'target_value', startDate: 'start_date', endDate: 'end_date', status: 'status',
  };
  const params = [goalId, userId];
  const assignments = [];
  Object.entries(columns).forEach(([key, column]) => {
    if (data[key] !== undefined) {
      params.push(data[key]);
      assignments.push(`${column} = $${params.length}`);
    }
  });
  const result = await pool.query(
    `UPDATE goals SET ${assignments.join(', ')}
     WHERE id = $1 AND user_id = $2
     RETURNING *`,
    params,
  );
  if (!result.rows[0]) throw createError('GOAL_NOT_FOUND', 'Goal not found.', 404);
  const goal = mapStoredGoal(result.rows[0]);
  return { goal: (await computeProgressForGoals(userId, [goal], pool, null, timezone))[0] };
}

export async function deleteGoal(userId, goalId) {
  const result = await pool.query('DELETE FROM goals WHERE id = $1 AND user_id = $2 RETURNING id', [goalId, userId]);
  if (!result.rows[0]) throw createError('GOAL_NOT_FOUND', 'Goal not found.', 404);
  return { deleted: true, id: goalId };
}
