import pool from '../db/client.js';
import { createError } from '../middleware/errorHandler.js';

function count(value) {
  return Number(value ?? 0);
}

function round(value, decimals = 4) {
  if (value == null || !Number.isFinite(Number(value))) return null;
  return Number(Number(value).toFixed(decimals));
}

export function calculateProfitFactor(grossProfit, grossLoss) {
  const profit = Number(grossProfit ?? 0);
  const loss = Number(grossLoss ?? 0);
  if (loss > 0) return round(profit / loss, 4);
  return profit > 0 ? null : 0;
}

function mapMetrics(row) {
  const closedTrades = count(row.closed_trades);
  const winners = count(row.winners);
  return {
    closedTrades,
    openTrades: count(row.open_trades),
    winners,
    losers: count(row.losers),
    breakeven: count(row.breakeven),
    pnlNet: round(row.pnl_net, 2) ?? 0,
    winRate: closedTrades > 0 ? round(winners / closedTrades, 4) : null,
    averageR: row.average_r == null ? null : round(row.average_r, 4),
    profitFactor: closedTrades > 0 ? calculateProfitFactor(row.gross_profit, row.gross_loss) : null,
  };
}

function mapStrategy(row) {
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    isActive: row.is_active,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    setupCount: count(row.setup_count),
    activeSetupCount: count(row.active_setup_count),
    ...mapMetrics(row),
  };
}

function mapSetup(row) {
  return {
    id: row.id,
    strategyId: row.strategy_id,
    strategyName: row.strategy_name,
    name: row.name,
    description: row.description,
    isActive: row.is_active,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    ...mapMetrics(row),
  };
}

function normalizeDescription(value) {
  if (value == null) return null;
  const normalized = String(value).trim();
  return normalized || null;
}

function translateDuplicate(error, entity) {
  if (error?.code !== '23505') throw error;
  throw createError(
    entity === 'strategy' ? 'STRATEGY_NAME_EXISTS' : 'SETUP_NAME_EXISTS',
    entity === 'strategy'
      ? 'A Strategy with this name already exists.'
      : 'A Setup with this name already exists in this Strategy.',
    409,
  );
}

const STRATEGY_LIST_SQL = `WITH setup_counts AS (
  SELECT strategy_id,
         COUNT(*)::int AS setup_count,
         COUNT(*) FILTER (WHERE is_active)::int AS active_setup_count
  FROM setups WHERE user_id = $1 GROUP BY strategy_id
), trade_metrics AS (
  SELECT strategy_id,
         COUNT(*) FILTER (WHERE status = 'closed')::int AS closed_trades,
         COUNT(*) FILTER (WHERE status = 'open')::int AS open_trades,
         COUNT(*) FILTER (WHERE status = 'closed' AND pnl_net > 0)::int AS winners,
         COUNT(*) FILTER (WHERE status = 'closed' AND pnl_net < 0)::int AS losers,
         COUNT(*) FILTER (WHERE status = 'closed' AND pnl_net = 0)::int AS breakeven,
         COALESCE(SUM(pnl_net) FILTER (WHERE status = 'closed'), 0) AS pnl_net,
         AVG(r_multiple) FILTER (WHERE status = 'closed' AND r_multiple IS NOT NULL) AS average_r,
         COALESCE(SUM(pnl_net) FILTER (WHERE status = 'closed' AND pnl_net > 0), 0) AS gross_profit,
         COALESCE(ABS(SUM(pnl_net) FILTER (WHERE status = 'closed' AND pnl_net < 0)), 0) AS gross_loss
  FROM trades WHERE user_id = $1 AND strategy_id IS NOT NULL GROUP BY strategy_id
)
SELECT s.*, COALESCE(sc.setup_count, 0) AS setup_count,
       COALESCE(sc.active_setup_count, 0) AS active_setup_count,
       COALESCE(tm.closed_trades, 0) AS closed_trades,
       COALESCE(tm.open_trades, 0) AS open_trades,
       COALESCE(tm.winners, 0) AS winners,
       COALESCE(tm.losers, 0) AS losers,
       COALESCE(tm.breakeven, 0) AS breakeven,
       COALESCE(tm.pnl_net, 0) AS pnl_net,
       tm.average_r, tm.gross_profit, tm.gross_loss
FROM strategies s
LEFT JOIN setup_counts sc ON sc.strategy_id = s.id
LEFT JOIN trade_metrics tm ON tm.strategy_id = s.id
WHERE s.user_id = $1 AND ($2::boolean OR s.is_active)
ORDER BY s.is_active DESC, lower(btrim(s.name)), s.id`;

export async function listStrategies(userId, { includeArchived = false } = {}, queryable = pool) {
  const [strategyResult, summaryResult] = await Promise.all([
    queryable.query(STRATEGY_LIST_SQL, [userId, includeArchived]),
    queryable.query(
      `SELECT
         COUNT(*) FILTER (WHERE s.is_active)::int AS active_strategies,
         (SELECT COUNT(*)::int FROM setups WHERE user_id = $1 AND is_active) AS active_setups,
         (SELECT COUNT(*)::int FROM trades WHERE user_id = $1 AND status = 'closed' AND strategy_id IS NOT NULL) AS managed_closed_trades,
         (SELECT COUNT(*)::int FROM trades WHERE user_id = $1 AND status = 'closed' AND strategy_id IS NULL) AS unlinked_closed_trades
       FROM strategies s WHERE s.user_id = $1`,
      [userId],
    ),
  ]);
  const summary = summaryResult.rows[0] ?? {};
  return {
    strategies: strategyResult.rows.map(mapStrategy),
    summary: {
      activeStrategies: count(summary.active_strategies),
      activeSetups: count(summary.active_setups),
      managedClosedTrades: count(summary.managed_closed_trades),
      unlinkedClosedTrades: count(summary.unlinked_closed_trades),
    },
  };
}

const SETUP_LIST_SQL = `WITH trade_metrics AS (
  SELECT setup_id,
         COUNT(*) FILTER (WHERE status = 'closed')::int AS closed_trades,
         COUNT(*) FILTER (WHERE status = 'open')::int AS open_trades,
         COUNT(*) FILTER (WHERE status = 'closed' AND pnl_net > 0)::int AS winners,
         COUNT(*) FILTER (WHERE status = 'closed' AND pnl_net < 0)::int AS losers,
         COUNT(*) FILTER (WHERE status = 'closed' AND pnl_net = 0)::int AS breakeven,
         COALESCE(SUM(pnl_net) FILTER (WHERE status = 'closed'), 0) AS pnl_net,
         AVG(r_multiple) FILTER (WHERE status = 'closed' AND r_multiple IS NOT NULL) AS average_r,
         COALESCE(SUM(pnl_net) FILTER (WHERE status = 'closed' AND pnl_net > 0), 0) AS gross_profit,
         COALESCE(ABS(SUM(pnl_net) FILTER (WHERE status = 'closed' AND pnl_net < 0)), 0) AS gross_loss
  FROM trades WHERE user_id = $1 AND setup_id IS NOT NULL GROUP BY setup_id
)
SELECT su.*, s.name AS strategy_name,
       COALESCE(tm.closed_trades, 0) AS closed_trades,
       COALESCE(tm.open_trades, 0) AS open_trades,
       COALESCE(tm.winners, 0) AS winners,
       COALESCE(tm.losers, 0) AS losers,
       COALESCE(tm.breakeven, 0) AS breakeven,
       COALESCE(tm.pnl_net, 0) AS pnl_net,
       tm.average_r, tm.gross_profit, tm.gross_loss
FROM setups su
JOIN strategies s ON s.id = su.strategy_id AND s.user_id = su.user_id
LEFT JOIN trade_metrics tm ON tm.setup_id = su.id
WHERE su.user_id = $1
  AND ($2::uuid IS NULL OR su.strategy_id = $2)
  AND ($3::boolean OR su.is_active)
ORDER BY su.is_active DESC, lower(btrim(su.name)), su.id`;

export async function listSetups(userId, { strategyId = null, includeArchived = false } = {}, queryable = pool) {
  const result = await queryable.query(SETUP_LIST_SQL, [userId, strategyId, includeArchived]);
  return { setups: result.rows.map(mapSetup) };
}

export async function listLegacyClassifications(userId, queryable = pool) {
  const result = await queryable.query(
    `WITH strategy_values AS (
       SELECT lower(btrim(COALESCE(strategy, ''))) AS grouping_key,
              COALESCE(NULLIF(btrim(strategy), ''), '') AS display_value,
              status, pnl_net, entry_datetime
       FROM trades WHERE user_id = $1 AND strategy_id IS NULL
     ), setup_values AS (
       SELECT lower(btrim(COALESCE(setup, ''))) AS grouping_key,
              COALESCE(NULLIF(btrim(setup), ''), '') AS display_value,
              status, pnl_net, entry_datetime
       FROM trades WHERE user_id = $1 AND setup_id IS NULL
     )
     SELECT kind, grouping_key,
            (array_agg(display_value ORDER BY entry_datetime DESC, display_value ASC))[1] AS value,
            COUNT(*)::int AS trade_count,
            COUNT(*) FILTER (WHERE status = 'closed')::int AS closed_trades,
            COUNT(*) FILTER (WHERE status = 'closed' AND pnl_net > 0)::int AS winners,
            COALESCE(SUM(pnl_net) FILTER (WHERE status = 'closed'), 0) AS pnl_net
     FROM (
       SELECT 'strategy'::text AS kind, * FROM strategy_values
       UNION ALL
       SELECT 'setup'::text AS kind, * FROM setup_values
     ) values_union
     GROUP BY kind, grouping_key
     ORDER BY kind, trade_count DESC, grouping_key ASC`,
    [userId],
  );
  const mapLegacy = (row) => {
    const closedTrades = count(row.closed_trades);
    const winners = count(row.winners);
    return {
      value: row.value || null,
      tradeCount: count(row.trade_count),
      closedTrades,
      pnlNet: round(row.pnl_net, 2) ?? 0,
      winRate: closedTrades > 0 ? round(winners / closedTrades, 4) : null,
    };
  };
  return {
    strategies: result.rows.filter((row) => row.kind === 'strategy').map(mapLegacy),
    setups: result.rows.filter((row) => row.kind === 'setup').map(mapLegacy),
  };
}

export async function createStrategy(userId, data, queryable = pool) {
  try {
    const result = await queryable.query(
      `INSERT INTO strategies (user_id, name, description)
       VALUES ($1, $2, $3) RETURNING *`,
      [userId, data.name.trim(), normalizeDescription(data.description)],
    );
    return { strategy: mapStrategy({ ...result.rows[0], setup_count: 0, active_setup_count: 0 }) };
  } catch (error) {
    translateDuplicate(error, 'strategy');
  }
}

export async function updateStrategy(userId, strategyId, data, queryable = pool) {
  const assignments = [];
  const params = [strategyId, userId];
  const values = {
    name: data.name?.trim(),
    description: data.description !== undefined ? normalizeDescription(data.description) : undefined,
    is_active: data.isActive,
  };
  Object.entries(values).forEach(([column, value]) => {
    if (value !== undefined) {
      params.push(value);
      assignments.push(`${column} = $${params.length}`);
    }
  });
  try {
    const result = await queryable.query(
      `UPDATE strategies SET ${assignments.join(', ')} WHERE id = $1 AND user_id = $2 RETURNING *`,
      params,
    );
    if (!result.rows[0]) throw createError('STRATEGY_NOT_FOUND', 'Strategy not found.', 404);
    return { strategy: mapStrategy(result.rows[0]) };
  } catch (error) {
    if (error?.code === 'STRATEGY_NOT_FOUND') throw error;
    translateDuplicate(error, 'strategy');
  }
}

async function requireOwnedStrategy(userId, strategyId, queryable = pool) {
  const result = await queryable.query(
    'SELECT id, name, is_active FROM strategies WHERE id = $1 AND user_id = $2',
    [strategyId, userId],
  );
  if (!result.rows[0]) throw createError('STRATEGY_NOT_FOUND', 'Strategy not found.', 404);
  return result.rows[0];
}

export async function createSetup(userId, data, queryable = pool) {
  const strategy = await requireOwnedStrategy(userId, data.strategyId, queryable);
  if (!strategy.is_active) throw createError('STRATEGY_ARCHIVED', 'Archived Strategies cannot receive new Setups.', 409);
  try {
    const result = await queryable.query(
      `INSERT INTO setups (user_id, strategy_id, name, description)
       VALUES ($1, $2, $3, $4) RETURNING *`,
      [userId, data.strategyId, data.name.trim(), normalizeDescription(data.description)],
    );
    return { setup: mapSetup({ ...result.rows[0], strategy_name: strategy.name }) };
  } catch (error) {
    translateDuplicate(error, 'setup');
  }
}

export async function updateSetup(userId, setupId, data, queryable = pool) {
  const assignments = [];
  const params = [setupId, userId];
  const values = {
    name: data.name?.trim(),
    description: data.description !== undefined ? normalizeDescription(data.description) : undefined,
    is_active: data.isActive,
  };
  Object.entries(values).forEach(([column, value]) => {
    if (value !== undefined) {
      params.push(value);
      assignments.push(`${column} = $${params.length}`);
    }
  });
  try {
    const result = await queryable.query(
      `UPDATE setups SET ${assignments.join(', ')} WHERE id = $1 AND user_id = $2 RETURNING *`,
      params,
    );
    if (!result.rows[0]) throw createError('SETUP_NOT_FOUND', 'Setup not found.', 404);
    return { setup: mapSetup(result.rows[0]) };
  } catch (error) {
    if (error?.code === 'SETUP_NOT_FOUND') throw error;
    translateDuplicate(error, 'setup');
  }
}

export async function resolveTradeClassification(
  userId,
  { strategyId = null, setupId = null },
  { currentStrategyId = null, currentSetupId = null, queryable = pool } = {},
) {
  if (setupId && !strategyId) {
    throw createError('SETUP_REQUIRES_STRATEGY', 'A managed Setup requires a managed Strategy.', 400);
  }
  let strategy = null;
  let setup = null;
  if (strategyId) {
    strategy = await requireOwnedStrategy(userId, strategyId, queryable);
    if (!strategy.is_active && strategy.id !== currentStrategyId) {
      throw createError('STRATEGY_ARCHIVED', 'Choose an active Strategy.', 409);
    }
  }
  if (setupId) {
    const result = await queryable.query(
      'SELECT id, strategy_id, name, is_active FROM setups WHERE id = $1 AND user_id = $2',
      [setupId, userId],
    );
    setup = result.rows[0];
    if (!setup) throw createError('SETUP_NOT_FOUND', 'Setup not found.', 404);
    if (!setup.is_active && setup.id !== currentSetupId) {
      throw createError('SETUP_ARCHIVED', 'Choose an active Setup.', 409);
    }
    if (setup.strategy_id !== strategyId) {
      throw createError('SETUP_STRATEGY_MISMATCH', 'The Setup does not belong to the selected Strategy.', 400);
    }
  }
  return { strategy, setup };
}
