import pool from '../db/client.js';
import { createError } from '../middleware/errorHandler.js';
import { validateAccountOwnership } from './accountService.js';
import { DEFAULT_TIMEZONE, addTimestampDateRange } from '../utils/dateTime.js';
import { resolveTradeClassification } from './strategiesService.js';

// ---- Computation helpers ----------------------------------------------------

function calcPnl(direction, entryPrice, exitPrice, quantity, pointValue = 1) {
  const dir = (direction || '').toLowerCase().trim();
  const diff = dir === 'long'
    ? parseFloat(exitPrice) - parseFloat(entryPrice)
    : parseFloat(entryPrice) - parseFloat(exitPrice);
  return parseFloat((diff * parseFloat(quantity) * pointValue).toFixed(4));
}

export function validateTradeState({ entryDatetime, exitDatetime, exitPrice }) {
  const normalizedExitDatetime = exitDatetime === '' ? null : (exitDatetime ?? null);
  const normalizedExitPrice = exitPrice === '' ? null : (exitPrice ?? null);
  const hasExitDatetime = normalizedExitDatetime != null;
  const hasExitPrice = normalizedExitPrice != null;

  if (hasExitDatetime !== hasExitPrice) {
    throw createError(
      'VALIDATION_ERROR',
      'Exit datetime and exit price must be provided together.',
      400,
      { exitFields: ['Exit datetime and exit price must be provided together.'] }
    );
  }

  if (hasExitDatetime && new Date(normalizedExitDatetime) < new Date(entryDatetime)) {
    throw createError(
      'VALIDATION_ERROR',
      'Exit datetime must be on or after entry datetime.',
      400,
      { exitDatetime: ['Exit datetime must be on or after entry datetime.'] }
    );
  }

  return { exitDatetime: normalizedExitDatetime, exitPrice: normalizedExitPrice };
}

export function computeFields(fields) {
  const {
    direction, entryPrice, quantity, fees, riskAmount, entryDatetime, pointValue = 1,
  } = fields;
  const { exitDatetime, exitPrice } = validateTradeState(fields);
  const status = exitDatetime ? 'closed' : 'open';
  let pnlGross = null, pnlNet = null, rMultiple = null, durationMinutes = null;

  if (exitPrice != null) {
    pnlGross = calcPnl(direction, entryPrice, exitPrice, quantity, pointValue);
    pnlNet = parseFloat((pnlGross - parseFloat(fees || 0)).toFixed(4));

    if (riskAmount && parseFloat(riskAmount) !== 0) {
      rMultiple = parseFloat((pnlNet / parseFloat(riskAmount)).toFixed(4));
    }
  }

  if (exitDatetime && entryDatetime) {
    durationMinutes = Math.floor((new Date(exitDatetime) - new Date(entryDatetime)) / 60000);
  }

  return { status, pnlGross, pnlNet, rMultiple, durationMinutes };
}

// ---- Row mapper (snake_case DB → camelCase API) -----------------------------

function mapTrade(row) {
  return {
    id:              row.id,
    userId:          row.user_id,
    accountId:       row.account_id,
    symbol:          row.symbol,
    market:          row.market,
    direction:       row.direction,
    entryDatetime:   row.entry_datetime,
    exitDatetime:    row.exit_datetime,
    entryPrice:      parseFloat(row.entry_price),
    exitPrice:       row.exit_price != null ? parseFloat(row.exit_price) : null,
    quantity:        parseFloat(row.quantity),
    fees:            parseFloat(row.fees),
    strategy:        row.strategy,
    setup:           row.setup,
    strategyId:      row.strategy_id ?? null,
    setupId:         row.setup_id ?? null,
    timeframe:       row.timeframe,
    riskAmount:      row.risk_amount != null ? parseFloat(row.risk_amount) : null,
    stopLoss:        row.stop_loss != null ? parseFloat(row.stop_loss) : null,
    takeProfit:      row.take_profit != null ? parseFloat(row.take_profit) : null,
    notes:           row.notes,
    emotions:        row.emotions,
    screenshotLinks: row.screenshot_links,
    status:          row.status,
    pnlGross:        row.pnl_gross != null ? parseFloat(row.pnl_gross) : null,
    pnlNet:          row.pnl_net != null ? parseFloat(row.pnl_net) : null,
    rMultiple:       row.r_multiple != null ? parseFloat(row.r_multiple) : null,
    durationMinutes: row.duration_minutes,
    createdAt:       row.created_at,
    updatedAt:       row.updated_at,
  };
}

// ---- Public service functions -----------------------------------------------

export async function listTrades(userId, filters = {}, timezone = DEFAULT_TIMEZONE) {
  const {
    from, to, symbol, market, direction, status,
    strategy, timeframe, outcome, accountId,
    page = 1, limit = 50, sort = 'entry_datetime', order = 'desc',
  } = filters;

  const conditions = ['user_id = $1'];
  const params = [userId];
  let idx = 2;

  addTimestampDateRange({ conditions, params, column: 'entry_datetime', from, to, timezone });
  idx = params.length + 1;
  if (symbol)    { conditions.push(`symbol ILIKE $${idx++}`);      params.push(`%${symbol}%`); }
  if (market)    { conditions.push(`market = $${idx++}`);          params.push(market); }
  if (direction) { conditions.push(`direction = $${idx++}`);       params.push(direction); }
  if (status)    { conditions.push(`status = $${idx++}`);          params.push(status); }
  if (strategy)  { conditions.push(`strategy ILIKE $${idx++}`);    params.push(`%${strategy}%`); }
  if (timeframe) { conditions.push(`timeframe = $${idx++}`);       params.push(timeframe); }
  if (accountId) { conditions.push(`account_id = $${idx++}`);      params.push(accountId); }
  if (outcome === 'win')  conditions.push('pnl_net > 0');
  if (outcome === 'loss') conditions.push('pnl_net < 0');

  const allowedSorts = {
    entry_datetime: 'entry_datetime',
    pnl_net:        'pnl_net',
    symbol:         'symbol',
    created_at:     'created_at',
  };
  const sortCol = allowedSorts[sort] || 'entry_datetime';
  const sortDir = order === 'asc' ? 'ASC' : 'DESC';
  const offset = (page - 1) * limit;
  const where = conditions.join(' AND ');

  const [dataRes, countRes] = await Promise.all([
    pool.query(
      `SELECT * FROM trades WHERE ${where} ORDER BY ${sortCol} ${sortDir} LIMIT $${idx} OFFSET $${idx + 1}`,
      [...params, limit, offset]
    ),
    pool.query(`SELECT COUNT(*) FROM trades WHERE ${where}`, params),
  ]);

  const total = parseInt(countRes.rows[0].count, 10);
  return {
    data: dataRes.rows.map(mapTrade),
    pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
  };
}

export async function getTrade(userId, tradeId) {
  const result = await pool.query(
    'SELECT * FROM trades WHERE id = $1 AND user_id = $2',
    [tradeId, userId]
  );
  if (!result.rows[0]) throw createError('TRADE_NOT_FOUND', 'Trade not found.', 404);
  return mapTrade(result.rows[0]);
}

export async function createTrade(userId, data) {
  const exitState = validateTradeState(data);
  await validateAccountOwnership(userId, data.accountId);
  const classification = await resolveTradeClassification(userId, {
    strategyId: data.strategyId ?? null,
    setupId: data.setupId ?? null,
  });
  const normalized = { ...data, ...exitState };
  const computed = computeFields(normalized);

  const result = await pool.query(
    `INSERT INTO trades (
      user_id, account_id, symbol, market, direction,
      entry_datetime, exit_datetime, entry_price, exit_price,
      quantity, fees, strategy, setup, strategy_id, setup_id, timeframe,
      risk_amount, stop_loss, take_profit,
      notes, emotions, screenshot_links,
      status, pnl_gross, pnl_net, r_multiple, duration_minutes
    ) VALUES (
      $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23,$24,$25,$26,$27
    ) RETURNING *`,
    [
      userId,
      data.accountId,
      data.symbol, data.market, data.direction,
      data.entryDatetime,
      normalized.exitDatetime,
      data.entryPrice,
      normalized.exitPrice,
      data.quantity,
      data.fees ?? 0,
      classification.strategy?.name ?? data.strategy ?? null,
      classification.setup?.name ?? data.setup ?? null,
      classification.strategy?.id ?? null,
      classification.setup?.id ?? null,
      data.timeframe ?? null,
      data.riskAmount ?? null,
      data.stopLoss ?? null,
      data.takeProfit ?? null,
      data.notes ?? null,
      data.emotions ? JSON.stringify(data.emotions) : null,
      data.screenshotLinks ?? null,
      computed.status,
      computed.pnlGross,
      computed.pnlNet,
      computed.rMultiple,
      computed.durationMinutes,
    ]
  );
  return mapTrade(result.rows[0]);
}

export async function updateTrade(userId, tradeId, data) {
  // Fetch existing trade to merge with patch data
  const existing = await getTrade(userId, tradeId);
  await validateAccountOwnership(userId, existing.accountId);

  const strategyIdChanged = data.strategyId !== undefined;
  const setupIdChanged = data.setupId !== undefined;
  const finalStrategyId = strategyIdChanged ? data.strategyId : existing.strategyId;
  let finalSetupId = setupIdChanged ? data.setupId : existing.setupId;
  if (!finalStrategyId || (strategyIdChanged && finalStrategyId !== existing.strategyId && !setupIdChanged)) {
    finalSetupId = null;
  }
  const classification = await resolveTradeClassification(
    userId,
    { strategyId: finalStrategyId ?? null, setupId: finalSetupId ?? null },
    { currentStrategyId: existing.strategyId, currentSetupId: existing.setupId },
  );
  const strategyLinkChanged = (finalStrategyId ?? null) !== (existing.strategyId ?? null);
  const setupLinkChanged = (finalSetupId ?? null) !== (existing.setupId ?? null);
  const strategySnapshot = classification.strategy && strategyLinkChanged
    ? classification.strategy.name
    : data.strategy !== undefined ? data.strategy : existing.strategy;
  const setupSnapshot = classification.setup && setupLinkChanged
    ? classification.setup.name
    : data.setup !== undefined ? data.setup : existing.setup;

  const merged = {
    direction:    existing.direction,
    entryPrice:   existing.entryPrice,
    entryDatetime: existing.entryDatetime,
    quantity:     data.quantity    ?? existing.quantity,
    fees:         data.fees        ?? existing.fees,
    riskAmount:   data.riskAmount  !== undefined ? data.riskAmount  : existing.riskAmount,
    exitDatetime: data.exitDatetime !== undefined ? data.exitDatetime : existing.exitDatetime,
    exitPrice:    data.exitPrice    !== undefined ? data.exitPrice    : existing.exitPrice,
  };
  const exitState = validateTradeState(merged);
  Object.assign(merged, exitState);
  const computed = computeFields(merged);

  const result = await pool.query(
    `UPDATE trades SET
      exit_datetime    = $3,
      exit_price       = $4,
      quantity         = $5,
      fees             = $6,
      strategy         = $7,
      setup            = $8,
      strategy_id      = $9,
      setup_id         = $10,
      timeframe        = $11,
      risk_amount      = $12,
      stop_loss        = $13,
      take_profit      = $14,
      notes            = $15,
      emotions         = $16,
      screenshot_links = $17,
      status           = $18,
      pnl_gross        = $19,
      pnl_net          = $20,
      r_multiple       = $21,
      duration_minutes = $22
    WHERE id = $1 AND user_id = $2
    RETURNING *`,
    [
      tradeId, userId,
      merged.exitDatetime ?? null,
      merged.exitPrice ?? null,
      merged.quantity,
      merged.fees,
      strategySnapshot,
      setupSnapshot,
      finalStrategyId ?? null,
      finalSetupId ?? null,
      data.timeframe  !== undefined ? data.timeframe  : existing.timeframe,
      merged.riskAmount ?? null,
      data.stopLoss   !== undefined ? data.stopLoss   : existing.stopLoss,
      data.takeProfit !== undefined ? data.takeProfit : existing.takeProfit,
      data.notes      !== undefined ? data.notes      : existing.notes,
      data.emotions !== undefined
        ? (data.emotions ? JSON.stringify(data.emotions) : null)
        : (existing.emotions ? JSON.stringify(existing.emotions) : null),
      data.screenshotLinks !== undefined ? data.screenshotLinks : existing.screenshotLinks,
      computed.status,
      computed.pnlGross,
      computed.pnlNet,
      computed.rMultiple,
      computed.durationMinutes,
    ]
  );
  return mapTrade(result.rows[0]);
}

export async function deleteTrade(userId, tradeId) {
  const result = await pool.query(
    'DELETE FROM trades WHERE id = $1 AND user_id = $2 RETURNING id',
    [tradeId, userId]
  );
  if (!result.rows[0]) throw createError('TRADE_NOT_FOUND', 'Trade not found.', 404);
  return { deleted: true, id: tradeId };
}

export async function exportTradesCsv(userId, filters, timezone = DEFAULT_TIMEZONE) {
  const { data } = await listTrades(userId, { ...filters, limit: 10000, page: 1 }, timezone);
  return data;
}
