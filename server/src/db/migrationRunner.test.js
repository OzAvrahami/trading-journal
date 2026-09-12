import assert from 'node:assert/strict';
import { test } from 'node:test';
import { migrationStatements, loadMigrations } from './migrationRunner.js';

test('SQL splitting preserves dollar bodies, quoted semicolons and nested comments', () => {
  const sql = `-- heading\nBEGIN; SELECT ';', 'it''s', "semi;colon"; DO $body$ BEGIN RAISE NOTICE 'x;y'; END; $body$; /* nested /* ; */ comment */ COMMIT;`;
  const result = migrationStatements(sql);
  assert.equal(result.length, 2);
  assert.match(result[1], /BEGIN RAISE NOTICE 'x;y'; END;/);
});
test('unbalanced/unsupported transaction control fails closed', () => {
  for (const sql of ['BEGIN; SELECT 1', 'COMMIT; SELECT 1;', 'BEGIN; COMMIT; COMMIT;', 'SELECT 1; ROLLBACK;', "SELECT 'broken", '/* broken', 'START TRANSACTION; SELECT 1; COMMIT;']) assert.throws(() => migrationStatements(sql));
});
test('reviewed historical and forward migrations load in order without nested transaction control', async () => {
  const migrations = await loadMigrations(new URL('./migrations/', import.meta.url));
  assert.equal(migrations.length, 19);
  assert.equal(migrations[0].filename, '001_init.sql');
  assert.equal(migrations.at(-1).filename, '019_harden_creator_defaults.sql');
  for (const migration of migrations) {
    assert.match(migration.checksum, /^[a-f0-9]{64}$/);
    assert.ok(migration.statements.length);
    assert.ok(migration.statements.every(s => !/^(BEGIN|COMMIT);?$/i.test(s)));
  }
});
