import pg from 'pg';
import { loadMigrations, runMigrations } from '../../src/db/migrationRunner.js';

// Deliberately no environment/database URL fallback or .env loading.
// Only the separately named disposable Docker database can be used here.
export function localCapturePool() {
  return new pg.Pool({ host: '127.0.0.1', port: 55438, database: 'capture_test', user: 'capture_test',
    password: 'local-synthetic-only', ssl: false, connectionTimeoutMillis: 3000, max: 5 });
}
export async function migrateLocalCaptureDatabase(pool) {
  const client = await pool.connect();
  try {
    const identity = (await client.query('SELECT current_database() AS db, current_user AS role')).rows[0];
    if (identity.db !== 'capture_test' || identity.role !== 'capture_test') throw new Error('Wrong disposable database identity');
    await runMigrations(client, await loadMigrations(new URL('../../src/db/migrations/', import.meta.url)), { role: 'capture_test' });
  } finally { client.release(); }
}
