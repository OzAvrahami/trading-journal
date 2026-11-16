import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { parseCapturePackage } from './captureService.js';
import { parseImport, commitImport } from './importService.js';
import { sourceTimestamp } from '../utils/sourceTimestamp.js';
import { fixture, artifact } from '../../test/helpers/captureFixture.js';
const parse = pkg => parseCapturePackage(Buffer.from(JSON.stringify(pkg)));

test('capture reuses opening-fill grouping/lineage, normalizes time and leaves trade fees/net unknown', async () => {
  const result = await parse(fixture());
  assert.equal(result.stats.sourceRowCount, 2); assert.equal(result.stats.logicalTradeCount, 1);
  assert.equal(result.stats.tradesToImport, 0); assert.equal(result.stats.candidateCount, 1);
  const row = result.rows[0];
  assert.equal(row._sourceMembers.length, 2); assert.equal(row.direction, 'short');
  assert.equal(row.entry_datetime, '2026-11-16T10:00:00.000Z'); assert.equal(row.exit_datetime, '2026-11-16T10:02:00.000Z');
  assert.equal(row.duration_minutes, 2); assert.equal(row.pnl_gross, 30);
  assert.equal(row.fees, null); assert.equal(row.pnl_net, null);
  assert.equal(result.source.financial.tradingFees, 12); assert.equal(result.source.financial.net, 18);
  await assert.rejects(commitImport('u', result.rows, 'a', { query() { assert.fail('No DB calls'); } }), { code: 'CAPTURE_PERSISTENCE_REQUIRED' });
});

test('UTC and Jerusalem host processes produce identical complete rows/keys without runtime TZ changes', () => {
  const code = `import {fixture} from './server/test/helpers/captureFixture.js'; import {parseCapturePackage} from './server/src/services/captureService.js'; console.log(JSON.stringify((await parseCapturePackage(Buffer.from(JSON.stringify(fixture())))).rows));`;
  const outputs = ['UTC', 'Asia/Jerusalem'].map(TZ => {
    const r = spawnSync(process.execPath, ['--input-type=module', '-e', code], { cwd: new URL('../../..', import.meta.url), env: { ...process.env, TZ }, encoding: 'utf8' });
    assert.equal(r.status, 0, r.stderr); return r.stdout;
  });
  assert.equal(outputs[0], outputs[1]);
});

test('offset parsing supports UTC, negative and fractional-hour offsets, and rejects invalid wall dates', () => {
  assert.equal(sourceTimestamp('11/16/2026 01:02:03', 0), '2026-11-16T01:02:03.000Z');
  assert.equal(sourceTimestamp('11/16/2026 01:02:03', -330), '2026-11-16T06:32:03.000Z');
  assert.equal(sourceTimestamp('11/16/2026 01:02:03', 345), '2026-11-15T19:17:03.000Z');
  for (const value of ['02/30/2026 01:00:00', '11/16/2026 24:00:00', '2026-11-16T00:00:00', '11/16/2026 12:60:00']) assert.throws(() => sourceTimestamp(value, 120));
  assert.throws(() => sourceTimestamp('11/16/2026 01:00:00', null));
});

test('absent finance is explicit unknown; missing/contradictory metadata and mixed summary are rejected', async () => {
  const pkg = fixture(); pkg.financialEvidence = null;
  const result = await parse(pkg); assert.equal(result.source.financial, null); assert.deepEqual(result.source.warnings, ['financial-unavailable']);
  for (const mutate of [
    p => { delete p.performance.metadata.verifiedOffsetMinutes; }, p => { p.performance.metadata.verifiedOffsetMinutes = 0; },
    p => { p.timestampEvidence.comparison.metadata.account.id = '200'; },
    p => { p.financialEvidence.performanceSha256 = '0'.repeat(64); },
    p => { p.financialEvidence.cashHistory.metadata.environment = 'live'; },
    p => { p.financialEvidence.coverage = 'trading-session'; },
    p => { p.performance.content += 'bad'; }, p => { p.version = 2; },
    p => { p.performance.metadata.credentials = { password: 'not-permitted' }; },
  ]) { const bad = fixture(); mutate(bad); await assert.rejects(parse(bad)); }
  const mixed = fixture();
  mixed.financialEvidence.performanceSummary = artifact('<table>'+Object.entries({ 'Gross P/L':'40', 'Trade Fees &amp; Comm.':'(12)', 'Total P/L':'28', '# of Trades':'3', '# of Contracts':'6' }).map(([k,v])=>`<tr><td>${k}</td><td>${v}</td></tr>`).join('')+'</table>', 'Performance','html');
  await assert.rejects(parse(mixed), { code: 'CAPTURE_FINANCIAL_CONFLICT' });
});

test('cash missing an execution fee cannot claim exact coverage', async () => {
  const pkg = fixture(); const item = pkg.financialEvidence.cashHistory;
  const lines = Buffer.from(item.content, 'base64').toString().split('\n'); lines.splice(1, 1);
  pkg.financialEvidence.cashHistory = artifact(lines.join('\n'), 'Cash History', 'csv');
  await assert.rejects(parse(pkg), { code: 'CAPTURE_FINANCIAL_COVERAGE' });
});

test('shifted comparison sets are allowed with coverage disclosure, contradictory shared timestamps are rejected', async () => {
  const pkg = fixture(); pkg.financialEvidence = null;
  const comparison = Buffer.from(pkg.timestampEvidence.comparison.content, 'base64').toString().split('\n');
  comparison.splice(2, 1);
  pkg.timestampEvidence.comparison = artifact(comparison.join('\n'), 'Performance', 'csv', 0);
  const result = await parse(pkg);
  assert.equal(result.source.timestampEvidence.sharedPairs, 1);
  assert.ok(result.source.warnings.includes('partial-timezone-comparison'));
  pkg.timestampEvidence.comparison = artifact(comparison.join('\n').replace('10:01:00', '11:01:00'), 'Performance', 'csv', 0);
  await assert.rejects(parse(pkg), { code: 'CAPTURE_OFFSET_CONFLICT' });
});

test('a source execution crossing the financial interval requires more coverage evidence', async () => {
  const pkg = fixture();
  const source = Buffer.from(pkg.performance.content, 'base64').toString().replaceAll('11/16/2026 12:00:00', '11/15/2026 23:59:00');
  const comparison = Buffer.from(pkg.timestampEvidence.comparison.content, 'base64').toString().replaceAll('11/16/2026 10:00:00', '11/15/2026 21:59:00');
  pkg.performance = artifact(source, 'Performance', 'csv');
  pkg.timestampEvidence.comparison = artifact(comparison, 'Performance', 'csv', 0);
  pkg.financialEvidence.performanceSha256 = pkg.performance.sha256;
  await assert.rejects(parse(pkg), { code: 'CAPTURE_FINANCIAL_COVERAGE' });
});

test('legacy CSV continues estimating fees and net using the existing behavior', async () => {
  const pkg = fixture(); const result = await parseImport('tradovate', Buffer.from(pkg.performance.content, 'base64'));
  assert.equal(result.rows[0].fees, 3.8); assert.equal(result.rows[0].pnl_net, 26.2); assert.equal(result.rows[0]._requiresCapturePersistence, undefined);
});

test('different evidenced opening groups with identical economic timestamp keys remain distinct', async () => {
  const pkg = fixture(); pkg.financialEvidence = null;
  for (const [parent,key] of [[pkg,'performance'],[pkg.timestampEvidence,'comparison']]) {
    const a=parent[key], lines=Buffer.from(a.content,'base64').toString().trim().split('\n');
    parent[key]=artifact([lines[0],lines[1],lines[1].replace(',b1,s1,',',b3,s3,')].join('\n'),'Performance','csv',a.metadata.verifiedOffsetMinutes);
  }
  const result=await parse(pkg);
  assert.equal(result.rows.length,2);
  assert.notEqual(result.rows[0]._dedupKey,result.rows[1]._dedupKey);
});
