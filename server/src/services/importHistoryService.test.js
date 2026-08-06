import test, { describe } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { executeImportRun, getImportRun, listImportRuns } from './importHistoryService.js';

const migrationUrl = new URL('../db/migrations/013_import_history.sql', import.meta.url);
const routesUrl = new URL('../routes/importRoutes.js', import.meta.url);

describe('Import History migration contract', () => {
  test('creates bounded owned Runs and row results without raw files or rows', async () => {
    const sql = await readFile(migrationUrl, 'utf8');
    assert.match(sql, /CREATE TABLE IF NOT EXISTS import_runs/i);
    assert.match(sql, /CREATE TABLE IF NOT EXISTS import_run_rows/i);
    assert.match(sql, /file_sha256 ~ '\^\[0-9a-f\]\{64\}\$'/i);
    assert.match(sql, /WHERE status IN \('completed', 'completed_with_errors'\)/i);
    assert.match(sql, /UNIQUE \(import_run_id, row_number\)/i);
    assert.match(sql, /enforce_import_run_ownership/i);
    assert.match(sql, /enforce_import_run_row_ownership/i);
    assert.doesNotMatch(sql, /raw_(?:row|csv)|file_(?:bytes|content)|BYTEA/i);
    assert.doesNotMatch(sql, /\b(?:DELETE\s+FROM|TRUNCATE|DROP\s+TABLE)\b/i);
    assert.match(sql, /^BEGIN;/);
    assert.match(sql, /COMMIT;\s*$/);
  });
});

test('file identity is server-authoritative over uploaded bytes and preview creates no Run', async () => {
  const source = await readFile(routesUrl, 'utf8');
  const parseBlock = source.slice(source.indexOf("router.post('/parse'"), source.indexOf("router.post('/commit'"));
  assert.match(parseBlock, /createHash\('sha256'\)\.update\(req\.file\.buffer\)\.digest\('hex'\)/);
  assert.doesNotMatch(parseBlock, /INSERT INTO import_runs/);
  assert.doesNotMatch(source, /forceImport|forceDuplicate|Math\.random/);
});

describe('Import History queries', () => {
  test('same successful hash is blocked for that user before Account or Run creation', async () => {
    const calls = [];
    const queryable = { query: async (sql, params) => {
      calls.push({ sql, params });
      return { rows: [{ id: 'existing', user_id: 'owner', original_filename: 'prior.csv', file_size_bytes: 1, file_sha256: 'a'.repeat(64), source_type: 'topstepx', status: 'completed', imported_rows: 1, skipped_rows: 0, failed_rows: 0, completed_at: '2026-08-04T00:00:00Z' }] };
    } };
    await assert.rejects(() => executeImportRun('owner', { fileSha256: 'a'.repeat(64) }, 'account', queryable), error => {
      assert.equal(error.code, 'IMPORT_DUPLICATE_FILE');
      assert.equal(error.details.existingRunId, 'existing');
      return true;
    });
    assert.equal(calls.length, 1);
    assert.equal(calls[0].params[0], 'owner');
  });

  test('list and detail keep ownership parameterized and expose no raw payload', async () => {
    const calls = [];
    const queryable = { query: async (sql, params) => {
      calls.push({ sql, params });
      if (/COUNT\(\*\)/.test(sql)) return { rows: [{ total: 1 }] };
      if (/FROM import_run_rows/.test(sql)) return { rows: [{ row_number: 2, status: 'imported', trade_id: 'trade', trade_exists: true }] };
      return { rows: [{ id: 'run', user_id: 'owner', original_filename: 'trades.csv', file_size_bytes: 12, file_sha256: 'a'.repeat(64), source_type: 'topstepx', status: 'completed', total_rows: 1, imported_rows: 1, skipped_rows: 0, failed_rows: 0, mapping: { importer: 'topstepx' } }] };
    } };
    const listed = await listImportRuns('owner', { limit: 10, offset: 0 }, queryable);
    const detail = await getImportRun('owner', 'run', {}, queryable);
    assert.equal(listed.total, 1);
    assert.deepEqual(detail.mapping, { importer: 'topstepx' });
    assert.equal(detail.rows[0].tradeAvailable, true);
    assert.ok(calls.every(call => call.params[0] === 'owner'));
    assert.doesNotMatch(JSON.stringify({ listed, detail }), /rawRow|csvText|fileBytes/);
  });

  test('confirmed import uses one Trade transaction and persists one result per source row', async () => {
    const poolCalls = [];
    const clientCalls = [];
    const client = { query: async (sql, params) => {
      clientCalls.push({ sql, params });
      if (/SELECT dedup_key FROM trades/.test(sql)) return { rows: [] };
      if (/INSERT INTO trades/.test(sql)) return { rows: [{ id: 'trade-1', dedup_key: 'dedup-1' }] };
      return { rows: [], rowCount: 1 };
    }, release() {} };
    const queryable = { query: async (sql, params) => {
      poolCalls.push({ sql, params });
      if (/FROM import_runs r/.test(sql)) return { rows: [] };
      if (/SELECT id, status FROM trading_accounts/.test(sql)) return { rows: [{ id: 'account', status: 'active' }] };
      if (/INSERT INTO import_runs/.test(sql)) return { rows: [{ id: 'run-1' }] };
      return { rows: [] };
    }, connect: async () => client };
    const row = { _rowIndex: 2, _dedupKey: 'dedup-1', _withinFileDuplicate: false, symbol: 'NQ', market: 'futures', direction: 'long', entry_datetime: '2026-08-04T10:00:00Z', exit_datetime: '2026-08-04T10:05:00Z', entry_price: 1, exit_price: 2, quantity: 1, fees: 1, pnl_gross: 11, pnl_net: 10, duration_minutes: 5, status: 'closed', notes: null, strategy: null, setup: null, timeframe: null, risk_amount: null, stop_loss: null, take_profit: null, r_multiple: null, emotions: null, screenshot_links: null };
    const result = await executeImportRun('owner', { rows: [row], sourceRows: [row], fileSha256: 'a'.repeat(64), originalFilename: 'trades.csv', fileSizeBytes: 42, sourceType: 'topstepx', mapping: { importer: 'topstepx' } }, 'account', queryable);
    assert.equal(result.status, 'completed');
    assert.equal(result.importedRows, 1);
    assert.deepEqual(clientCalls.filter(call => /^(BEGIN|COMMIT)$/.test(call.sql)).map(call => call.sql), ['BEGIN', 'COMMIT']);
    assert.equal(clientCalls.filter(call => /INSERT INTO import_run_rows/.test(call.sql)).length, 1);
    assert.ok(poolCalls.some(call => /INSERT INTO import_runs/.test(call.sql) && call.sql.includes("'processing'")));
  });

  test('fatal insertion rolls back Trades, records failed row results, and never commits', async () => {
    const transactionCalls = [];
    const failureCalls = [];
    const transactionClient = { query: async (sql) => {
      transactionCalls.push(sql);
      if (/SELECT dedup_key FROM trades/.test(sql)) return { rows: [] };
      if (/INSERT INTO trades/.test(sql)) throw new Error('insert failed');
      return { rows: [] };
    }, release() {} };
    const failureClient = { query: async (sql) => { failureCalls.push(sql); return { rows: [] }; }, release() {} };
    let connections = 0;
    const queryable = { query: async (sql) => {
      if (/FROM import_runs r/.test(sql)) return { rows: [] };
      if (/SELECT id, status FROM trading_accounts/.test(sql)) return { rows: [{ id: 'account', status: 'active' }] };
      if (/INSERT INTO import_runs/.test(sql)) return { rows: [{ id: 'run-2' }] };
      return { rows: [] };
    }, connect: async () => (++connections === 1 ? transactionClient : failureClient) };
    const row = { _rowIndex: 2, _dedupKey: 'dedup-2', _withinFileDuplicate: false, symbol: 'ES', market: 'futures', direction: 'long', entry_datetime: '2026-08-04T10:00:00Z', exit_datetime: '2026-08-04T10:05:00Z', entry_price: 1, exit_price: 2, quantity: 1, fees: 1, pnl_gross: 11, pnl_net: 10, duration_minutes: 5, status: 'closed' };
    await assert.rejects(() => executeImportRun('owner', { rows: [row], sourceRows: [row], fileSha256: 'b'.repeat(64), originalFilename: 'bad.csv', fileSizeBytes: 12, sourceType: 'topstepx', mapping: { importer: 'topstepx' } }, 'account', queryable), /insert failed/);
    assert.ok(transactionCalls.includes('ROLLBACK'));
    assert.equal(transactionCalls.includes('COMMIT'), false);
    assert.ok(failureCalls.some(sql => /INSERT INTO import_run_rows/.test(sql)));
    assert.ok(failureCalls.some(sql => /status='failed'/.test(sql)));
    assert.ok(failureCalls.includes('COMMIT'));
  });
});
