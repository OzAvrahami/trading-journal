import 'dotenv/config';
import pg from 'pg';
import { databaseConfig, safeDatabaseError } from './config.js';
import { loadMigrations, runMigrations, MigrationError } from './migrationRunner.js';

let client;
try {
  const config = databaseConfig(process.env, { migration: true });
  const migrations = await loadMigrations(new URL('./migrations/', import.meta.url));
  client = new pg.Client(config);
  client.on('error', () => {});
  await client.connect();
  await runMigrations(client, migrations, { role: process.env.MIGRATION_DATABASE_ROLE, log: console.log });
  console.log('Migration run completed. Verify schema/security before enabling writes.');
} catch (error) {
  console.error('Migration run failed.', safeDatabaseError(error));
  if (error instanceof MigrationError) console.error(error.message);
  if (/^\d{3}_[a-z0-9_]+\.sql$/.test(error.migrationFile || '')) console.error('Check migration:', error.migrationFile);
  console.error('Check connection/role settings and migration history before retrying. A lost connection during commit requires ledger inspection.');
  if (!client) console.error(error.message);
  process.exitCode = 1;
} finally {
  if (client) await client.end().catch(() => {});
}
