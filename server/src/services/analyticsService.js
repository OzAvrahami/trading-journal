import pool from '../db/client.js';
import {
  DEFAULT_TIMEZONE,
  addTimestampDateRange,
  dateKeyInTimezone,
  ensureTimezoneParameter,
  localDateSql,
  mapPostgresDate,
  mondayOfDateKey,
  monthStartDateKey,
} from '../utils/dateTime.js';

// ---- Query builder helpers --------------------------------------------------

/**
 * Builds WHERE conditions and an optional JOIN for account/company filtering.
 * Uses table alias "t" for trades throughout.
 *
 * accountId filter → direct column condition, no JOIN needed.
 * company filter   → JOIN trading_accounts ta needed.
 */
export function buildQueryParts(userId, { from, to, accountId, company }, timezone = DEFAULT_TIMEZONE) {
  const params = [userId];
  const conds  = ['t.user_id = $1'];
  let join     = '';

  const timezonePlaceholder = addTimestampDateRange({
    conditions: conds, params, column: 't.entry_datetime', from, to, timezone,
  });

  if (accountId) {
    params.push(accountId);
    conds.push(`t.account_id = $${params.length}`);
  } else if (company) {
    join = ' JOIN trading_accounts ta ON ta.id = t.account_id';
    params.push(company.toLowerCase().trim());
    conds.push(`ta.company = $${params.length}`);
  }

  return { params, where: conds.join(' AND '), join, timezonePlaceholder };
}

/**
 * Builds a simple COUNT+SUM query for a fixed date period (today/WTD/MTD).
 * Uses the same account/company filter as the main query but independent params.
 */
function buildPeriodQuery(userId, { accountId, company }, from, to, timezone) {
  const params = [userId];
  const conds  = ["t.user_id = $1", "t.status = 'closed'"];
  let join     = '';

  if (accountId) {
    params.push(accountId);
    conds.push(`t.account_id = $${params.length}`);
  } else if (company) {
    join = ' JOIN trading_accounts ta ON ta.id = t.account_id';
    params.push(company.toLowerCase().trim());
    conds.push(`ta.company = $${params.length}`);
  }

  addTimestampDateRange({ conditions: conds, params, column: 't.entry_datetime', from, to, timezone });

  return {
    sql: `SELECT COUNT(*) AS cnt, COALESCE(SUM(t.pnl_net), 0) AS pnl
          FROM trades t${join} WHERE ${conds.join(' AND ')}`,
    params,
  };
}

// ---- Summary ----------------------------------------------------------------

export async function getSummary(userId, { from, to, accountId, company }, timezone = DEFAULT_TIMEZONE, now = new Date(), queryable = pool) {
  const today = dateKeyInTimezone(timezone, now);
  const { params, where, join } = buildQueryParts(userId, { from, to, accountId, company }, timezone);

  const todayQ = buildPeriodQuery(userId, { accountId, company }, today, today, timezone);
  const wtdQ   = buildPeriodQuery(userId, { accountId, company }, mondayOfDateKey(today), today, timezone);
  const mtdQ   = buildPeriodQuery(userId, { accountId, company }, monthStartDateKey(today), today, timezone);

  const [mainRes, todayRes, wtdRes, mtdRes] = await Promise.all([
    queryable.query(`
      SELECT
        COUNT(*)                                                          AS total,
        COUNT(*) FILTER (WHERE t.status = 'closed')                      AS closed,
        COUNT(*) FILTER (WHERE t.status = 'open')                        AS open,
        COUNT(*) FILTER (WHERE t.status = 'closed' AND t.pnl_net > 0)   AS winners,
        COUNT(*) FILTER (WHERE t.status = 'closed' AND t.pnl_net < 0)   AS losers,
        COALESCE(SUM(t.pnl_net)   FILTER (WHERE t.status = 'closed'), 0) AS pnl_net_sum,
        COALESCE(SUM(t.pnl_gross) FILTER (WHERE t.status = 'closed'), 0) AS pnl_gross_sum,
        COALESCE(SUM(t.fees), 0)                                          AS fees_sum,
        AVG(t.pnl_net)    FILTER (WHERE t.status = 'closed' AND t.pnl_net > 0)               AS avg_win,
        AVG(t.pnl_net)    FILTER (WHERE t.status = 'closed' AND t.pnl_net < 0)               AS avg_loss,
        AVG(t.r_multiple) FILTER (WHERE t.status = 'closed' AND t.r_multiple IS NOT NULL)    AS avg_r,
        AVG(t.duration_minutes) FILTER (WHERE t.status = 'closed')       AS avg_duration,
        COALESCE(SUM(t.pnl_net) FILTER (WHERE t.status = 'closed' AND t.pnl_net > 0), 0)    AS gross_profit,
        COALESCE(ABS(SUM(t.pnl_net) FILTER (WHERE t.status = 'closed' AND t.pnl_net < 0)), 0) AS gross_loss
      FROM trades t${join}
      WHERE ${where}
    `, params),
    queryable.query(todayQ.sql, todayQ.params),
    queryable.query(wtdQ.sql,   wtdQ.params),
    queryable.query(mtdQ.sql,   mtdQ.params),
  ]);

  const r = mainRes.rows[0];
  const closed  = parseInt(r.closed)  || 0;
  const winners = parseInt(r.winners) || 0;
  const losers  = parseInt(r.losers)  || 0;
  const avgWin  = parseFloat(r.avg_win)  || 0;
  const avgLoss = parseFloat(r.avg_loss) || 0;
  const grossProfit = parseFloat(r.gross_profit) || 0;
  const grossLoss   = parseFloat(r.gross_loss)   || 0;
  const winRate     = closed > 0 ? winners / closed : 0;
  const expectancy  = calculateExpectancy(r.pnl_net_sum, closed);
  const profitFactor = grossLoss > 0 ? grossProfit / grossLoss : (grossProfit > 0 ? null : 0);

  const fmt2 = v => parseFloat(parseFloat(v || 0).toFixed(2));
  const fmt4 = v => v != null ? parseFloat(parseFloat(v).toFixed(4)) : null;

  return {
    timezone,
    period: { from: from || null, to: to || null },
    totals: {
      tradesTotal:        parseInt(r.total) || 0,
      tradesClosed:       closed,
      tradesOpen:         parseInt(r.open) || 0,
      winners,
      losers,
      winRate:            fmt4(winRate),
      pnlNet:             fmt2(r.pnl_net_sum),
      pnlGross:           fmt2(r.pnl_gross_sum),
      totalFees:          fmt2(r.fees_sum),
      avgWin:             fmt2(avgWin),
      avgLoss:            fmt2(avgLoss),
      expectancy:         expectancy != null ? fmt2(expectancy) : null,
      profitFactor:       profitFactor != null ? fmt4(profitFactor) : null,
      avgRMultiple:       fmt4(r.avg_r),
      avgDurationMinutes: r.avg_duration ? Math.round(parseFloat(r.avg_duration)) : null,
    },
    today: { pnlNet: fmt2(todayRes.rows[0].pnl), tradesCount: parseInt(todayRes.rows[0].cnt) },
    wtd:   { pnlNet: fmt2(wtdRes.rows[0].pnl),   tradesCount: parseInt(wtdRes.rows[0].cnt) },
    mtd:   { pnlNet: fmt2(mtdRes.rows[0].pnl),   tradesCount: parseInt(mtdRes.rows[0].cnt) },
  };
}

export function calculateExpectancy(totalNetPnl, closedTrades) {
  const count = Number(closedTrades);
  if (!Number.isFinite(count) || count <= 0) return null;
  return Number(totalNetPnl || 0) / count;
}

// ---- Equity curve -----------------------------------------------------------

export async function getEquityCurve(userId, { from, to, accountId, company }, timezone = DEFAULT_TIMEZONE) {
  const parts = buildQueryParts(userId, { from, to, accountId, company }, timezone);
  const timezonePlaceholder = ensureTimezoneParameter(parts.params, timezone, parts.timezonePlaceholder);
  const dateExpression = localDateSql('t.entry_datetime', timezonePlaceholder);
  const { params, where, join } = parts;

  const result = await pool.query(`
    SELECT ${dateExpression} AS date, SUM(t.pnl_net) AS daily_pnl
    FROM trades t${join}
    WHERE ${where} AND t.status = 'closed'
    GROUP BY ${dateExpression}
    ORDER BY date ASC
  `, params);

  let cumulative = 0;
  return {
    data: result.rows.map(row => {
      const daily = parseFloat(parseFloat(row.daily_pnl).toFixed(2));
      cumulative = parseFloat((cumulative + daily).toFixed(2));
      return { date: mapPostgresDate(row.date), dailyPnl: daily, cumulativePnl: cumulative };
    }),
  };
}

// ---- Calendar  --------------------------------------------------------------

export async function getCalendar(userId, { from, to, accountId, company }, timezone = DEFAULT_TIMEZONE, queryable = pool) {
  const parts = buildQueryParts(userId, { from, to, accountId, company }, timezone);
  const timezonePlaceholder = ensureTimezoneParameter(parts.params, timezone, parts.timezonePlaceholder);
  const dateExpression = localDateSql('t.entry_datetime', timezonePlaceholder);
  const { params, where, join } = parts;

  const result = await queryable.query(`
    SELECT
      ${dateExpression} AS date,
      SUM(t.pnl_net) AS pnl_net,
      COUNT(*) AS trades_count
    FROM trades t${join}
    WHERE ${where} AND t.status = 'closed'
    GROUP BY ${dateExpression}
    ORDER BY date ASC
  `, params);

  return {
    days: result.rows.map(row => ({
      date: mapPostgresDate(row.date),
      pnlNet: parseFloat(parseFloat(row.pnl_net).toFixed(2)),
      tradesCount: Number(row.trades_count),
    })),
  };
}

// ---- PnL distribution -------------------------------------------------------

export async function getDistribution(userId, { from, to, accountId, company }, timezone = DEFAULT_TIMEZONE, queryable = pool) {
  const { params, where, join } = buildQueryParts(userId, { from, to, accountId, company }, timezone);

  const result = await queryable.query(`
    SELECT t.pnl_net FROM trades t${join}
    WHERE ${where} AND t.status = 'closed' AND t.pnl_net IS NOT NULL
    ORDER BY t.pnl_net
  `, params);

  const values = result.rows.map(r => parseFloat(r.pnl_net));
  return { buckets: bucketPnlValues(values) };
}

export function bucketPnlValues(rawValues) {
  const values = rawValues.map(Number).filter(Number.isFinite);
  if (values.length === 0) return [];

  const minVal = Math.min(...values);
  const maxVal = Math.max(...values);

  if (minVal === maxVal) {
    return [{
      range: `${minVal >= 0 ? '+' : ''}${minVal.toFixed(0)}`,
      min: minVal,
      max: maxVal,
      count: values.length,
    }];
  }

  const range = maxVal - minVal;
  const rawSize = range / 15;
  const magnitude = Math.pow(10, Math.floor(Math.log10(rawSize)));
  const bucketSize = Math.max(Math.ceil(rawSize / magnitude) * magnitude, 1);

  const bucketStart = Math.floor(minVal / bucketSize) * bucketSize;
  const bucketEnd   = (Math.floor(maxVal / bucketSize) + 1) * bucketSize;
  const buckets = [];

  for (let start = bucketStart; start < bucketEnd; start += bucketSize) {
    const end = start + bucketSize;
    const count = values.filter(v => v >= start && v < end).length;
    buckets.push({
      range: `${start >= 0 ? '+' : ''}${start.toFixed(0)} to ${end >= 0 ? '+' : ''}${end.toFixed(0)}`,
      min: start,
      max: end,
      count,
    });
  }

  return buckets;
}

// ---- R-multiple distribution -----------------------------------------------

export const R_BUCKETS = Object.freeze([
  { key: 'lte_neg_2', label: '≤ -2R', min: null, max: -2, lowerInclusive: false, upperInclusive: true },
  { key: 'neg_2_to_neg_1_5', label: '-2R to -1.5R', min: -2, max: -1.5, lowerInclusive: false, upperInclusive: true },
  { key: 'neg_1_5_to_neg_1', label: '-1.5R to -1R', min: -1.5, max: -1, lowerInclusive: false, upperInclusive: true },
  { key: 'neg_1_to_neg_0_5', label: '-1R to -0.5R', min: -1, max: -0.5, lowerInclusive: false, upperInclusive: true },
  { key: 'neg_0_5_to_0', label: '-0.5R to 0R', min: -0.5, max: 0, lowerInclusive: false, upperInclusive: false },
  { key: '0_to_0_5', label: '0R to 0.5R', min: 0, max: 0.5, lowerInclusive: true, upperInclusive: false },
  { key: '0_5_to_1', label: '0.5R to 1R', min: 0.5, max: 1, lowerInclusive: true, upperInclusive: false },
  { key: '1_to_2', label: '1R to 2R', min: 1, max: 2, lowerInclusive: true, upperInclusive: false },
  { key: '2_to_3', label: '2R to 3R', min: 2, max: 3, lowerInclusive: true, upperInclusive: false },
  { key: 'gte_3', label: '≥ 3R', min: 3, max: null, lowerInclusive: true, upperInclusive: false },
]);

function includesRValue(bucket, value) {
  const aboveMin = bucket.min == null || (bucket.lowerInclusive ? value >= bucket.min : value > bucket.min);
  const belowMax = bucket.max == null || (bucket.upperInclusive ? value <= bucket.max : value < bucket.max);
  return aboveMin && belowMax;
}

export function bucketRValues(values) {
  if (!values.length) return [];
  return R_BUCKETS.map((bucket) => ({
    ...bucket,
    count: values.filter((value) => includesRValue(bucket, value)).length,
  }));
}

export async function getRDistribution(userId, { from, to, accountId, company }, timezone = DEFAULT_TIMEZONE, queryable = pool) {
  const { params, where, join } = buildQueryParts(userId, { from, to, accountId, company }, timezone);
  const result = await queryable.query(`
    SELECT t.r_multiple FROM trades t${join}
    WHERE ${where} AND t.status = 'closed' AND t.r_multiple IS NOT NULL
    ORDER BY t.r_multiple ASC
  `, params);

  const values = result.rows
    .filter((row) => row.r_multiple != null)
    .map((row) => Number(row.r_multiple))
    .filter(Number.isFinite);
  return { totalTrades: values.length, buckets: bucketRValues(values) };
}

// ---- Breakdown by dimension -------------------------------------------------

const WEEKDAYS = Object.freeze([
  { key: 'monday', label: 'Monday' },
  { key: 'tuesday', label: 'Tuesday' },
  { key: 'wednesday', label: 'Wednesday' },
  { key: 'thursday', label: 'Thursday' },
  { key: 'friday', label: 'Friday' },
  { key: 'saturday', label: 'Saturday' },
  { key: 'sunday', label: 'Sunday' },
]);

export const BREAKDOWN_DIMENSIONS = Object.freeze({
  symbol:    { expression: 't.symbol', needsJoin: false },
  strategy:  { expression: 't.strategy', needsJoin: false },
  timeframe: { expression: 't.timeframe', needsJoin: false },
  direction: { expression: 't.direction', needsJoin: false },
  account:   { expression: 't.account_id', needsJoin: false },
  company:   { expression: 'ta.company', needsJoin: true },
  market:    { expression: 't.market', needsJoin: false },
  weekday:   { expression: null, needsJoin: false, ordered: true },
});

export async function getBreakdown(userId, { by = 'strategy', from, to, accountId, company }, timezone = DEFAULT_TIMEZONE) {
  // account: group by account_id (UUID) — frontend maps to display name.
  // company: group by ta.company — requires JOIN.
  const dim = BREAKDOWN_DIMENSIONS[by];
  if (!dim) throw new RangeError(`Unsupported analytics breakdown dimension: ${by}`);
  const parts = buildQueryParts(userId, { from, to, accountId, company }, timezone);
  const timezonePlaceholder = by === 'weekday'
    ? ensureTimezoneParameter(parts.params, timezone, parts.timezonePlaceholder)
    : parts.timezonePlaceholder;
  const col = by === 'weekday'
    ? `EXTRACT(ISODOW FROM (t.entry_datetime AT TIME ZONE ${timezonePlaceholder}))::int`
    : dim.expression;
  const { params, where, join: filterJoin } = parts;

  // If grouping by company we always need the JOIN, even if the filter doesn't require it.
  const groupJoin = dim.needsJoin && !filterJoin
    ? ' JOIN trading_accounts ta ON ta.id = t.account_id'
    : filterJoin;

  const result = await pool.query(`
    SELECT
      ${col}                                                     AS dimension_key,
      COUNT(*)                                                   AS trades_count,
      COUNT(*) FILTER (WHERE t.pnl_net > 0)                     AS winners,
      COUNT(*) FILTER (WHERE t.pnl_net < 0)                     AS losers,
      COALESCE(SUM(t.pnl_net), 0)                               AS pnl_net,
      AVG(t.r_multiple) FILTER (WHERE t.r_multiple IS NOT NULL) AS avg_r
    FROM trades t${groupJoin}
    WHERE ${where} AND t.status = 'closed'
    GROUP BY ${col}
    ORDER BY ${dim.ordered ? `${col} ASC` : 'pnl_net DESC'}
  `, params);

  return {
    by,
    data: result.rows.map(r => {
      const count   = parseInt(r.trades_count) || 0;
      const winners = parseInt(r.winners)      || 0;
      const weekday = by === 'weekday' ? WEEKDAYS[Number(r.dimension_key) - 1] : null;
      const rawKey = r.dimension_key == null || r.dimension_key === '' ? 'unknown' : String(r.dimension_key);
      return {
        key:          weekday?.key || rawKey,
        label:        weekday?.label || (rawKey === 'unknown' ? 'Unknown' : rawKey),
        tradesCount:  count,
        winners,
        losers:       parseInt(r.losers) || 0,
        winRate:      count > 0 ? parseFloat((winners / count).toFixed(4)) : 0,
        pnlNet:       parseFloat(parseFloat(r.pnl_net || 0).toFixed(2)),
        avgRMultiple: r.avg_r != null ? parseFloat(parseFloat(r.avg_r).toFixed(4)) : null,
      };
    }),
  };
}
