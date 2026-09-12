import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { test } from 'node:test';
import pg from 'pg';
import {
  assertPublicSchemaSecurity,
  securityCatalogQueries,
} from './securityCatalog.js';

const { Pool } = pg;
const migrationsUrl = new URL('./migrations/', import.meta.url);
const securityMigrationUrl = new URL('./migrations/017_secure_public_data_api.sql', import.meta.url);
const migrationRunnerUrl = new URL('./migrationRunner.js', import.meta.url);

function migrationSources() {
  return readdirSync(migrationsUrl)
    .filter((filename) => filename.endsWith('.sql'))
    .sort()
    .map((filename) => readFileSync(new URL(filename, migrationsUrl), 'utf8'));
}

function matchesFrom(sources, pattern) {
  return sources.flatMap((source) => [...source.matchAll(pattern)].map((match) => match[1].toLowerCase()));
}

test('security migration protects every application table created by migration history', () => {
  const sources = migrationSources();
  const migrationRunner = readFileSync(migrationRunnerUrl, 'utf8');
  const securityMigration = readFileSync(securityMigrationUrl, 'utf8');
  const createdTables = new Set([
    ...matchesFrom(sources, /CREATE\s+TABLE\s+IF\s+NOT\s+EXISTS\s+(?:public\.)?([a-z_][a-z0-9_]*)/gi),
    ...matchesFrom([migrationRunner], /CREATE\s+TABLE\s+IF\s+NOT\s+EXISTS\s+(?:public\.)?([a-z_][a-z0-9_]*)/gi),
  ]);
  const rlsTables = new Set(matchesFrom(
    sources,
    /ALTER\s+TABLE\s+public\.([a-z_][a-z0-9_]*)\s+ENABLE\s+ROW\s+LEVEL\s+SECURITY/gi,
  ));
  const publicRevokeBlock = securityMigration.match(
    /REVOKE\s+ALL\s+PRIVILEGES\s+ON\s+TABLE([\s\S]*?)FROM\s+PUBLIC;/i,
  )?.[1] ?? '';
  const publicRevokedTables = new Set(matchesFrom(
    [publicRevokeBlock],
    /public\.([a-z_][a-z0-9_]*)/gi,
  ));
  const apiRevokeBlock = securityMigration.match(
    /DO \$revoke_api_table_privileges\$([\s\S]*?)\$revoke_api_table_privileges\$/i,
  )?.[1] ?? '';
  const apiRevokedTables = new Set(matchesFrom(
    [apiRevokeBlock],
    /public\.([a-z_][a-z0-9_]*)/gi,
  ));

  assert.equal(createdTables.size, 20);
  assert.deepEqual([...rlsTables].sort(), [...createdTables].sort());
  assert.deepEqual([...publicRevokedTables].sort(), [...createdTables].sort());
  assert.deepEqual([...apiRevokedTables].sort(), [...createdTables].sort());
});

test('security migration revokes every application function created by migration history', () => {
  const sources = migrationSources();
  const createdFunctions = new Set(matchesFrom(
    sources,
    /CREATE\s+OR\s+REPLACE\s+FUNCTION\s+(?:public\.)?([a-z_][a-z0-9_]*)\s*\(/gi,
  ));
  const securityMigration = readFileSync(securityMigrationUrl, 'utf8');

  for (const functionName of createdFunctions) {
    assert.match(
      securityMigration,
      new RegExp(`['"]${functionName}['"]`, 'i'),
      `${functionName} must be included in application function privilege revocation`,
    );
  }
  assert.equal(createdFunctions.size, 13);
});

test('security migration is transactional, deny-by-default, and leaves owner bypass behavior intact', () => {
  const sql = readFileSync(securityMigrationUrl, 'utf8');
  const executableSql = sql
    .split('\n')
    .filter((line) => !line.trim().startsWith('--'))
    .join('\n');

  assert.match(sql, /^\s*--[\s\S]*\bBEGIN;/i);
  assert.match(sql, /COMMIT;\s*$/i);
  assert.doesNotMatch(executableSql, /FORCE\s+ROW\s+LEVEL\s+SECURITY/i);
  assert.doesNotMatch(executableSql, /CREATE\s+POLICY/i);
  assert.match(sql, /REVOKE ALL PRIVILEGES ON TABLE[\s\S]*FROM PUBLIC/i);
  assert.match(sql, /ARRAY\['anon', 'authenticated'\]/i);
  assert.match(sql, /REVOKE EXECUTE ON FUNCTION public\.%I\(\) FROM PUBLIC/i);
  assert.match(sql, /dependency\.objid = sequence_class\.oid/i);
  assert.match(sql, /ALTER DEFAULT PRIVILEGES FOR ROLE %I IN SCHEMA public REVOKE ALL PRIVILEGES ON TABLES/i);
  assert.match(sql, /ALTER DEFAULT PRIVILEGES FOR ROLE %I IN SCHEMA public REVOKE EXECUTE ON FUNCTIONS/i);
  assert.match(sql, /ARRAY\[current_user::text, 'postgres', 'supabase_admin'\]/i);
});

test('catalog verifier rejects RLS, API-grant, function, sequence, and default-privilege violations', async () => {
  const responses = [
    [{ object_name: 'trades', rls_disabled: true }],
    [{ object_name: 'update_updated_at_column', arguments: '' }],
    [{ object_name: 'trades_id_seq' }],
    [{ creator_role: 'postgres', object_type: 'r', grantee: 'anon' }],
  ];
  const queryable = { query: async () => ({ rows: responses.shift() }) };

  await assert.rejects(
    () => assertPublicSchemaSecurity(queryable),
    /tables: trades.*functions: update_updated_at_column.*sequences: trades_id_seq.*defaultPrivileges: postgres\/r\/anon/,
  );
});

test('catalog verifier accepts a deny-by-default public schema', async () => {
  let calls = 0;
  const queryable = { query: async () => { calls += 1; return { rows: [] }; } };

  await assert.doesNotReject(() => assertPublicSchemaSecurity(queryable));
  assert.equal(calls, 4);
  assert.match(securityCatalogQueries.tables, /pg_class/);
  assert.match(securityCatalogQueries.tables, /relrowsecurity/);
  assert.match(securityCatalogQueries.functions, /pg_proc/);
  assert.match(securityCatalogQueries.defaultPrivileges, /pg_default_acl/);
});

const securityTestDatabaseUrl = process.env.SECURITY_TEST_DATABASE_URL;

test('migrated disposable PostgreSQL catalog is deny-by-default', {
  skip: securityTestDatabaseUrl
    ? false
    : 'Set SECURITY_TEST_DATABASE_URL to an isolated database with all migrations applied.',
}, async () => {
  const target = new URL(securityTestDatabaseUrl);
  assert.ok(['localhost', '127.0.0.1', '[::1]'].includes(target.hostname));
  assert.match(target.pathname, /^\/tj02_/);
  const pool = new Pool({ connectionString: securityTestDatabaseUrl });
  try {
    await assertPublicSchemaSecurity(pool);
  } finally {
    await pool.end();
  }
});
