import { getImporter } from '../importers/index.js';
import { buildDedupKey } from '../utils/importUtils.js';
import pool from '../db/client.js';

const PREVIEW_LIMIT = 20;
const BATCH_SIZE = 400;

const INSERT_COLS = [
  'user_id', 'account_id', 'symbol', 'market', 'direction',
  'entry_datetime', 'exit_datetime', 'entry_price', 'exit_price',
  'quantity', 'fees', 'pnl_gross', 'pnl_net', 'duration_minutes',
  'status', 'notes', 'strategy', 'setup', 'timeframe',
  'risk_amount', 'stop_loss', 'take_profit', 'r_multiple',
  'emotions', 'screenshot_links', 'dedup_key',
];

/**
 * Parse a CSV buffer for the given broker, run in-file deduplication,
 * and return a preview plus stats. Does NOT write to the database.
 */
export async function parseImport(broker, csvBuffer) {
  const parse = getImporter(broker);
  const allRows = parse(csvBuffer);

  // Level 1: within-file dedup
  const seen = new Set();
  const unique = [];
  const inFileDups = [];

  for (const row of allRows) {
    const key = buildDedupKey(row);
    if (seen.has(key)) {
      inFileDups.push(row._rowIndex);
      row._dedupKey = key;
      row._withinFileDuplicate = true;
    } else {
      seen.add(key);
      row._dedupKey = key;
      row._withinFileDuplicate = false;
      unique.push(row);
    }
  }

  return {
    preview: unique.slice(0, PREVIEW_LIMIT),
    stats: {
      total: allRows.length,
      uniqueInFile: unique.length,
      inFileDuplicates: inFileDups.length,
    },
    rows: unique,
    sourceRows: allRows,
  };
}

/**
 * Commit pre-parsed rows for a user:
 *   1. Query DB for existing dedup keys (Level 2 dedup).
 *   2. Filter out already-imported rows.
 *   3. Batch-insert the new rows under the given accountId.
 */
export async function commitImport(userId, rows, accountId, queryable = pool) {
  // Level 2: check which keys already exist in the DB for this account
  const incomingKeys = rows.map(r => r._dedupKey);

  const { rows: existing } = await queryable.query(
    'SELECT dedup_key FROM trades WHERE account_id = $1 AND dedup_key = ANY($2::text[])',
    [accountId, incomingKeys]
  );

  const existingKeys = new Set(existing.map(r => r.dedup_key));
  const toInsert = rows.filter(r => !existingKeys.has(r._dedupKey));
  const dbDuplicates = rows.length - toInsert.length;

  if (toInsert.length === 0) {
    return { inserted: 0, dbDuplicates, insertedTrades: [], duplicateKeys: [...existingKeys] };
  }

  // Batch insert using parameterized VALUES
  let insertedCount = 0;
  const insertedTrades = [];
  for (let i = 0; i < toInsert.length; i += BATCH_SIZE) {
    const batch = toInsert.slice(i, i + BATCH_SIZE);
    const values = [];

    const placeholders = batch.map((row, idx) => {
      const base = idx * INSERT_COLS.length;
      values.push(
        userId,
        accountId,
        row.symbol,         row.market,          row.direction,
        row.entry_datetime, row.exit_datetime,
        row.entry_price,    row.exit_price,
        row.quantity,       row.fees,
        row.pnl_gross,      row.pnl_net,          row.duration_minutes,
        row.status,         row.notes,
        row.strategy,       row.setup,            row.timeframe,
        row.risk_amount,    row.stop_loss,        row.take_profit,
        row.r_multiple,     row.emotions,         row.screenshot_links,
        row._dedupKey,
      );
      return `(${INSERT_COLS.map((_, j) => `$${base + j + 1}`).join(', ')})`;
    });

    const result = await queryable.query(
      `INSERT INTO trades (${INSERT_COLS.join(', ')}) VALUES ${placeholders.join(', ')} RETURNING id, dedup_key`,
      values
    );
    insertedTrades.push(...result.rows.map(row => ({ id: row.id, dedupKey: row.dedup_key })));
    insertedCount += batch.length;
  }

  return { inserted: insertedCount, dbDuplicates, insertedTrades, duplicateKeys: [...existingKeys] };
}
