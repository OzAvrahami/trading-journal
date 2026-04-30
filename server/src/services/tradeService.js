import pool from '../db/client.js';
import { createError } from '../middleware/errorHandler.js';

// ---- Computation helpers ----------------------------------------------------

function calcPnl(direction, entryPrice, exitPrice, quantity, pointValue = 1) {
  const dir = (direction || '').toLowerCase().trim();
  const diff = dir === 'long'
    ? parseFloat(exitPrice) - parseFloat(entryPrice)
    : parseFloat(entryPrice) - parseFloat(exitPrice);
  return parseFloat((diff * parseFloat(quantity) * pointValue).toFixed(4));
}

function computeFields({ direction, entryPrice, exitPrice, quantity, fees, riskAmount, entryDatetime, exitDatetime, pointValue = 1 }) {
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

export async function listTrades(userId, filters = {}) {
  const {
    from, to, symbol, market, direction, status,
    strategy, timeframe, outcome, accountId,
    page = 1, limit = 50, sort = 'entry_datetime', order = 'desc',
  } = filters;

  const conditions = ['user_id = $1'];
  const params = [userId];
  let idx = 2;

  if (from)      { conditions.push(`entry_datetime >= $${idx++}`); params.push(from); }
  if (to)        { conditions.push(`entry_datetime <= $${idx++}`); params.push(`${to}T23:59:59.999Z`); }
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
  const computed = computeFields(data);

  const result = await pool.query(
    `INSERT INTO trades (
      user_id, account_id, symbol, market, direction,
      entry_datetime, exit_datetime, entry_price, exit_price,
      quantity, fees, strategy, setup, timeframe,
      risk_amount, stop_loss, take_profit,
      notes, emotions, screenshot_links,
      status, pnl_gross, pnl_net, r_multiple, duration_minutes
    ) VALUES (
      $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23,$24,$25
    ) RETURNING *`,
    [
      userId,
      data.accountId,
      data.symbol, data.market, data.direction,
      data.entryDatetime,
      data.exitDatetime ?? null,
      data.entryPrice,
      data.exitPrice ?? null,
      data.quantity,
      data.fees ?? 0,
      data.strategy ?? null,
      data.setup ?? null,
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
  const computed = computeFields(merged);

  const result = await pool.query(
    `UPDATE trades SET
      exit_datetime    = $3,
      exit_price       = $4,
      quantity         = $5,
      fees             = $6,
      strategy         = $7,
      setup            = $8,
      timeframe        = $9,
      risk_amount      = $10,
      stop_loss        = $11,
      take_profit      = $12,
      notes            = $13,
      emotions         = $14,
      screenshot_links = $15,
      status           = $16,
      pnl_gross        = $17,
      pnl_net          = $18,
      r_multiple       = $19,
      duration_minutes = $20
    WHERE id = $1 AND user_id = $2
    RETURNING *`,
    [
      tradeId, userId,
      merged.exitDatetime ?? null,
      merged.exitPrice ?? null,
      merged.quantity,
      merged.fees,
      data.strategy   !== undefined ? data.strategy   : existing.strategy,
      data.setup      !== undefined ? data.setup      : existing.setup,
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

export async function exportTradesCsv(userId, filters) {
  const { data } = await listTrades(userId, { ...filters, limit: 10000, page: 1 });
  return data;
}
