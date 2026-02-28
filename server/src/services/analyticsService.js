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

function buildDateConditions(from, to, params) {
  let cond = '';
  if (from) { params.push(from);                    cond += ` AND entry_datetime >= $${params.length}`; }
  if (to)   { params.push(`${to}T23:59:59.999Z`);   cond += ` AND entry_datetime <= $${params.length}`; }
  return cond;
}

// ---- Summary ----------------------------------------------------------------

export async function getSummary(userId, { from, to }) {
  const now = new Date();

  const params = [userId];
  const dateCond = buildDateConditions(from, to, params);

  const [mainRes, todayRes, wtdRes, mtdRes] = await Promise.all([
    pool.query(`
      SELECT
        COUNT(*)                                              AS total,
        COUNT(*) FILTER (WHERE status = 'closed')            AS closed,
        COUNT(*) FILTER (WHERE status = 'open')              AS open,
        COUNT(*) FILTER (WHERE status='closed' AND pnl_net > 0) AS winners,
        COUNT(*) FILTER (WHERE status='closed' AND pnl_net < 0) AS losers,
        COALESCE(SUM(pnl_net)   FILTER (WHERE status='closed'), 0) AS pnl_net_sum,
        COALESCE(SUM(pnl_gross) FILTER (WHERE status='closed'), 0) AS pnl_gross_sum,
        COALESCE(SUM(fees), 0)                               AS fees_sum,
        AVG(pnl_net)   FILTER (WHERE status='closed' AND pnl_net > 0) AS avg_win,
        AVG(pnl_net)   FILTER (WHERE status='closed' AND pnl_net < 0) AS avg_loss,
        AVG(r_multiple) FILTER (WHERE status='closed' AND r_multiple IS NOT NULL) AS avg_r,
        AVG(duration_minutes) FILTER (WHERE status='closed') AS avg_duration,
        COALESCE(SUM(pnl_net) FILTER (WHERE status='closed' AND pnl_net > 0), 0) AS gross_profit,
        COALESCE(ABS(SUM(pnl_net) FILTER (WHERE status='closed' AND pnl_net < 0)), 0) AS gross_loss
      FROM trades
      WHERE user_id = $1 ${dateCond}
    `, params),

    pool.query(
      `SELECT COUNT(*) AS cnt, COALESCE(SUM(pnl_net),0) AS pnl
       FROM trades WHERE user_id=$1 AND status='closed' AND entry_datetime >= $2 AND entry_datetime <= $3`,
      [userId, startOfDay(now), endOfDay(now)]
    ),

    pool.query(
      `SELECT COUNT(*) AS cnt, COALESCE(SUM(pnl_net),0) AS pnl
       FROM trades WHERE user_id=$1 AND status='closed' AND entry_datetime >= $2`,
      [userId, startOfWeek(now)]
    ),

    pool.query(
      `SELECT COUNT(*) AS cnt, COALESCE(SUM(pnl_net),0) AS pnl
       FROM trades WHERE user_id=$1 AND status='closed' AND entry_datetime >= $2`,
      [userId, startOfMonth(now)]
    ),
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

export async function getEquityCurve(userId, { from, to }) {
  const params = [userId];
  const dateCond = buildDateConditions(from, to, params);

  const result = await pool.query(`
    SELECT DATE(entry_datetime) AS date, SUM(pnl_net) AS daily_pnl
    FROM trades
    WHERE user_id = $1 AND status = 'closed' ${dateCond}
    GROUP BY DATE(entry_datetime)
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

// ---- PnL distribution -------------------------------------------------------

export async function getDistribution(userId, { from, to }) {
  const params = [userId];
  const dateCond = buildDateConditions(from, to, params);

  const result = await pool.query(`
    SELECT pnl_net FROM trades
    WHERE user_id = $1 AND status = 'closed' AND pnl_net IS NOT NULL ${dateCond}
    ORDER BY pnl_net
  `, params);

  if (result.rows.length === 0) return { buckets: [] };

  const values = result.rows.map(r => parseFloat(r.pnl_net));
  const minVal = Math.min(...values);
  const maxVal = Math.max(...values);

  // Choose a bucket size that gives ~15-20 buckets
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

export async function getBreakdown(userId, { by = 'strategy', from, to }) {
  const allowed = { symbol: 'symbol', strategy: 'strategy', timeframe: 'timeframe', direction: 'direction' };
  const col = allowed[by] || 'strategy';

  const params = [userId];
  const dateCond = buildDateConditions(from, to, params);

  const result = await pool.query(`
    SELECT
      ${col}                                                  AS label,
      COUNT(*)                                                AS trades_count,
      COUNT(*) FILTER (WHERE pnl_net > 0)                    AS winners,
      COUNT(*) FILTER (WHERE pnl_net < 0)                    AS losers,
      COALESCE(SUM(pnl_net), 0)                              AS pnl_net,
      AVG(r_multiple) FILTER (WHERE r_multiple IS NOT NULL)  AS avg_r
    FROM trades
    WHERE user_id = $1 AND status = 'closed' ${dateCond}
    GROUP BY ${col}
    ORDER BY pnl_net DESC
  `, params);

  return {
    by,
    data: result.rows.map(r => {
      const count   = parseInt(r.trades_count) || 0;
      const winners = parseInt(r.winners)      || 0;
      return {
        label:         r.label || 'Unknown',
        tradesCount:   count,
        winners,
        losers:        parseInt(r.losers) || 0,
        winRate:       count > 0 ? parseFloat((winners / count).toFixed(4)) : 0,
        pnlNet:        parseFloat(parseFloat(r.pnl_net || 0).toFixed(2)),
        avgRMultiple:  r.avg_r != null ? parseFloat(parseFloat(r.avg_r).toFixed(4)) : null,
      };
    }),
  };
}
