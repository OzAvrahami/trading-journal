import assert from 'node:assert/strict';
import { test } from 'node:test';
import pg from 'pg';
import jwt from 'jsonwebtoken';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { databaseConfig } from './config.js';
import { loadMigrations, runMigrations, migrationStatements } from './migrationRunner.js';
import { assertPublicSchemaSecurity } from './securityCatalog.js';

const testURL = process.env.TJ_TEST_DATABASE_URL;
test('TJ-02 disposable PostgreSQL integration', { skip: !testURL }, async t => {
  const target = new URL(testURL);
  assert.ok(['127.0.0.1', 'localhost'].includes(target.hostname));
  assert.equal(target.pathname, '/tj02_main');
  assert.equal(process.env.TJ_TEST_ALLOW_WRITE, 'tj02-disposable');
  // Never read DATABASE_URL to choose a test destination.
  const base = { NODE_ENV: 'test', DATABASE_URL: testURL, DATABASE_SSL_MODE: 'disable' };
  const admin = new pg.Client(databaseConfig(base));
  await admin.connect();
  const suffix = `${process.pid}_${Date.now()}`;
  const names = ['app', 'repeat', 'atomic'].map(x => `tj02_${x}_${suffix}`);
  const role = `tj02_owner_${process.pid}`;
  const migrator = `tj02_migrator_${process.pid}`;
  const backend = `tj02_backend_${process.pid}`;
  const stranger = `tj02_stranger_${process.pid}`;
  const connections = [];
  let appPool, server;
  const urlFor = (database, user = 'tjtest') => { const url = new URL(testURL); url.pathname = `/${database}`; url.username = user; return url.href; };
  async function connect(database, user = migrator, runtime = false) {
    const client = new pg.Client(databaseConfig({ ...base, DATABASE_URL: urlFor(database, user), ...(runtime ? { DATABASE_ROLE: role } : {}) }));
    client.on('error', () => {});
    await client.connect(); connections.push(client); return client;
  }
  const files = await loadMigrations(new URL('./migrations/', import.meta.url));
  const synthetic = (filename, sql) => ({ filename, checksum: 'a'.repeat(64), statements: migrationStatements(sql) });
  try {
    await admin.query(`CREATE ROLE "${role}" NOLOGIN`);
    for (const user of [migrator, backend, stranger]) await admin.query(`CREATE ROLE "${user}" LOGIN NOINHERIT PASSWORD 'tj02-local-only'`);
    await admin.query(`GRANT "${role}" TO "${migrator}", "${backend}"`);
    for (const name of names) await admin.query(`CREATE DATABASE "${name}" OWNER "${role}"`);
    const migration = await connect(names[0]);
    await t.test('full chain initializes under a non-superuser owner; constraints and ledger are honest', async () => {
      await runMigrations(migration, files, { role });
      const runtime = await connect(names[0], backend, true);
      assert.equal((await runtime.query('SELECT current_user AS role')).rows[0].role, role);
      assert.equal((await runtime.query('SELECT rolsuper FROM pg_roles WHERE rolname=current_user')).rows[0].rolsuper, false);
      const tables = (await runtime.query("SELECT tablename FROM pg_tables WHERE schemaname='public'")).rows;
      assert.equal(tables.length, 20);
      for (const { tablename } of tables) if (tablename !== 'schema_migrations') assert.equal((await runtime.query(`SELECT count(*)::int AS count FROM "${tablename}"`)).rows[0].count, 0);
      const ledger = (await runtime.query('SELECT * FROM schema_migrations ORDER BY filename')).rows;
      assert.equal(ledger.length, 19);
      assert.ok(ledger.every(x => x.checksum?.length === 64 && x.applied_at));
      const constraints = (await runtime.query("SELECT convalidated FROM pg_constraint WHERE conname IN ('trades_exit_fields_consistent','trades_exit_datetime_not_before_entry')")).rows;
      assert.equal(constraints.length, 2); assert.ok(constraints.every(x => x.convalidated));
      const extension = (await runtime.query("SELECT extname FROM pg_extension WHERE extname='pgcrypto'")).rows;
      assert.equal(extension.length, 1);
      await assertPublicSchemaSecurity(runtime);
    });
    await t.test('RLS/owner access and future global defaults deny an untrusted role', async () => {
      const owner = await connect(names[0], backend, true);
      const untrusted = await connect(names[0], stranger);
      await assert.rejects(() => untrusted.query('SELECT * FROM public.users'), { code: '42501' });
      await owner.query("INSERT INTO public.users(email,password_hash) VALUES ('rls-probe@example.test','synthetic-only')");
      await owner.query(`GRANT SELECT ON public.users TO "${stranger}"`);
      assert.equal((await untrusted.query('SELECT count(*)::int AS count FROM public.users')).rows[0].count, 0, 'grants alone must not bypass policy-free RLS');
      assert.equal((await owner.query('SELECT count(*)::int AS count FROM public.users')).rows[0].count, 1);
      await owner.query(`REVOKE SELECT ON public.users FROM "${stranger}"`);
      await owner.query("DELETE FROM public.users WHERE email='rls-probe@example.test'");
      await owner.query('CREATE FUNCTION public.tj02_default_probe() RETURNS integer LANGUAGE sql AS $$ SELECT 1 $$');
      await assert.rejects(() => untrusted.query('SELECT public.tj02_default_probe()'), { code: '42501' });
      await owner.query('CREATE TABLE public.tj02_table_probe(id integer)');
      await assert.rejects(() => untrusted.query('SELECT * FROM public.tj02_table_probe'), { code: '42501' });
      await owner.query('DROP TABLE public.tj02_table_probe');
      await owner.query('DROP FUNCTION public.tj02_default_probe()');
      const flags = (await owner.query("SELECT relrowsecurity, relforcerowsecurity FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public' AND c.relkind='r'")).rows;
      assert.ok(flags.every(x => x.relrowsecurity && !x.relforcerowsecurity));
      await owner.query('ALTER DEFAULT PRIVILEGES GRANT EXECUTE ON FUNCTIONS TO PUBLIC');
      await assert.rejects(() => assertPublicSchemaSecurity(owner), /defaultPrivileges/);
      await owner.query('ALTER DEFAULT PRIVILEGES REVOKE EXECUTE ON FUNCTIONS FROM PUBLIC');
      await assertPublicSchemaSecurity(owner);
    });
    await t.test('rerun preserves ledger timestamps and another empty database initializes equivalently', async () => {
      const first = await connect(names[0], backend, true);
      const original = (await first.query('SELECT * FROM schema_migrations ORDER BY filename')).rows;
      await runMigrations(migration, files, { role });
      assert.deepEqual((await first.query('SELECT * FROM schema_migrations ORDER BY filename')).rows, original);
      const other = await connect(names[1]);
      await runMigrations(other, files, { role });
      const second = await connect(names[1], backend, true);
      const manifest = `SELECT table_name,column_name,data_type,is_nullable,column_default FROM information_schema.columns WHERE table_schema='public' ORDER BY table_name,ordinal_position`;
      assert.deepEqual((await first.query(manifest)).rows, (await second.query(manifest)).rows);
      await assertPublicSchemaSecurity(second);
      const changed = files.map((x, i) => i === 0 ? { ...x, checksum: 'b'.repeat(64) } : x);
      await assert.rejects(() => runMigrations(migration, changed, { role }), /history differs/);
    });
    await t.test('legacy ledger gains nullable checksums without rewriting timestamps; CLI uses only migration connection', async () => {
      const owner = await connect(names[1], backend, true);
      const previous = (await owner.query('SELECT filename,applied_at FROM schema_migrations ORDER BY filename')).rows;
      await owner.query('ALTER TABLE schema_migrations DROP COLUMN checksum');
      const output = execFileSync(process.execPath, [fileURLToPath(new URL('./migrate.js', import.meta.url))], {
        encoding: 'utf8', env: { ...process.env, NODE_ENV:'test', DATABASE_URL:'invalid-runtime-not-used', MIGRATION_DATABASE_URL:urlFor(names[1],migrator), MIGRATION_DATABASE_SSL_MODE:'disable', MIGRATION_DATABASE_ROLE:role, MIGRATION_DATABASE_SSL_CA_FILE:'' },
      });
      assert.match(output, /Legacy checksum unavailable/);
      assert.match(output, /Migration run completed/);
      assert.deepEqual((await owner.query('SELECT filename,applied_at FROM schema_migrations ORDER BY filename')).rows, previous);
      assert.ok((await owner.query('SELECT checksum FROM schema_migrations')).rows.every(x => x.checksum === null));
    });
    await t.test('simultaneous migration runner fails busy without recording work', async () => {
      const holder = await connect(names[0]);
      await holder.query('SELECT pg_advisory_lock(1818584942,2)');
      try { await assert.rejects(() => runMigrations(migration, files, { role }), { code: 'MIGRATION_BUSY' }); }
      finally { await holder.query('SELECT pg_advisory_unlock(1818584942,2)'); }
    });
    const atomic = await connect(names[2]);
    const initial = [synthetic('001_test.sql', 'CREATE TABLE public.test_counter(id integer)')];
    await runMigrations(atomic, initial, { role });
    await t.test('failed SQL or ledger insert rolls back DDL and never records success', async () => {
      const fail = synthetic('002_failure.sql', 'BEGIN; CREATE TABLE public.should_rollback(id integer); SELECT 1/0; COMMIT;');
      await assert.rejects(() => runMigrations(atomic, [...initial, fail], { role }), { code: '22012' });
      const observer = await connect(names[2], backend, true);
      assert.equal((await observer.query("SELECT to_regclass('public.should_rollback') AS name")).rows[0].name, null);
      await observer.query("ALTER TABLE schema_migrations ADD CONSTRAINT reject_test CHECK (filename <> '002_failure.sql')");
      await assert.rejects(() => runMigrations(atomic, [...initial, synthetic('002_failure.sql', 'CREATE TABLE public.should_rollback(id integer)')], { role }), { code: '23514' });
      assert.equal((await observer.query("SELECT to_regclass('public.should_rollback') AS name")).rows[0].name, null);
      assert.equal((await observer.query('SELECT count(*)::int AS count FROM schema_migrations')).rows[0].count, 1);
      await observer.query('ALTER TABLE schema_migrations DROP CONSTRAINT reject_test');
    });
    await t.test('connection termination rolls back incomplete work and releases the migration lock', async () => {
      const interrupted = await connect(names[2]);
      const observer = await connect(names[2], backend, true);
      let started;
      const sleepStarted = new Promise(resolve => { started = resolve; });
      const wrapper = { query: (sql, args) => { const result = interrupted.query(sql, args); if (sql.includes('pg_sleep')) started(); return result; } };
      const running = runMigrations(wrapper, [...initial, synthetic('002_interrupted.sql', 'CREATE TABLE public.interrupted_work(id integer); SELECT pg_sleep(30)')], { role });
      const rejected = assert.rejects(running);
      await sleepStarted;
      await admin.query('SELECT pg_terminate_backend($1)', [interrupted.processID]);
      await rejected;
      assert.equal((await observer.query("SELECT to_regclass('public.interrupted_work') AS name")).rows[0].name, null);
      await runMigrations(atomic, initial, { role });
    });
    await t.test('lost commit acknowledgement is resolved by ledger read, not replay or false success', async () => {
      const completed = synthetic('002_committed.sql', 'CREATE TABLE public.committed_once(id integer)');
      let inserted = false;
      const wrapper = { query: async (sql, args) => {
        const result = await atomic.query(sql, args);
        if (sql.startsWith('INSERT INTO public.schema_migrations')) inserted = true;
        if (sql === 'COMMIT' && inserted) { inserted = false; throw Object.assign(new Error('simulated lost acknowledgement'), { code: 'ECONNRESET' }); }
        return result;
      } };
      await assert.rejects(() => runMigrations(wrapper, [...initial, completed], { role }), { code: 'ECONNRESET' });
      await runMigrations(atomic, [...initial, completed], { role });
      const observer = await connect(names[2], backend, true);
      assert.equal((await observer.query('SELECT count(*)::int AS count FROM schema_migrations')).rows[0].count, 2);
    });
    await t.test('verified TLS succeeds only with trusted CA and matching hostname', async () => {
      assert.ok(process.env.TJ_TEST_CA_FILE, 'Generate the disposable test CA before this test.');
      const trusted = new URL(testURL); trusted.hostname = 'localhost';
      const tlsEnv = { DATABASE_URL: trusted.href, DATABASE_SSL_CA_FILE: process.env.TJ_TEST_CA_FILE };
      const verified = new pg.Client(databaseConfig(tlsEnv));
      await verified.connect();
      assert.equal((await verified.query('SELECT ssl FROM pg_stat_ssl WHERE pid=pg_backend_pid()')).rows[0].ssl, true);
      await verified.end();
      for (const env of [{ DATABASE_URL: trusted.href }, { ...tlsEnv, DATABASE_URL: testURL }]) {
        const rejected = new pg.Client(databaseConfig(env));
        try { await assert.rejects(() => rejected.connect(), e => ['SELF_SIGNED_CERT_IN_CHAIN','UNABLE_TO_VERIFY_LEAF_SIGNATURE','ERR_TLS_CERT_ALTNAME_INVALID'].includes(e.code)); }
        finally { await rejected.end().catch(() => {}); }
      }
    });
    await t.test('HTTP registration, first account, valid refresh and stale sessions', async () => {
      // Override explicitly before importing application modules; no inherited production URL.
      process.env.DATABASE_URL = urlFor(names[0], backend);
      process.env.DATABASE_SSL_MODE = 'disable'; process.env.DATABASE_ROLE = role;
      process.env.NODE_ENV = 'test'; process.env.JWT_SECRET = 'tj02-synthetic-signing-secret';
      const { default: app } = await import('../app.js');
      appPool = (await import('./client.js')).default;
      server = await new Promise(resolve => { const listener = app.listen(0, '127.0.0.1', () => resolve(listener)); });
      const address = `http://127.0.0.1:${server.address().port}`;
      async function request(path, { method = 'GET', body, token, cookie } = {}) {
        const response = await fetch(address + path, { method, headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}), ...(cookie ? { Cookie: cookie } : {}) }, ...(body ? { body: JSON.stringify(body) } : {}) });
        return { response, data: await response.json() };
      }
      const signup = await request('/api/auth/signup', { method: 'POST', body: { email: 'fresh@example.test', password: 'synthetic-password', displayName: 'Fresh test' } });
      assert.equal(signup.response.status, 201);
      const token = signup.data.accessToken;
      const cookie = signup.response.headers.get('set-cookie').split(';')[0];
      assert.deepEqual((await request('/api/accounts', { token })).data, []);
      const created = await request('/api/accounts', { method: 'POST', token, body: { company: 'Test broker', accountNumber: '001', accountName: 'First account', baseCurrency: 'USD', openingBalance: 0 } });
      assert.equal(created.response.status, 201);
      assert.equal((await request('/api/accounts', { token })).data.length, 1);
      const refresh = await request('/api/auth/refresh', { method: 'POST', cookie });
      assert.equal(refresh.response.status, 200);
      const reused = await request('/api/auth/refresh', { method: 'POST', cookie });
      assert.equal(reused.response.status, 401); assert.match(reused.response.headers.get('set-cookie'), /Expires=Thu, 01 Jan 1970/);
      const login = await request('/api/auth/login', { method: 'POST', body: { email: 'fresh@example.test', password: 'synthetic-password' } });
      assert.equal(login.response.status, 200);
      const logoutCookie = login.response.headers.get('set-cookie').split(';')[0];
      const logout = await request('/api/auth/logout', { method:'POST', token:login.data.accessToken, cookie:logoutCookie });
      assert.equal(logout.response.status,200);
      assert.equal((await request('/api/auth/refresh',{method:'POST',cookie:logoutCookie})).response.status,401);
      assert.equal((await appPool.query("SELECT DATE '2026-09-12' AS date")).rows[0].date,'2026-09-12');
      const owner = await connect(names[0], backend, true);
      await owner.query('DELETE FROM users WHERE id=$1', [signup.data.user.id]);
      const stale = await request('/api/accounts', { token });
      assert.equal(stale.response.status, 401); assert.equal(stale.data.error.code, 'SESSION_INVALID');
      assert.match(stale.response.headers.get('set-cookie'), /Expires=Thu, 01 Jan 1970/);
      const invalidRefresh = await request('/api/auth/refresh', { method: 'POST', cookie: login.response.headers.get('set-cookie').split(';')[0] });
      assert.equal(invalidRefresh.response.status, 401);
      const expired = jwt.sign({ sub: signup.data.user.id }, process.env.JWT_SECRET, { expiresIn: -1 });
      const expiry = await request('/api/accounts', { token: expired });
      assert.equal(expiry.data.error.code, 'TOKEN_EXPIRED');
      assert.equal(expiry.response.headers.get('set-cookie'), null, 'expired access token must allow refresh');
    });
  } finally {
    if (server) { server.closeAllConnections(); await new Promise(resolve => server.close(resolve)); }
    if (appPool) await appPool.end();
    await Promise.all(connections.map(c => c.end().catch(() => {})));
    for (const name of names) await admin.query(`DROP DATABASE IF EXISTS "${name}" WITH (FORCE)`);
    for (const name of [migrator, backend, stranger, role]) await admin.query(`DROP ROLE IF EXISTS "${name}"`);
    await admin.end();
  }
});
