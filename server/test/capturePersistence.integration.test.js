import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { localCapturePool, migrateLocalCaptureDatabase } from './helpers/localCaptureDb.js';
import { fixture, artifact } from './helpers/captureFixture.js';
import { parseCapturePackage } from '../src/services/captureService.js';
import { executeImportRun, getImportRun } from '../src/services/importHistoryService.js';
import { planCapture } from '../src/services/capturePersistence.js';
import { identityHash } from '../src/utils/captureIdentity.js';
import * as analytics from '../src/services/analyticsService.js';
import { mapAccount, getAccount } from '../src/services/accountService.js';
import { listLegacyClassifications } from '../src/services/strategiesService.js';
import { computeProgressForGoals } from '../src/services/goalsService.js';
import { computeFields } from '../src/services/tradeService.js';
import { assertPublicSchemaSecurity } from '../src/db/securityCatalog.js';

const session = async (pkg, targetAccountId) => ({ capture: await parseCapturePackage(Buffer.from(JSON.stringify(pkg))),
  targetAccountId, fileSha256: identityHash(pkg), originalFilename: 'synthetic.capture.json', fileSizeBytes: Buffer.byteLength(JSON.stringify(pkg)) });
function subset(indices) {
  const pkg = fixture(); pkg.financialEvidence = null;
  for (const [parent,key] of [[pkg,'performance'],[pkg.timestampEvidence,'comparison']]) {
    const old = parent[key]; const lines = Buffer.from(old.content,'base64').toString().trim().split('\n');
    parent[key] = artifact([lines[0], ...indices.map(i => lines[i])].join('\n')+'\n','Performance','csv',old.metadata.verifiedOffsetMinutes);
  }
  return pkg;
}
test('isolated PostgreSQL capture persistence, reconciliation, rollback and financial coverage', { skip: process.env.CAPTURE_DB_TEST !== '1' }, async t => {
  const db = localCapturePool();
  try {
    await migrateLocalCaptureDatabase(db);
    await assertPublicSchemaSecurity(db);
    const user = randomUUID(), otherUser = randomUUID(), account = randomUUID(), second = randomUUID(), otherAccount = randomUUID();
    await db.query("INSERT INTO users(id,email,password_hash) VALUES ($1,$2,'synthetic'),($3,$4,'synthetic')", [user,`${user}@example.invalid`,otherUser,`${otherUser}@example.invalid`]);
    for (const [id,owner] of [[account,user],[second,user],[otherAccount,otherUser]]) await db.query("INSERT INTO trading_accounts(id,user_id,company,account_number,status) VALUES ($1,$2,'synthetic',$3,'active')",[id,owner,id]);
    const initialPackage=subset([1]);
    for(const [parent,key] of [[initialPackage,'performance'],[initialPackage.timestampEvidence,'comparison']]) {
      const a=parent[key];parent[key]=artifact(Buffer.from(a.content,'base64').toString().replace(',20,',',$20.00,'),'Performance','csv',a.metadata.verifiedOffsetMinutes);
    }
    const first = await session(initialPackage,account), full = await session(fixture(),account);
    let tradeId;
    await t.test('persists new candidates with nullable money, provenance, lineage and UTC instants', async () => {
      assert.equal((await planCapture(user,account,first.capture,db)).inserted,1);
      const result = await executeImportRun(user,first,account,db); assert.equal(result.inserted,1);
      const row = (await db.query('SELECT * FROM trades WHERE user_id=$1',[user])).rows[0]; tradeId=row.id;
      assert.equal(row.fees,null); assert.equal(row.pnl_net,null); assert.equal(Number(row.pnl_gross),20);
      assert.equal(row.entry_datetime.toISOString(),'2026-11-16T10:00:00.000Z');
      const history = await getImportRun(user,result.runId,{},db);
      assert.equal(history.source.verifiedOffsetMinutes,120); assert.equal(history.rows[0].tradeId,tradeId);
      assert.equal(history.source.financial,null);
    });
    await t.test('overlap adds a closing member to the same group, preserves annotations and stores full snapshot separately', async () => {
      await db.query("UPDATE trades SET notes='keep my note',timeframe='5m',risk_amount=50 WHERE id=$1",[tradeId]);
      const plan = await planCapture(user,account,full.capture,db); assert.equal(plan.updated,1); assert.equal(plan.inserted,0);
      const result = await executeImportRun(user,full,account,db); assert.equal(result.updated,1); assert.equal(result.inserted,0);
      const row = (await db.query('SELECT * FROM trades WHERE id=$1',[tradeId])).rows[0];
      assert.equal(Number(row.quantity),2); assert.equal(Number(row.pnl_gross),30); assert.equal(row.fees,null); assert.equal(row.pnl_net,null); assert.equal(row.notes,'keep my note'); assert.equal(Number(row.risk_amount),50);
      const history = await getImportRun(user,result.runId,{},db); assert.equal(history.source.financial.tradingFees,12); assert.equal(history.source.financial.net,18);
      assert.equal(history.rows.length,2); assert.ok(history.rows.every(r => r.tradeId===tradeId));
    });
    await t.test('repeat and concurrent repeat create no additional trades, snapshots or lineage', async () => {
      const before = await counts();
      const results = await Promise.all([executeImportRun(user,full,account,db),executeImportRun(user,full,account,db)]);
      assert.ok(results.every(r=>r.repeated && r.inserted===0)); assert.deepEqual(await counts(),before);
      const later = fixture(); later.performance.metadata.capturedAt='2026-11-16T15:10:00.000Z';
      await executeImportRun(user,await session(later,account),account,db);
      const after=await counts(); assert.equal(after.trades,before.trades); assert.equal(after.snapshots,before.snapshots);
      await executeImportRun(user,first,account,db); assert.equal(Number((await db.query('SELECT quantity FROM trades WHERE id=$1',[tradeId])).rows[0].quantity),2);
    });
    await t.test('mapping and authenticated account isolation; same fill IDs in another environment remain independent', async () => {
      assert.equal((await planCapture(user,second,full.capture,db)).conflicts[0].code,'CAPTURE_ACCOUNT_MAPPING_CONFLICT');
      await assert.rejects(planCapture(otherUser,account,full.capture,db), { code:'ACCOUNT_NOT_FOUND' });
      await assert.rejects(executeImportRun(user,full,second,db),{code:'CAPTURE_TARGET_CHANGED'});
      const separate=fixture(); for (const a of [separate.performance,separate.timestampEvidence.comparison,separate.financialEvidence.performanceSummary,separate.financialEvidence.cashHistory]) a.metadata.environment='live';
      assert.equal((await executeImportRun(user,await session(separate,second),second,db)).inserted,1);
      assert.equal((await executeImportRun(otherUser,await session(fixture(),otherAccount),otherAccount,db)).inserted,1);
    });
    await t.test('rollback includes trades, mapping, snapshots, capture and import history', async () => {
      const rollbackAccount=randomUUID(); await db.query("INSERT INTO trading_accounts(id,user_id,company,account_number) VALUES ($1::uuid,$2,'synthetic',$1::text)",[rollbackAccount,user]);
      const pkg=fixture(); for(const a of [pkg.performance,pkg.timestampEvidence.comparison,pkg.financialEvidence.performanceSummary,pkg.financialEvidence.cashHistory]) a.metadata.account.id='200';
      const before=await counts(); const wrapper={connect:async()=>{const c=await db.connect();return {release:()=>c.release(),query:(sql,values)=>{if(sql.startsWith('INSERT INTO capture_execution_pairs'))throw new Error('injected rollback');return c.query(sql,values);}};}};
      await assert.rejects(executeImportRun(user,await session(pkg,rollbackAccount),rollbackAccount,wrapper),/injected rollback/);
      assert.deepEqual(await counts(),before);
    });
    await t.test('changed pair economics and legacy overlaps/missing lineage block before commit', async () => {
      const changed=subset([1]); for(const [parent,k] of [[changed,'performance'],[changed.timestampEvidence,'comparison']]) {const a=parent[k];parent[k]=artifact(Buffer.from(a.content,'base64').toString().replace(',20,',',$21.00,'),'Performance','csv',a.metadata.verifiedOffsetMinutes);}
      assert.ok((await planCapture(user,account,(await session(changed,account)).capture,db)).conflicts.some(c=>c.code==='CAPTURE_EXECUTION_CONFLICT'));
      const legacyAccount=randomUUID(); await db.query("INSERT INTO trading_accounts(id,user_id,company,account_number) VALUES ($1::uuid,$2,'synthetic',$1::text)",[legacyAccount,user]);
      await db.query(`INSERT INTO trades(user_id,account_id,symbol,market,direction,entry_datetime,entry_price,quantity,status,fees,pnl_net) VALUES ($1,$2,'TEST','futures','short','2026-11-16T12:00:00Z',100,1,'closed',1.9,18.1)`,[user,legacyAccount]);
      assert.ok((await planCapture(user,legacyAccount,full.capture,db)).conflicts.length);
      // Use a separate user's target to test legacy lineage independently of existing external mapping.
      const legacyUser=randomUUID(), target=randomUUID(), legacyTrade=randomUUID(), run=randomUUID();
      await db.query("INSERT INTO users(id,email,password_hash) VALUES ($1,$2,'synthetic')",[legacyUser,`${legacyUser}@example.invalid`]);
      await db.query("INSERT INTO trading_accounts(id,user_id,company,account_number) VALUES ($1::uuid,$2,'synthetic',$1::text)",[target,legacyUser]);
      await db.query("INSERT INTO trades(id,user_id,account_id,symbol,market,direction,entry_datetime,entry_price,quantity) VALUES ($1,$2,$3,'TEST','futures','short','2026-11-16T12:00:00Z',100,1)",[legacyTrade,legacyUser,target]);
      assert.equal((await planCapture(legacyUser,target,full.capture,db)).conflicts[0].code,'CAPTURE_LEGACY_LINEAGE_MISSING');
      await db.query("INSERT INTO import_runs(id,user_id,account_id,original_filename,file_size_bytes,file_sha256,source_type,status,total_rows) VALUES ($1,$2,$3,'legacy.csv',1,$4,'tradovate','processing',1)",[run,legacyUser,target,'0'.repeat(64)]);
      await db.query("INSERT INTO import_run_rows(import_run_id,user_id,row_number,status,trade_id,source_identifier) VALUES ($1,$2,1,'imported',$3,'b1:s1')",[run,legacyUser,legacyTrade]);
      assert.equal((await planCapture(legacyUser,target,full.capture,db)).conflicts[0].code,'CAPTURE_LEGACY_OVERLAP');
      const before=await counts(); await assert.rejects(executeImportRun(legacyUser,await session(fixture(),target),target,db),{code:'CAPTURE_CONFLICT'}); assert.deepEqual(await counts(),before);
    });
    await t.test('unknown differs from real zero; analytics do not sum incomplete net results', async () => {
      await db.query(`INSERT INTO trades(user_id,account_id,symbol,market,direction,entry_datetime,exit_datetime,entry_price,exit_price,quantity,status,fees,pnl_gross,pnl_net)
        VALUES ($1,$2,'ZERO','stocks','long','2026-11-16T13:00:00Z','2026-11-16T13:01:00Z',10,10,1,'closed',0,0,0)`,[user,account]);
      const filters={accountId:account,from:'2026-11-16',to:'2026-11-16'};
      const summary=await analytics.getSummary(user,filters,'UTC',new Date('2026-11-16T20:00:00Z'),db);
      assert.equal(summary.unknownNetCount,1); assert.equal(summary.totals.pnlNet,null); assert.equal(summary.totals.pnlGross,30); assert.equal(summary.totals.totalFees,null); assert.equal(summary.totals.winRate,null);
      assert.equal((await analytics.getEquityCurve(user,filters,'UTC',db)).data.length,0);
      assert.equal((await analytics.getCalendar(user,filters,'UTC',db)).days[0].pnlNet,null);
      assert.equal((await analytics.getDistribution(user,filters,'UTC',db)).buckets.length,0);
      assert.equal((await analytics.getBreakdown(user,{...filters,by:'account'},'UTC',db)).data[0].pnlNet,null);
      assert.equal((await getAccount(user,account,db)).trackedBalance,null);
      assert.equal((await analytics.getDaySummary(user,'2026-11-16','UTC',db)).pnlNet,null);
      assert.equal((await listLegacyClassifications(user,db)).strategies.find(r=>r.unknownNetCount>0).pnlNet,null);
      const goals=await computeProgressForGoals(user,[{id:randomUUID(),metricKey:'net_pnl',comparison:'at_least',targetValue:1,startDate:'2026-11-16',endDate:'2026-11-16',status:'active'}],db,'2026-11-16','UTC');
      assert.equal(goals[0].currentValue,null);assert.equal(goals[0].unavailableReason,'unknown_trade_net');
      assert.equal(mapAccount({unknown_net_count:1,opening_balance:100,pnl_net:0}).trackedBalance,null);
      assert.equal(computeFields({direction:'long',entryPrice:10,exitPrice:10,quantity:1,fees:0,entryDatetime:'2026-11-16T00:00:00Z',exitDatetime:'2026-11-16T00:01:00Z'}).pnlNet,0);
    });
    await t.test('a disjoint new closing pair extends the known opening group without a duplicate trade', async () => {
      const pkg=subset([2]);
      for(const [parent,key] of [[pkg,'performance'],[pkg.timestampEvidence,'comparison']]) {
        const a=parent[key];parent[key]=artifact(Buffer.from(a.content,'base64').toString().replace(',b2,s1,',',b3,s1,').replace(':02:00',':03:00').replace(',10,',',15,'),'Performance','csv',a.metadata.verifiedOffsetMinutes);
      }
      const result=await executeImportRun(user,await session(pkg,account),account,db);
      assert.equal(result.inserted,0);assert.equal(result.updated,1);
      const trade=(await db.query('SELECT * FROM trades WHERE id=$1',[tradeId])).rows[0];
      assert.equal(Number(trade.quantity),3);assert.equal(Number(trade.pnl_gross),45);assert.equal(trade.notes,'keep my note');
    });
    await t.test('deleted source groups leave tombstones instead of recreating trades', async () => {
      await db.query('DELETE FROM trades WHERE id=$1',[tradeId]);
      assert.ok((await planCapture(user,account,full.capture,db)).conflicts.some(c=>c.code==='CAPTURE_DELETED_TRADE'));
    });
    async function counts(){const r=(await db.query(`SELECT (SELECT count(*) FROM trades) AS trades,(SELECT count(*) FROM capture_accounts) AS mappings,(SELECT count(*) FROM source_captures) AS captures,(SELECT count(*) FROM capture_financial_snapshots) AS snapshots,(SELECT count(*) FROM capture_execution_pairs) AS pairs,(SELECT count(*) FROM import_runs) AS runs`)).rows[0];return r;}
  } finally { await db.end(); }
});
