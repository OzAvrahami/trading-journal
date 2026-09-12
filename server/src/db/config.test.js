import assert from 'node:assert/strict';
import { test } from 'node:test';
import { databaseConfig } from './config.js';

const remote = { DATABASE_URL: 'postgresql://user:synthetic-secret@db.example.test/journal' };
test('remote TLS is verified, explicit and cannot be overridden by URL SSL options', () => {
  const config = databaseConfig(remote);
  assert.equal(config.ssl.rejectUnauthorized, true);
  assert.equal(config.connectionString, undefined);
  assert.equal(config.password(), 'synthetic-secret');
  for (const query of ['sslmode=require', 'sslmode=no-verify', 'sslmode=disable', 'ssl=false', 'sslrootcert=x', 'host=localhost', 'options=-c%20role=x', 'sslmode=verify-full&sslmode=disable']) {
    assert.throws(() => databaseConfig({ DATABASE_URL: `${remote.DATABASE_URL}?${query}` }), error => !error.message.includes('synthetic-secret'));
  }
  assert.equal(databaseConfig({ DATABASE_URL: `${remote.DATABASE_URL}?sslmode=verify-full` }).ssl.rejectUnauthorized, true);
  assert.throws(() => databaseConfig({ ...remote, DATABASE_SSL_CA_FILE: '/missing-secret-path' }), error => !error.message.includes('/missing-secret-path'));
});
test('plaintext is opt-in loopback development only; timeouts and roles are bounded', () => {
  const local = { DATABASE_URL: 'postgresql://dev@127.0.0.1/journal', DATABASE_SSL_MODE: 'disable' };
  assert.equal(databaseConfig(local).ssl, false);
  assert.throws(() => databaseConfig({ ...local, NODE_ENV: 'production' }));
  assert.throws(() => databaseConfig({ ...remote, DATABASE_SSL_MODE: 'disable' }));
  assert.throws(() => databaseConfig({ ...local, DATABASE_POOL_MAX: '0' }));
  assert.throws(() => databaseConfig({ ...local, DATABASE_STATEMENT_TIMEOUT_MS: 'Infinity' }));
  assert.throws(() => databaseConfig({ ...local, DATABASE_ROLE: 'owner;RESET ROLE' }));
  assert.equal(databaseConfig({ ...local, DATABASE_ROLE: 'tj_owner' }).options, '-c search_path=public -c role=tj_owner');
});
test('migration URI and role must be explicit and a known pooler is rejected', () => {
  assert.throws(() => databaseConfig(remote, { migration: true }));
  const env = { MIGRATION_DATABASE_URL: remote.DATABASE_URL, MIGRATION_DATABASE_ROLE: 'tj_owner' };
  assert.equal(databaseConfig(env, { migration: true }).max, 1);
  assert.throws(() => databaseConfig({ ...env, MIGRATION_DATABASE_ROLE: '' }, { migration: true }));
  assert.throws(() => databaseConfig({ ...env, MIGRATION_DATABASE_URL: 'postgres://u:p@ep-name-pooler.example.test/db' }, { migration: true }));
});
