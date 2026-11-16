import pool from '../db/client.js';
import { createError } from '../middleware/errorHandler.js';
import { parseImport } from './importService.js';
import { groupIdentity, pairIdentity, identityHash } from '../utils/captureIdentity.js';
import { toNum } from '../utils/importUtils.js';

const pair = row => pairIdentity(row);
const header = ['symbol','_priceFormat','_priceFormatType','_tickSize','buyFillId','sellFillId','qty','buyPrice','sellPrice','pnl','boughtTimestamp','soldTimestamp','duration'];
const quote = value => `"${String(value).replaceAll('"', '""')}"`;
const csv = rows => Buffer.from([header.join(','), ...rows.map(row => header.map(k => quote(row[k])).join(','))].join('\n'));
const semantic = row => JSON.stringify([row.symbol, row.buyFillId, row.sellFillId, toNum(row.qty), toNum(row.buyPrice), toNum(row.sellPrice), toNum(row.pnl), row.boughtTimestamp, row.soldTimestamp]);
const conflict = (code, message, details = {}) => ({ code, message, ...details });
export const captureLock = (client, userId) => client.query('SELECT pg_advisory_xact_lock(hashtextextended($1, 0))', [`capture-import:${userId}`]);

export async function planCapture(userId, accountId, capture, queryable = pool, { lock = false } = {}) {
  const source = capture.source;
  const conflicts = [];
  const result = await queryable.query('SELECT id, status, base_currency FROM trading_accounts WHERE id=$1 AND user_id=$2' + (lock ? ' FOR UPDATE' : ''), [accountId, userId]);
  const account = result.rows[0];
  if (!account) throw createError('ACCOUNT_NOT_FOUND', 'Account not found.', 404);
  if (account.status !== 'active') conflicts.push(conflict('CAPTURE_ACCOUNT_INACTIVE', 'Select an active internal account.'));
  if (source.financial && account.base_currency !== source.financial.currency) conflicts.push(conflict('CAPTURE_CURRENCY_CONFLICT', 'Source currency differs from the selected account currency.'));
  const mappings = (await queryable.query(`SELECT * FROM capture_accounts WHERE user_id=$1 AND provider=$2
    AND ((environment=$3 AND external_id=$4) OR account_id=$5)`, [userId, source.provider, source.environment, source.account.id, accountId])).rows;
  const mapping = mappings.find(m => m.environment === source.environment && m.external_id === source.account.id);
  if (mappings.some(m => m.account_id !== accountId || m.environment !== source.environment || m.external_id !== source.account.id || m.external_name !== source.account.name)) {
    conflicts.push(conflict('CAPTURE_ACCOUNT_MAPPING_CONFLICT', 'This external identity or internal account already has a different mapping. Resolve the mapping before importing.'));
  }
  // Ownership is checked above; an incompatible mapping must not expose another account's trades.
  if (conflicts.length) return { conflicts, inserted: 0, updated: 0, unchanged: 0, mappingRequired: !mapping };
  const known = mapping ? (await queryable.query(`SELECT p.execution, p.group_id, g.group_key, g.trade_id
    FROM capture_execution_pairs p JOIN capture_trade_groups g ON g.id=p.group_id WHERE p.mapping_id=$1`, [mapping.id])).rows : [];
  const existingPairs = new Map(known.map(r => [pair(r.execution), r]));
  const union = new Map(known.map(r => [pair(r.execution), r.execution]));
  for (const execution of capture.executions) {
    const old = union.get(pair(execution));
    if (old && semantic(old) !== semantic(execution)) conflicts.push(conflict('CAPTURE_EXECUTION_CONFLICT', 'A known buy/sell pair has changed timestamps or economics. Source correction requires review.'));
    else union.set(pair(execution), execution);
  }
  const symbols = [...new Set(capture.rows.map(r => r.symbol))];
  const legacy = (await queryable.query(`SELECT t.id, t.symbol, rr.source_identifier, rr.import_run_id
    FROM trades t LEFT JOIN import_run_rows rr ON rr.trade_id=t.id AND rr.user_id=t.user_id
    WHERE t.user_id=$1 AND t.account_id=$2 AND NOT t.source_managed AND t.symbol=ANY($3::text[])`, [userId, accountId, symbols])).rows;
  const fills = new Set(capture.executions.flatMap(r => [r.buyFillId, r.sellFillId]));
  for (const row of legacy) {
    const ids = row.source_identifier?.split(':');
    if (!ids || ids.length !== 2 || !ids.every(Boolean)) conflicts.push(conflict('CAPTURE_LEGACY_LINEAGE_MISSING', 'An existing trade in this symbol has no evidenced buy/sell lineage. Resolve its identity before importing.', { tradeId: row.id }));
    else if (ids.some(id => fills.has(id))) conflicts.push(conflict('CAPTURE_LEGACY_OVERLAP', 'Existing legacy lineage shares executions with this capture. Historical timestamps and estimated fees will not be rewritten automatically.', { tradeId: row.id, runId: row.import_run_id }));
  }
  let merged;
  try { merged = await parseImport('tradovate', csv([...union.values()]), { sourceOffsetMinutes: 0, sourceIdentity: source }); }
  catch { conflicts.push(conflict('CAPTURE_GROUP_CONFLICT', 'The combined source members contradict an existing opening group.')); }
  const incoming = new Set(capture.rows.map(groupIdentity));
  const groups = (merged?.rows || []).filter(r => incoming.has(groupIdentity(r))).map(row => {
    const key = groupIdentity(row);
    const previous = known.find(r => r.group_key === key);
    const added = row._sourceMembers.filter(m => !existingPairs.has(pair(m)));
    if (previous && !previous.trade_id) conflicts.push(conflict('CAPTURE_DELETED_TRADE', 'A previously imported group was deleted. Resolve its tombstone before re-importing.'));
    return { key, row, previous, added, action: previous ? (added.length ? 'update' : 'unchanged') : 'insert' };
  });
  // Do not overwrite edits made outside this importer, even if the new source is valid.
  if (known.length) {
    const oldRows = await parseImport('tradovate', csv(known.map(r => r.execution)), { sourceOffsetMinutes: 0, sourceIdentity: source });
    const stored = (await queryable.query('SELECT * FROM trades WHERE user_id=$1 AND id=ANY($2::uuid[])', [userId, groups.map(g => g.previous?.trade_id).filter(Boolean)])).rows;
    for (const group of groups.filter(g => g.previous?.trade_id)) {
      const trade = stored.find(t => t.id === group.previous.trade_id);
      const expected = oldRows.rows.find(r => groupIdentity(r) === group.key);
      const exact = trade && trade.source_managed && ['symbol','direction','status'].every(k => trade[k] === expected[k])
        && ['entry_price','exit_price','quantity','pnl_gross'].every(k => Number(trade[k]) === expected[k])
        && ['entry_datetime','exit_datetime'].every(k => new Date(trade[k]).toISOString() === expected[k]) && trade.fees === null && trade.pnl_net === null;
      if (!exact) conflicts.push(conflict('CAPTURE_TRADE_CHANGED', 'Stored source trade values differ from their execution evidence. Resolve the changes before importing.', { tradeId: group.previous.trade_id }));
    }
  }
  return { conflicts: [...new Map(conflicts.map(c => [JSON.stringify(c), c])).values()], mappingRequired: !mapping,
    inserted: groups.filter(g => g.action === 'insert').length, updated: groups.filter(g => g.action === 'update').length,
    unchanged: groups.filter(g => g.action === 'unchanged').length, mapping, groups, existingPairs, union };
}

export const publicCapturePlan = ({ conflicts, mappingRequired, inserted, updated, unchanged }) => ({ conflicts, mappingRequired, inserted, updated, unchanged });

export async function executeCaptureImport(userId, session, accountId, queryable = pool) {
  if (accountId !== session.targetAccountId) throw createError('CAPTURE_TARGET_CHANGED', 'Re-preview the capture after changing the selected account.', 409);
  const client = await queryable.connect();
  try {
    await client.query('BEGIN');
    await captureLock(client, userId);
    // Recheck ownership, mapping, legacy identity and edits under the same transaction lock.
    const capture = session.capture;
    const plan = await planCapture(userId, accountId, capture, client, { lock: true });
    if (plan.conflicts.length) throw createError('CAPTURE_CONFLICT', 'Resolve the capture conflicts before importing.', 409, { conflicts: plan.conflicts });
    const s = capture.source;
    let mapping = plan.mapping;
    if (!mapping) mapping = (await client.query(`INSERT INTO capture_accounts (user_id,account_id,provider,environment,external_id,external_name)
      VALUES ($1,$2,$3,$4,$5,$6) RETURNING *`, [userId, accountId, s.provider, s.environment, s.account.id, s.account.name])).rows[0];
    const repeat = (await client.query('SELECT import_run_id FROM source_captures WHERE mapping_id=$1 AND package_sha256=$2', [mapping.id, session.fileSha256])).rows[0];
    if (repeat) {
      await client.query('COMMIT');
      return { runId: repeat.import_run_id, status: 'completed', repeated: true, inserted: 0, updated: 0, importedRows: 0, skippedRows: capture.sourceRows.length, failedRows: 0, dbDuplicates: capture.sourceRows.length };
    }
    const runId = (await client.query(`INSERT INTO import_runs (user_id,account_id,original_filename,file_size_bytes,file_sha256,source_type,status,total_rows,mapping)
      VALUES ($1,$2,$3,$4,$5,'tradovate-capture','processing',$6,$7) RETURNING id`, [userId, accountId, session.originalFilename, session.fileSizeBytes, session.fileSha256, capture.sourceRows.length, JSON.stringify({ format: 'tradovate-capture', version: 1, mappingId: mapping.id })])).rows[0].id;
    const captureId = (await client.query(`INSERT INTO source_captures (mapping_id,import_run_id,package_sha256,performance_sha256,captured_at,verified_offset_minutes,provenance)
      VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING id`, [mapping.id, runId, session.fileSha256, s.performanceSha256, s.capturedAt, s.verifiedOffsetMinutes, JSON.stringify({ ...s, financial: undefined, financialObservation: s.financial ? { summaryCapturedAt: s.financial.summaryCapturedAt, cashCapturedAt: s.financial.cashCapturedAt, summarySha256: s.financial.summarySha256, cashSha256: s.financial.cashSha256 } : null })])).rows[0].id;
    if (s.financial) {
      const f = s.financial;
      const coverage = { account: s.account, provider: s.provider, environment: s.environment, requestedRange: s.requestedRange, verifiedOffsetMinutes: s.verifiedOffsetMinutes, coverage: f.coverage, sourceRows: f.sourceRows, uniqueFillCount: f.uniqueFillCount, allocation: f.allocation };
      const key = identityHash([s.performanceSha256, coverage, f.summarySha256, f.cashSha256]);
      const snapshot = (await client.query(`INSERT INTO capture_financial_snapshots (mapping_id,evidence_key,coverage,currency,gross,trading_fees,net,summary_captured_at,cash_captured_at,evidence)
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) ON CONFLICT (mapping_id,evidence_key) DO UPDATE SET evidence_key=EXCLUDED.evidence_key RETURNING id`,
      [mapping.id,key,JSON.stringify(coverage),f.currency,f.gross,f.tradingFees,f.net,f.summaryCapturedAt,f.cashCapturedAt,JSON.stringify(f)])).rows[0];
      await client.query('UPDATE source_captures SET financial_snapshot_id=$2 WHERE id=$1', [captureId, snapshot.id]);
    }
    const tradeByPair = new Map();
    for (const g of plan.groups) {
      const r = g.row;
      let tradeId = g.previous?.trade_id;
      let groupId = g.previous?.group_id;
      if (g.action === 'insert') {
        tradeId = (await client.query(`INSERT INTO trades (user_id,account_id,symbol,market,direction,entry_datetime,exit_datetime,entry_price,exit_price,quantity,fees,pnl_gross,pnl_net,duration_minutes,status,notes,dedup_key,source_managed)
          VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,NULL,$11,NULL,$12,'closed',$13,$14,TRUE) RETURNING id`,
        [userId,accountId,r.symbol,r.market,r.direction,r.entry_datetime,r.exit_datetime,r.entry_price,r.exit_price,r.quantity,r.pnl_gross,r.duration_minutes,r.notes,r._dedupKey])).rows[0].id;
        groupId = (await client.query('INSERT INTO capture_trade_groups (mapping_id,group_key,trade_id) VALUES ($1,$2,$3) RETURNING id', [mapping.id,g.key,tradeId])).rows[0].id;
      } else if (g.action === 'update') {
        // Only source-owned fields; preserve notes, classification, risk and other annotations.
        await client.query(`UPDATE trades SET exit_datetime=$3,exit_price=$4,quantity=$5,pnl_gross=$6,duration_minutes=$7
          WHERE id=$1 AND user_id=$2`, [tradeId,userId,r.exit_datetime,r.exit_price,r.quantity,r.pnl_gross,r.duration_minutes]);
      }
      for (const m of r._sourceMembers) tradeByPair.set(pair(m), tradeId);
      for (const m of g.added) await client.query(`INSERT INTO capture_execution_pairs (mapping_id,buy_fill_id,sell_fill_id,group_id,first_capture_id,execution)
        VALUES ($1,$2,$3,$4,$5,$6)`, [mapping.id,m.buyFillId,m.sellFillId,groupId,captureId,JSON.stringify(plan.union.get(pair(m)))]);
    }
    let importedRows = 0;
    const seen = new Set();
    for (const row of capture.sourceRows) {
      const key = pairIdentity({ buyFillId: row._sourceBuyFillId, sellFillId: row._sourceSellFillId });
      const duplicate = seen.has(key) || plan.existingPairs.has(key); seen.add(key);
      if (!duplicate) importedRows++;
      await client.query(`INSERT INTO import_run_rows (import_run_id,user_id,row_number,status,trade_id,symbol,source_identifier)
        VALUES ($1,$2,$3,$4,$5,$6,$7)`, [runId,userId,row._rowIndex,duplicate ? 'skipped_duplicate' : 'imported',tradeByPair.get(key),row.symbol,row._sourceIdentifier]);
    }
    const skippedRows = capture.sourceRows.length - importedRows;
    await client.query("UPDATE import_runs SET status='completed',imported_rows=$2,skipped_rows=$3,completed_at=NOW() WHERE id=$1", [runId,importedRows,skippedRows]);
    await client.query('COMMIT');
    return { runId, status: 'completed', inserted: plan.inserted, updated: plan.updated, importedRows, skippedRows, failedRows: 0, dbDuplicates: skippedRows };
  } catch (error) { await client.query('ROLLBACK'); throw error; }
  finally { client.release(); }
}

export async function guardLegacyCaptureOverlap(userId, accountId, session, client) {
  if (session.sourceType !== 'tradovate') return;
  const known = (await client.query(`SELECT p.buy_fill_id,p.sell_fill_id FROM capture_execution_pairs p JOIN capture_accounts m ON m.id=p.mapping_id
    WHERE m.user_id=$1 AND m.account_id=$2 AND m.provider='tradovate'`, [userId,accountId])).rows;
  const fills = new Set(known.flatMap(r => [r.buy_fill_id,r.sell_fill_id]));
  if (session.sourceRows.some(r => fills.has(r._sourceBuyFillId) || fills.has(r._sourceSellFillId))) throw createError('CAPTURE_LEGACY_OVERLAP', 'This CSV overlaps source-managed executions. Use a validated capture to reconcile them.', 409);
}
