import pool from '../db/client.js';
import { createError } from '../middleware/errorHandler.js';
import { mapPostgresDate } from '../utils/dateTime.js';

export function mapJournalEntry(row, trades = []) {
  return {
    id: row.id,
    entryType: row.entry_type,
    entryDate: mapPostgresDate(row.entry_date),
    title: row.title,
    content: row.content,
    tags: row.tags ?? [],
    isComplete: row.is_complete,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    trades,
  };
}

function mapLinkedTrade(row) {
  return {
    id: row.id,
    accountId: row.account_id,
    symbol: row.symbol,
    entryDatetime: row.entry_datetime,
    exitDatetime: row.exit_datetime,
    status: row.status,
    pnlNet: row.pnl_net == null ? null : Number(row.pnl_net),
  };
}

export function buildListQueryParts(userId, filters = {}) {
  const conditions = ['je.user_id = $1'];
  const params = [userId];
  const add = (value) => {
    params.push(value);
    return `$${params.length}`;
  };

  if (filters.from) conditions.push(`je.entry_date >= ${add(filters.from)}`);
  if (filters.to) conditions.push(`je.entry_date <= ${add(filters.to)}`);
  if (filters.type) conditions.push(`je.entry_type = ${add(filters.type)}`);
  if (filters.status === 'complete') conditions.push('je.is_complete = TRUE');
  if (filters.status === 'incomplete') conditions.push('je.is_complete = FALSE');
  if (filters.search) {
    const ref = add(`%${filters.search}%`);
    conditions.push(`(je.title ILIKE ${ref} OR je.content ILIKE ${ref} OR EXISTS (
      SELECT 1 FROM unnest(je.tags) AS tag WHERE tag ILIKE ${ref}
    ))`);
  }
  if (filters.tradeId) {
    const ref = add(filters.tradeId);
    conditions.push(`EXISTS (
      SELECT 1 FROM journal_entry_trades jet
      WHERE jet.journal_entry_id = je.id
        AND jet.user_id = $1
        AND jet.trade_id = ${ref}
    )`);
  }

  return { where: conditions.join(' AND '), params };
}

async function loadLinkedTrades(queryable, userId, entryIds) {
  if (!entryIds.length) return new Map();
  const result = await queryable.query(
    `SELECT jet.journal_entry_id, t.id, t.account_id, t.symbol, t.entry_datetime,
            t.exit_datetime, t.status, t.pnl_net
     FROM journal_entry_trades jet
     JOIN trades t ON t.id = jet.trade_id AND t.user_id = jet.user_id
     WHERE jet.user_id = $1 AND jet.journal_entry_id = ANY($2::uuid[])
     ORDER BY t.entry_datetime DESC, t.id DESC`,
    [userId, entryIds],
  );
  const grouped = new Map(entryIds.map((id) => [id, []]));
  result.rows.forEach((row) => grouped.get(row.journal_entry_id)?.push(mapLinkedTrade(row)));
  return grouped;
}

export async function listJournalEntries(userId, filters = {}) {
  const { page = 1, limit = 25 } = filters;
  const { where, params } = buildListQueryParts(userId, filters);
  const offset = (page - 1) * limit;
  const [entriesResult, countResult] = await Promise.all([
    pool.query(
      `SELECT je.* FROM journal_entries je
       WHERE ${where}
       ORDER BY je.entry_date DESC, je.created_at DESC, je.id DESC
       LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
      [...params, limit, offset],
    ),
    pool.query(`SELECT COUNT(*) FROM journal_entries je WHERE ${where}`, params),
  ]);
  const links = await loadLinkedTrades(pool, userId, entriesResult.rows.map((row) => row.id));
  const total = Number(countResult.rows[0]?.count ?? 0);
  return {
    entries: entriesResult.rows.map((row) => mapJournalEntry(row, links.get(row.id) ?? [])),
    pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
  };
}

export async function getJournalEntry(userId, entryId, queryable = pool) {
  const result = await queryable.query(
    'SELECT * FROM journal_entries WHERE id = $1 AND user_id = $2',
    [entryId, userId],
  );
  if (!result.rows[0]) throw createError('JOURNAL_ENTRY_NOT_FOUND', 'Journal entry not found.', 404);
  const links = await loadLinkedTrades(queryable, userId, [entryId]);
  return mapJournalEntry(result.rows[0], links.get(entryId) ?? []);
}

export async function getJournalCalendar(userId, month, queryable = pool) {
  const monthStart = `${month}-01`;
  const result = await queryable.query(
    `SELECT entry_date AS date,
            COUNT(*)::int AS total,
            COUNT(*) FILTER (WHERE is_complete)::int AS complete,
            COUNT(*) FILTER (WHERE NOT is_complete)::int AS incomplete,
            ARRAY_AGG(DISTINCT entry_type ORDER BY entry_type) AS entry_types
     FROM journal_entries
     WHERE user_id = $1
       AND entry_date >= $2::date
       AND entry_date < ($2::date + INTERVAL '1 month')
     GROUP BY entry_date
     ORDER BY entry_date ASC`,
    [userId, monthStart],
  );
  return {
    month,
    days: result.rows.map((row) => ({
      date: mapPostgresDate(row.date),
      total: Number(row.total),
      complete: Number(row.complete),
      incomplete: Number(row.incomplete),
      entryTypes: row.entry_types ?? [],
    })),
  };
}

async function assertTradeOwnership(queryable, userId, tradeIds) {
  if (!tradeIds.length) return;
  const result = await queryable.query(
    'SELECT id FROM trades WHERE user_id = $1 AND id = ANY($2::uuid[])',
    [userId, tradeIds],
  );
  if (result.rows.length !== tradeIds.length) {
    throw createError('INVALID_TRADE_LINK', 'One or more linked trades are unavailable.', 400);
  }
}

async function replaceTradeLinks(queryable, userId, entryId, tradeIds) {
  await queryable.query(
    'DELETE FROM journal_entry_trades WHERE journal_entry_id = $1 AND user_id = $2',
    [entryId, userId],
  );
  if (!tradeIds.length) return;
  await queryable.query(
    `INSERT INTO journal_entry_trades (journal_entry_id, trade_id, user_id)
     SELECT $1, trade_id, $2 FROM unnest($3::uuid[]) AS trade_id`,
    [entryId, userId, tradeIds],
  );
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

export async function createJournalEntry(userId, data) {
  return withTransaction(async (client) => {
    await assertTradeOwnership(client, userId, data.tradeIds);
    const result = await client.query(
      `INSERT INTO journal_entries
         (user_id, entry_type, entry_date, title, content, tags, is_complete)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING *`,
      [userId, data.entryType, data.entryDate, data.title, data.content, data.tags, data.isComplete],
    );
    const entry = result.rows[0];
    await replaceTradeLinks(client, userId, entry.id, data.tradeIds);
    const links = await loadLinkedTrades(client, userId, [entry.id]);
    return mapJournalEntry(entry, links.get(entry.id) ?? []);
  });
}

export async function updateJournalEntry(userId, entryId, data) {
  return withTransaction(async (client) => {
    const existingResult = await client.query(
      'SELECT * FROM journal_entries WHERE id = $1 AND user_id = $2 FOR UPDATE',
      [entryId, userId],
    );
    const existing = existingResult.rows[0];
    if (!existing) throw createError('JOURNAL_ENTRY_NOT_FOUND', 'Journal entry not found.', 404);

    if (data.tradeIds !== undefined) await assertTradeOwnership(client, userId, data.tradeIds);
    const result = await client.query(
      `UPDATE journal_entries SET
         entry_type = $3, entry_date = $4, title = $5, content = $6, tags = $7, is_complete = $8
       WHERE id = $1 AND user_id = $2
       RETURNING *`,
      [
        entryId,
        userId,
        data.entryType ?? existing.entry_type,
        data.entryDate ?? mapPostgresDate(existing.entry_date),
        data.title ?? existing.title,
        data.content ?? existing.content,
        data.tags ?? existing.tags,
        data.isComplete ?? existing.is_complete,
      ],
    );
    if (data.tradeIds !== undefined) await replaceTradeLinks(client, userId, entryId, data.tradeIds);
    const links = await loadLinkedTrades(client, userId, [entryId]);
    return mapJournalEntry(result.rows[0], links.get(entryId) ?? []);
  });
}

export async function deleteJournalEntry(userId, entryId) {
  const result = await pool.query(
    'DELETE FROM journal_entries WHERE id = $1 AND user_id = $2 RETURNING id',
    [entryId, userId],
  );
  if (!result.rows[0]) throw createError('JOURNAL_ENTRY_NOT_FOUND', 'Journal entry not found.', 404);
  return { deleted: true, id: entryId };
}
