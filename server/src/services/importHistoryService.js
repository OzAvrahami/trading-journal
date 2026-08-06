import pool from '../db/client.js';
import { createError } from '../middleware/errorHandler.js';
import { commitImport } from './importService.js';

const SUCCESS_STATUSES = ['completed', 'completed_with_errors'];

function number(value) { return Number(value ?? 0); }
function bounded(value, max) {
  if (value == null) return null;
  const trimmed = String(value).trim();
  return trimmed ? trimmed.slice(0, max) : null;
}

export function mapImportRun(row, { includeMapping = false } = {}) {
  return {
    id: row.id,
    originalFilename: row.original_filename,
    fileSizeBytes: number(row.file_size_bytes),
    sourceType: row.source_type,
    status: row.status,
    account: row.account_id ? {
      id: row.account_id,
      name: row.account_name,
      company: row.account_company,
      accountNumber: row.account_number,
    } : null,
    totalRows: number(row.total_rows),
    importedRows: number(row.imported_rows),
    skippedRows: number(row.skipped_rows),
    failedRows: number(row.failed_rows),
    failureCode: row.failure_code,
    failureDetail: row.failure_detail,
    startedAt: row.started_at,
    completedAt: row.completed_at,
    createdAt: row.created_at,
    ...(includeMapping ? { fileSha256: row.file_sha256, mapping: row.mapping ?? {} } : {}),
  };
}

export function mapImportRow(row) {
  return {
    rowNumber: number(row.row_number),
    status: row.status,
    tradeId: row.trade_id,
    symbol: row.symbol,
    sourceIdentifier: row.source_identifier,
    errorCode: row.error_code,
    errorDetail: row.error_detail,
    tradeAvailable: Boolean(row.trade_id && row.trade_exists),
  };
}

const RUN_SELECT = `SELECT r.*, a.account_name, a.company AS account_company, a.account_number
  FROM import_runs r LEFT JOIN trading_accounts a ON a.id = r.account_id AND a.user_id = r.user_id`;

export async function findSuccessfulDuplicate(userId, fileSha256, queryable = pool) {
  const result = await queryable.query(
    `${RUN_SELECT} WHERE r.user_id = $1 AND r.file_sha256 = $2 AND r.status = ANY($3::text[])
     ORDER BY r.completed_at DESC LIMIT 1`,
    [userId, fileSha256, SUCCESS_STATUSES],
  );
  return result.rows[0] ? mapImportRun(result.rows[0]) : null;
}

export async function listImportRuns(userId, { limit = 20, offset = 0, status, accountId } = {}, queryable = pool) {
  const result = await queryable.query(
    `${RUN_SELECT}
     WHERE r.user_id = $1 AND ($2::text IS NULL OR r.status = $2)
       AND ($3::uuid IS NULL OR r.account_id = $3)
     ORDER BY r.created_at DESC, r.id DESC LIMIT $4 OFFSET $5`,
    [userId, status ?? null, accountId ?? null, limit, offset],
  );
  const count = await queryable.query(
    `SELECT COUNT(*)::int AS total FROM import_runs
     WHERE user_id = $1 AND ($2::text IS NULL OR status = $2) AND ($3::uuid IS NULL OR account_id = $3)`,
    [userId, status ?? null, accountId ?? null],
  );
  return { runs: result.rows.map(row => mapImportRun(row)), total: number(count.rows[0]?.total), limit, offset };
}

export async function getImportRun(userId, runId, { rowLimit = 100, rowOffset = 0, rowStatus } = {}, queryable = pool) {
  const result = await queryable.query(`${RUN_SELECT} WHERE r.user_id = $1 AND r.id = $2`, [userId, runId]);
  if (!result.rows[0]) throw createError('IMPORT_RUN_NOT_FOUND', 'Import Run not found.', 404);
  const rows = await queryable.query(
    `SELECT rr.*, (t.id IS NOT NULL) AS trade_exists
     FROM import_run_rows rr LEFT JOIN trades t ON t.id = rr.trade_id AND t.user_id = rr.user_id
     WHERE rr.user_id = $1 AND rr.import_run_id = $2
       AND ($3::text IS NULL OR rr.status = $3 OR ($3 = 'failed' AND rr.status IN ('failed_validation','failed_insert')))
     ORDER BY rr.row_number LIMIT $4 OFFSET $5`,
    [userId, runId, rowStatus ?? null, rowLimit, rowOffset],
  );
  const count = await queryable.query(
    `SELECT COUNT(*)::int AS total FROM import_run_rows WHERE user_id = $1 AND import_run_id = $2
     AND ($3::text IS NULL OR status = $3 OR ($3 = 'failed' AND status IN ('failed_validation','failed_insert')))`,
    [userId, runId, rowStatus ?? null],
  );
  return { ...mapImportRun(result.rows[0], { includeMapping: true }), rows: rows.rows.map(mapImportRow), rowTotal: number(count.rows[0]?.total), rowLimit, rowOffset };
}

function duplicateError(run) {
  return createError('IMPORT_DUPLICATE_FILE', 'This exact file has already been imported.', 409, {
    existingRunId: run.id,
    originalFilename: run.originalFilename,
    completedAt: run.completedAt,
    importedRows: run.importedRows,
    skippedRows: run.skippedRows,
    failedRows: run.failedRows,
  });
}

async function insertRowResults(client, runId, userId, rowResults) {
  for (const row of rowResults) {
    await client.query(
      `INSERT INTO import_run_rows
       (import_run_id, user_id, row_number, status, trade_id, symbol, source_identifier, error_code, error_detail)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
      [runId, userId, row.rowNumber, row.status, row.tradeId ?? null, bounded(row.symbol, 32),
        bounded(row.sourceIdentifier, 255), row.errorCode ?? null, bounded(row.errorDetail, 1000)],
    );
  }
}

export async function executeImportRun(userId, session, accountId, queryable = pool) {
  const duplicate = await findSuccessfulDuplicate(userId, session.fileSha256, queryable);
  if (duplicate) throw duplicateError(duplicate);

  const account = await queryable.query(
    'SELECT id, status FROM trading_accounts WHERE id = $1 AND user_id = $2', [accountId, userId],
  );
  if (!account.rows[0]) throw createError('IMPORT_ACCOUNT_NOT_FOUND', 'Account not found.', 404);
  if (account.rows[0].status !== 'active') throw createError('IMPORT_ACCOUNT_ARCHIVED', 'Archived or inactive Accounts cannot receive new imports.', 409);

  const created = await queryable.query(
    `INSERT INTO import_runs
     (user_id, account_id, original_filename, file_size_bytes, file_sha256, source_type, status, total_rows, mapping)
     VALUES ($1,$2,$3,$4,$5,$6,'processing',$7,$8::jsonb) RETURNING id`,
    [userId, accountId, session.originalFilename, session.fileSizeBytes, session.fileSha256,
      session.sourceType, session.sourceRows.length, JSON.stringify(session.mapping)],
  );
  const runId = created.rows[0].id;
  let client;
  try {
    client = await queryable.connect();
    await client.query('BEGIN');
    const committed = await commitImport(userId, session.rows, accountId, client);
    const insertedByKey = new Map(committed.insertedTrades.map(item => [item.dedupKey, item.id]));
    const duplicateKeys = new Set(committed.duplicateKeys);
    const seen = new Set();
    const rowResults = session.sourceRows.map(row => {
      const common = { rowNumber: row._rowIndex, symbol: row.symbol, sourceIdentifier: row._sourceIdentifier ?? row._dedupKey };
      if (row._withinFileDuplicate || seen.has(row._dedupKey) || duplicateKeys.has(row._dedupKey)) {
        seen.add(row._dedupKey);
        return { ...common, status: 'skipped_duplicate', errorCode: 'IMPORT_ROW_DUPLICATE', errorDetail: 'The Trade matched another row or an existing Trade.' };
      }
      seen.add(row._dedupKey);
      return { ...common, status: 'imported', tradeId: insertedByKey.get(row._dedupKey) };
    });
    await insertRowResults(client, runId, userId, rowResults);
    const importedRows = rowResults.filter(row => row.status === 'imported').length;
    const skippedRows = rowResults.filter(row => row.status === 'skipped_duplicate').length;
    const failedRows = rowResults.length - importedRows - skippedRows;
    const status = importedRows > 0 ? (skippedRows || failedRows ? 'completed_with_errors' : 'completed') : 'failed';
    await client.query(
      `UPDATE import_runs SET status=$2, imported_rows=$3, skipped_rows=$4, failed_rows=$5,
       failure_code=$6, failure_detail=$7, completed_at=NOW() WHERE id=$1 AND user_id=$8`,
      [runId, status, importedRows, skippedRows, failedRows,
        status === 'failed' ? 'IMPORT_NO_ROWS_IMPORTED' : null,
        status === 'failed' ? 'No source row produced a new Trade.' : null, userId],
    );
    await client.query('COMMIT');
    return { runId, status, inserted: importedRows, dbDuplicates: skippedRows, totalRows: rowResults.length, importedRows, skippedRows, failedRows };
  } catch (error) {
    if (client) try { await client.query('ROLLBACK'); } catch {}
    try {
      if (!client) {
        await insertRowResults(queryable, runId, userId, session.sourceRows.map(row => ({
          rowNumber: row._rowIndex, status: 'failed_insert', symbol: row.symbol,
          sourceIdentifier: row._sourceIdentifier ?? row._dedupKey,
          errorCode: 'IMPORT_ROW_INSERT_FAILED', errorDetail: 'The import transaction could not begin.',
        })));
        await queryable.query(
          `UPDATE import_runs SET status='failed', imported_rows=0, skipped_rows=0, failed_rows=total_rows,
           failure_code='IMPORT_FATAL_ERROR', failure_detail=$2, completed_at=NOW() WHERE id=$1 AND user_id=$3`,
          [runId, 'The import could not be completed; no Trades were committed.', userId],
        );
        throw error;
      }
      const failureClient = await queryable.connect();
      try {
        await failureClient.query('BEGIN');
        await insertRowResults(failureClient, runId, userId, session.sourceRows.map(row => ({
          rowNumber: row._rowIndex, status: 'failed_insert', symbol: row.symbol,
          sourceIdentifier: row._sourceIdentifier ?? row._dedupKey,
          errorCode: 'IMPORT_ROW_INSERT_FAILED', errorDetail: 'The import transaction was rolled back.',
        })));
        await failureClient.query(
          `UPDATE import_runs SET status='failed', imported_rows=0, skipped_rows=0, failed_rows=total_rows,
           failure_code='IMPORT_FATAL_ERROR', failure_detail=$2, completed_at=NOW() WHERE id=$1 AND user_id=$3`,
          [runId, 'The import could not be completed; no Trades were committed.', userId],
        );
        await failureClient.query('COMMIT');
      } catch (finalizeError) {
        try { await failureClient.query('ROLLBACK'); } catch {}
        error.finalizeError = finalizeError;
      } finally { failureClient.release(); }
    } catch (finalizeError) { error.finalizeError = finalizeError; }
    if (error?.code === '23505') {
      const raced = await findSuccessfulDuplicate(userId, session.fileSha256, queryable);
      if (raced) throw duplicateError(raced);
    }
    error.code = 'IMPORT_FATAL_ERROR';
    error.statusCode = 500;
    error.details = { runId };
    throw error;
  } finally {
    client?.release();
  }
}
