import { date } from 'zod';
import pool from '../db/client.js';

// ---- Date helpers -----------------------------------------------------------

function startOfDay(d = new Date()) {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate()).toISOString();
}

function endOfDay(d = new Date()) {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate(), 23, 59, 59, 999).toISOString();
}

function startOfWeek(d = new Date()) {
  const day = d.getDay(); // 0=Sun
  const monday = new Date(d);
  monday.setDate(d.getDate() - (day === 0 ? 6 : day - 1));
  monday.setHours(0, 0, 0, 0);
  return monday.toISOString();
}

function startOfMonth(d = new Date()) {
  return new Date(d.getFullYear(), d.getMonth(), 1).toISOString();
}

// ---- Query builder helpers --------------------------------------------------

/**
 * Builds WHERE conditions and an optional JOIN for account/company filtering.
 * Uses table alias "t" for trades throughout.
 *
 * accountId filter → direct column condition, no JOIN needed.
 * company filter   → JOIN trading_accounts ta needed.
 */
function buildQueryParts(userId, { from, to, accountId, company }) {
  const params = [userId];
  const conds  = ['t.user_id = $1'];
  let join     = '';

  if (from) { params.push(from);                    conds.push(`t.entry_datetime >= $${params.length}`); }
  if (to)   { params.push(`${to}T23:59:59.999Z`);   conds.push(`t.entry_datetime <= $${params.length}`); }

  if (accountId) {
    params.push(accountId);
    conds.push(`t.account_id = $${params.length}`);
  } else if (company) {
    join = ' JOIN trading_accounts ta ON ta.id = t.account_id';
    params.push(company.toLowerCase().trim());
    conds.push(`ta.company = $${params.length}`);
  }

  return { params, where: conds.join(' AND '), join };
}

/**
 * Builds a simple COUNT+SUM query for a fixed date period (today/WTD/MTD).
 * Uses the same account/company filter as the main query but independent params.
 */
function buildPeriodQuery(userId, { accountId, company }, startDate, endDate) {
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

  params.push(startDate);
  conds.push(`t.entry_datetime >= $${params.length}`);

  if (endDate) {
    params.push(endDate);
    conds.push(`t.entry_datetime <= $${params.length}`);
  }

  return {
    sql: `SELECT COUNT(*) AS cnt, COALESCE(SUM(t.pnl_net), 0) AS pnl
          FROM trades t${join} WHERE ${conds.join(' AND ')}`,
    params,
  };
}

// ---- Summary ----------------------------------------------------------------

export async function getSummary(userId, { from, to, accountId, company }) {
  const now = new Date();

  const { params, where, join } = buildQueryParts(userId, { from, to, accountId, company });

  const todayQ = buildPeriodQuery(userId, { accountId, company }, startOfDay(now), endOfDay(now));
  const wtdQ   = buildPeriodQuery(userId, { accountId, company }, startOfWeek(now));
  const mtdQ   = buildPeriodQuery(userId, { accountId, company }, startOfMonth(now));

  const [mainRes, todayRes, wtdRes, mtdRes] = await Promise.all([
    pool.query(`
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
    pool.query(todayQ.sql, todayQ.params),
    pool.query(wtdQ.sql,   wtdQ.params),
    pool.query(mtdQ.sql,   mtdQ.params),
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
  const expectancy  = winRate * avgWin + (1 - winRate) * avgLoss;
  const profitFactor = grossLoss > 0 ? grossProfit / grossLoss : (grossProfit > 0 ? null : 0);

  const fmt2 = v => parseFloat(parseFloat(v || 0).toFixed(2));
  const fmt4 = v => v != null ? parseFloat(parseFloat(v).toFixed(4)) : null;

  return {
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
      expectancy:         fmt2(expectancy),
      profitFactor:       profitFactor != null ? fmt4(profitFactor) : null,
      avgRMultiple:       fmt4(r.avg_r),
      avgDurationMinutes: r.avg_duration ? Math.round(parseFloat(r.avg_duration)) : null,
    },
    today: { pnlNet: fmt2(todayRes.rows[0].pnl), tradesCount: parseInt(todayRes.rows[0].cnt) },
    wtd:   { pnlNet: fmt2(wtdRes.rows[0].pnl),   tradesCount: parseInt(wtdRes.rows[0].cnt) },
    mtd:   { pnlNet: fmt2(mtdRes.rows[0].pnl),   tradesCount: parseInt(mtdRes.rows[0].cnt) },
  };
}

// ---- Equity curve -----------------------------------------------------------

export async function getEquityCurve(userId, { from, to, accountId, company }) {
  const { params, where, join } = buildQueryParts(userId, { from, to, accountId, company });

  const result = await pool.query(`
    SELECT DATE(t.entry_datetime) AS date, SUM(t.pnl_net) AS daily_pnl
    FROM trades t${join}
    WHERE ${where} AND t.status = 'closed'
    GROUP BY DATE(t.entry_datetime)
    ORDER BY date ASC
  `, params);

  let cumulative = 0;
  return {
    data: result.rows.map(row => {
      const daily = parseFloat(parseFloat(row.daily_pnl).toFixed(2));
      cumulative = parseFloat((cumulative + daily).toFixed(2));
      return { date: row.date, dailyPnl: daily, cumulativePnl: cumulative };
    }),
  };
}

// ---- Calendar  --------------------------------------------------------------

export async function getCalendar(userId, { from, to, accountId, company }) {
  const { params, where, join } = buildQueryParts(userId, { from, to, accountId, company });

  const result = await pool.query(`
    SELECT
      DATE(t.entry_datetime) AS date,
      SUM(t.pnl_net) AS pnl_net,
      COUNT(*) AS trades_count
    FROM trades t${join}
    WHERE ${where} AND t.status = 'closed'
    GROUP BY DATE(t.entry_datetime)
    ORDER BY date ASC
  `, params);

  return {
    days: result.rows.map(row => ({
      date: row.date,
      pnlNet: parseFloat(parseFloat(row.pnl_net).toFixed(2)),
      tradesCount: Number(row.trades_count),
    })),
  };
}

// ---- PnL distribution -------------------------------------------------------

export async function getDistribution(userId, { from, to, accountId, company }) {
  const { params, where, join } = buildQueryParts(userId, { from, to, accountId, company });

  const result = await pool.query(`
    SELECT t.pnl_net FROM trades t${join}
    WHERE ${where} AND t.status = 'closed' AND t.pnl_net IS NOT NULL
    ORDER BY t.pnl_net
  `, params);

  if (result.rows.length === 0) return { buckets: [] };

  const values = result.rows.map(r => parseFloat(r.pnl_net));
  const minVal = Math.min(...values);
  const maxVal = Math.max(...values);

  const range = maxVal - minVal || 1;
  const rawSize = range / 15;
  const magnitude = Math.pow(10, Math.floor(Math.log10(rawSize)));
  const bucketSize = Math.max(Math.ceil(rawSize / magnitude) * magnitude, 1);

  const bucketStart = Math.floor(minVal / bucketSize) * bucketSize;
  const bucketEnd   = Math.ceil(maxVal  / bucketSize) * bucketSize;
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

  return { buckets };
}

// ---- Breakdown by dimension -------------------------------------------------

export async function getBreakdown(userId, { by = 'strategy', from, to, accountId, company }) {
  // account: group by account_id (UUID) — frontend maps to display name.
  // company: group by ta.company — requires JOIN.
  const dimensionMap = {
    symbol:    { col: 't.symbol',     needsJoin: false },
    strategy:  { col: 't.strategy',   needsJoin: false },
    timeframe: { col: 't.timeframe',  needsJoin: false },
    direction: { col: 't.direction',  needsJoin: false },
    account:   { col: 't.account_id', needsJoin: false },
    company:   { col: 'ta.company',   needsJoin: true  },
  };

  const dim = dimensionMap[by] ?? dimensionMap.strategy;
  const col = dim.col;

  const { params, where, join: filterJoin } = buildQueryParts(userId, { from, to, accountId, company });

  // If grouping by company we always need the JOIN, even if the filter doesn't require it.
  const groupJoin = dim.needsJoin && !filterJoin
    ? ' JOIN trading_accounts ta ON ta.id = t.account_id'
    : filterJoin;

  const result = await pool.query(`
    SELECT
      ${col}                                                     AS label,
      COUNT(*)                                                   AS trades_count,
      COUNT(*) FILTER (WHERE t.pnl_net > 0)                     AS winners,
      COUNT(*) FILTER (WHERE t.pnl_net < 0)                     AS losers,
      COALESCE(SUM(t.pnl_net), 0)                               AS pnl_net,
      AVG(t.r_multiple) FILTER (WHERE t.r_multiple IS NOT NULL) AS avg_r
    FROM trades t${groupJoin}
    WHERE ${where} AND t.status = 'closed'
    GROUP BY ${col}
    ORDER BY pnl_net DESC
  `, params);

  return {
    by,
    data: result.rows.map(r => {
      const count   = parseInt(r.trades_count) || 0;
      const winners = parseInt(r.winners)      || 0;
      return {
        label:        r.label || 'Unknown',
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
