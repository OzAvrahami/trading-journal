import pool from '../db/client.js';
import { createError } from '../middleware/errorHandler.js';

function dateKey(value) {
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  return value == null ? null : String(value).slice(0, 10);
}

function count(value) {
  return Number(value ?? 0);
}

export function calculateAdherenceRate(followed, eligibleChecks) {
  if (!eligibleChecks) return null;
  return Math.round((Number(followed) / Number(eligibleChecks)) * 1000) / 10;
}

function mapRule(row) {
  const rule = {
    id: row.id,
    name: row.name,
    description: row.description,
    scope: row.scope,
    isActive: row.is_active,
    sortOrder: row.sort_order,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
  if (row.check_count !== undefined) rule.checkCount = count(row.check_count);
  return rule;
}

function mapAdherence(row) {
  const followed = count(row.followed);
  const broken = count(row.broken);
  const eligibleChecks = followed + broken;
  return {
    ruleId: row.id,
    name: row.name,
    scope: row.scope,
    isActive: row.is_active,
    totalChecks: count(row.total_checks),
    eligibleChecks,
    followed,
    broken,
    notApplicable: count(row.not_applicable),
    adherenceRate: calculateAdherenceRate(followed, eligibleChecks),
    lastCheckDate: dateKey(row.last_check_date),
  };
}

function accountLabel(row) {
  if (!row.account_id) return null;
  return row.account_name || [row.account_company, row.account_number].filter(Boolean).join(' — ');
}

function mapCheck(row) {
  return {
    id: row.id,
    ruleId: row.rule_id,
    checkDate: dateKey(row.check_date),
    outcome: row.outcome,
    notes: row.notes,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    rule: {
      id: row.rule_id,
      name: row.rule_name,
      scope: row.rule_scope,
      isActive: row.rule_is_active,
    },
    trade: row.trade_id ? {
      id: row.trade_id,
      symbol: row.trade_symbol,
      entryDatetime: row.trade_entry_datetime,
      exitDatetime: row.trade_exit_datetime,
      status: row.trade_status,
      pnlNet: row.trade_pnl_net == null ? null : Number(row.trade_pnl_net),
      accountId: row.account_id,
      accountLabel: accountLabel(row),
    } : null,
    journalEntry: row.journal_entry_id ? {
      id: row.journal_entry_id,
      entryType: row.journal_entry_type,
      entryDate: dateKey(row.journal_entry_date),
      title: row.journal_entry_title,
      isComplete: row.journal_entry_is_complete,
    } : null,
  };
}

export function buildRulesListQueryParts(userId, filters = {}) {
  const conditions = ['r.user_id = $1'];
  const params = [userId];
  const add = (value) => {
    params.push(value);
    return `$${params.length}`;
  };

  if (filters.status === 'active' || !filters.status) conditions.push('r.is_active = TRUE');
  if (filters.status === 'inactive') conditions.push('r.is_active = FALSE');
  if (filters.scope) conditions.push(`r.scope = ${add(filters.scope)}`);
  if (filters.search) conditions.push(`(r.name ILIKE ${add(`%${filters.search}%`)} OR r.description ILIKE $${params.length})`);
  return { where: conditions.join(' AND '), params };
}

export async function listRules(userId, filters = {}) {
  const { where, params } = buildRulesListQueryParts(userId, filters);
  const result = await pool.query(
    `SELECT r.*, COUNT(rc.id)::int AS check_count
     FROM trading_rules r
     LEFT JOIN rule_checks rc ON rc.rule_id = r.id AND rc.user_id = r.user_id
     WHERE ${where}
     GROUP BY r.id
     ORDER BY CASE WHEN r.is_active THEN 0 ELSE 1 END,
              r.sort_order ASC, r.created_at ASC, r.id ASC`,
    params,
  );
  return { rules: result.rows.map(mapRule) };
}

export function buildAdherenceQueryParts(userId, filters = {}) {
  const params = [userId];
  const joinConditions = ['rc.rule_id = r.id', 'rc.user_id = $1'];
  const ruleConditions = ['r.user_id = $1'];
  const add = (value) => {
    params.push(value);
    return `$${params.length}`;
  };
  if (filters.from) joinConditions.push(`rc.check_date >= ${add(filters.from)}`);
  if (filters.to) joinConditions.push(`rc.check_date <= ${add(filters.to)}`);
  if (filters.scope) ruleConditions.push(`r.scope = ${add(filters.scope)}`);
  if (filters.ruleId) ruleConditions.push(`r.id = ${add(filters.ruleId)}`);
  return { join: joinConditions.join(' AND '), where: ruleConditions.join(' AND '), params };
}

export async function getAdherence(userId, filters = {}) {
  const { join, where, params } = buildAdherenceQueryParts(userId, filters);
  const result = await pool.query(
    `SELECT r.id, r.name, r.scope, r.is_active, r.sort_order, r.created_at,
            COUNT(rc.id)::int AS total_checks,
            COUNT(rc.id) FILTER (WHERE rc.outcome = 'followed')::int AS followed,
            COUNT(rc.id) FILTER (WHERE rc.outcome = 'broken')::int AS broken,
            COUNT(rc.id) FILTER (WHERE rc.outcome = 'not_applicable')::int AS not_applicable,
            MAX(rc.check_date) AS last_check_date
     FROM trading_rules r
     LEFT JOIN rule_checks rc ON ${join}
     WHERE ${where}
     GROUP BY r.id
     HAVING r.is_active = TRUE OR COUNT(rc.id) > 0
     ORDER BY CASE WHEN r.is_active THEN 0 ELSE 1 END,
              r.sort_order ASC, r.created_at ASC, r.id ASC`,
    params,
  );
  const rules = result.rows.map(mapAdherence);
  const summary = rules.reduce((current, rule) => ({
    activeRules: current.activeRules + (rule.isActive ? 1 : 0),
    totalChecks: current.totalChecks + rule.totalChecks,
    eligibleChecks: current.eligibleChecks + rule.eligibleChecks,
    followed: current.followed + rule.followed,
    broken: current.broken + rule.broken,
    notApplicable: current.notApplicable + rule.notApplicable,
    adherenceRate: null,
  }), {
    activeRules: 0,
    totalChecks: 0,
    eligibleChecks: 0,
    followed: 0,
    broken: 0,
    notApplicable: 0,
    adherenceRate: null,
  });
  summary.adherenceRate = calculateAdherenceRate(summary.followed, summary.eligibleChecks);
  return { summary, rules };
}

export async function getRule(userId, ruleId, queryable = pool) {
  const result = await queryable.query(
    `SELECT r.*,
            COUNT(rc.id)::int AS check_count,
            COUNT(rc.id) FILTER (WHERE rc.outcome = 'followed')::int AS followed,
            COUNT(rc.id) FILTER (WHERE rc.outcome = 'broken')::int AS broken,
            COUNT(rc.id) FILTER (WHERE rc.outcome = 'not_applicable')::int AS not_applicable,
            MAX(rc.check_date) AS last_check_date
     FROM trading_rules r
     LEFT JOIN rule_checks rc ON rc.rule_id = r.id AND rc.user_id = r.user_id
     WHERE r.id = $1 AND r.user_id = $2
     GROUP BY r.id`,
    [ruleId, userId],
  );
  const row = result.rows[0];
  if (!row) throw createError('RULE_NOT_FOUND', 'Trading rule not found.', 404);
  const rule = mapRule(row);
  const followed = count(row.followed);
  const broken = count(row.broken);
  return {
    rule: {
      ...rule,
      summary: {
        totalChecks: rule.checkCount,
        eligibleChecks: followed + broken,
        followed,
        broken,
        notApplicable: count(row.not_applicable),
        adherenceRate: calculateAdherenceRate(followed, followed + broken),
        lastCheckDate: dateKey(row.last_check_date),
      },
    },
  };
}

export async function createRule(userId, data) {
  const result = await pool.query(
    `INSERT INTO trading_rules (user_id, name, description, scope, is_active, sort_order)
     VALUES ($1, $2, $3, $4, $5,
       COALESCE($6, (SELECT COALESCE(MAX(sort_order) + 1, 0) FROM trading_rules WHERE user_id = $1)))
     RETURNING *`,
    [userId, data.name, data.description, data.scope, data.isActive, data.sortOrder ?? null],
  );
  return { rule: mapRule({ ...result.rows[0], check_count: 0 }) };
}

export async function updateRule(userId, ruleId, data) {
  const assignments = [];
  const params = [ruleId, userId];
  const columns = {
    name: 'name', description: 'description', scope: 'scope', isActive: 'is_active', sortOrder: 'sort_order',
  };
  Object.entries(columns).forEach(([key, column]) => {
    if (data[key] !== undefined) {
      params.push(data[key]);
      assignments.push(`${column} = $${params.length}`);
    }
  });
  const result = await pool.query(
    `UPDATE trading_rules SET ${assignments.join(', ')}
     WHERE id = $1 AND user_id = $2
     RETURNING *`,
    params,
  );
  if (!result.rows[0]) throw createError('RULE_NOT_FOUND', 'Trading rule not found.', 404);
  return { rule: mapRule(result.rows[0]) };
}

export async function deleteRule(userId, ruleId) {
  const existing = await pool.query(
    `SELECT r.id, COUNT(rc.id)::int AS check_count
     FROM trading_rules r
     LEFT JOIN rule_checks rc ON rc.rule_id = r.id AND rc.user_id = r.user_id
     WHERE r.id = $1 AND r.user_id = $2
     GROUP BY r.id`,
    [ruleId, userId],
  );
  if (!existing.rows[0]) throw createError('RULE_NOT_FOUND', 'Trading rule not found.', 404);
  if (count(existing.rows[0].check_count) > 0) {
    throw createError('RULE_HAS_CHECKS', 'This rule has historical checks. Deactivate it instead of deleting it.', 409);
  }
  try {
    await pool.query('DELETE FROM trading_rules WHERE id = $1 AND user_id = $2', [ruleId, userId]);
  } catch (error) {
    if (error.code === '23503') {
      throw createError('RULE_HAS_CHECKS', 'This rule has historical checks. Deactivate it instead of deleting it.', 409);
    }
    throw error;
  }
  return { deleted: true, id: ruleId };
}

export function buildChecksQueryParts(userId, filters = {}) {
  const conditions = ['rc.user_id = $1'];
  const params = [userId];
  const add = (value) => {
    params.push(value);
    return `$${params.length}`;
  };
  if (filters.from) conditions.push(`rc.check_date >= ${add(filters.from)}`);
  if (filters.to) conditions.push(`rc.check_date <= ${add(filters.to)}`);
  if (filters.ruleId) conditions.push(`rc.rule_id = ${add(filters.ruleId)}`);
  if (filters.outcome) conditions.push(`rc.outcome = ${add(filters.outcome)}`);
  if (filters.tradeId) conditions.push(`rc.trade_id = ${add(filters.tradeId)}`);
  if (filters.journalEntryId) conditions.push(`rc.journal_entry_id = ${add(filters.journalEntryId)}`);
  return { where: conditions.join(' AND '), params };
}

const CHECK_SELECT = `SELECT rc.*,
  r.name AS rule_name, r.scope AS rule_scope, r.is_active AS rule_is_active,
  t.symbol AS trade_symbol, t.entry_datetime AS trade_entry_datetime,
  t.exit_datetime AS trade_exit_datetime, t.status AS trade_status, t.pnl_net AS trade_pnl_net,
  t.account_id, a.account_name, a.company AS account_company, a.account_number,
  je.entry_type AS journal_entry_type, je.entry_date AS journal_entry_date,
  je.title AS journal_entry_title, je.is_complete AS journal_entry_is_complete
FROM rule_checks rc
JOIN trading_rules r ON r.id = rc.rule_id AND r.user_id = rc.user_id
LEFT JOIN trades t ON t.id = rc.trade_id AND t.user_id = rc.user_id
LEFT JOIN trading_accounts a ON a.id = t.account_id AND a.user_id = rc.user_id
LEFT JOIN journal_entries je ON je.id = rc.journal_entry_id AND je.user_id = rc.user_id`;

export async function listRuleChecks(userId, filters = {}) {
  const { page = 1, limit = 25 } = filters;
  const { where, params } = buildChecksQueryParts(userId, filters);
  const offset = (page - 1) * limit;
  const [dataResult, countResult] = await Promise.all([
    pool.query(
      `${CHECK_SELECT}
       WHERE ${where}
       ORDER BY rc.check_date DESC, rc.created_at DESC, rc.id DESC
       LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
      [...params, limit, offset],
    ),
    pool.query(`SELECT COUNT(*) FROM rule_checks rc WHERE ${where}`, params),
  ]);
  const total = count(countResult.rows[0]?.count);
  return {
    checks: dataResult.rows.map(mapCheck),
    pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
  };
}

async function withTransaction(work) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const value = await work(client);
    await client.query('COMMIT');
    return value;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

async function assertContextOwnership(queryable, userId, { ruleId, tradeId, journalEntryId }) {
  const rule = await queryable.query('SELECT id FROM trading_rules WHERE id = $1 AND user_id = $2', [ruleId, userId]);
  if (!rule.rows[0]) throw createError('INVALID_RULE_LINK', 'The selected rule is unavailable.', 400);
  if (tradeId) {
    const trade = await queryable.query('SELECT id FROM trades WHERE id = $1 AND user_id = $2', [tradeId, userId]);
    if (!trade.rows[0]) throw createError('INVALID_TRADE_LINK', 'The selected trade is unavailable.', 400);
  }
  if (journalEntryId) {
    const entry = await queryable.query('SELECT id FROM journal_entries WHERE id = $1 AND user_id = $2', [journalEntryId, userId]);
    if (!entry.rows[0]) throw createError('INVALID_JOURNAL_LINK', 'The selected Journal entry is unavailable.', 400);
  }
}

async function getCheckById(queryable, userId, checkId) {
  const result = await queryable.query(`${CHECK_SELECT} WHERE rc.id = $1 AND rc.user_id = $2`, [checkId, userId]);
  if (!result.rows[0]) throw createError('RULE_CHECK_NOT_FOUND', 'Rule check not found.', 404);
  return mapCheck(result.rows[0]);
}

export async function createRuleCheck(userId, data) {
  return withTransaction(async (client) => {
    await assertContextOwnership(client, userId, data);
    const result = await client.query(
      `INSERT INTO rule_checks
         (user_id, rule_id, check_date, outcome, notes, trade_id, journal_entry_id)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING id`,
      [userId, data.ruleId, data.checkDate, data.outcome, data.notes, data.tradeId, data.journalEntryId],
    );
    return { check: await getCheckById(client, userId, result.rows[0].id) };
  });
}

export async function updateRuleCheck(userId, checkId, data) {
  return withTransaction(async (client) => {
    const existingResult = await client.query(
      'SELECT * FROM rule_checks WHERE id = $1 AND user_id = $2 FOR UPDATE',
      [checkId, userId],
    );
    const existing = existingResult.rows[0];
    if (!existing) throw createError('RULE_CHECK_NOT_FOUND', 'Rule check not found.', 404);
    const next = {
      ruleId: data.ruleId !== undefined ? data.ruleId : existing.rule_id,
      tradeId: data.tradeId !== undefined ? data.tradeId : existing.trade_id,
      journalEntryId: data.journalEntryId !== undefined ? data.journalEntryId : existing.journal_entry_id,
    };
    await assertContextOwnership(client, userId, next);
    await client.query(
      `UPDATE rule_checks SET
         rule_id = $3, check_date = $4, outcome = $5, notes = $6,
         trade_id = $7, journal_entry_id = $8
       WHERE id = $1 AND user_id = $2`,
      [
        checkId,
        userId,
        next.ruleId,
        data.checkDate !== undefined ? data.checkDate : dateKey(existing.check_date),
        data.outcome !== undefined ? data.outcome : existing.outcome,
        data.notes !== undefined ? data.notes : existing.notes,
        next.tradeId,
        next.journalEntryId,
      ],
    );
    return { check: await getCheckById(client, userId, checkId) };
  });
}

export async function deleteRuleCheck(userId, checkId) {
  const result = await pool.query(
    'DELETE FROM rule_checks WHERE id = $1 AND user_id = $2 RETURNING id',
    [checkId, userId],
  );
  if (!result.rows[0]) throw createError('RULE_CHECK_NOT_FOUND', 'Rule check not found.', 404);
  return { deleted: true, id: checkId };
}
