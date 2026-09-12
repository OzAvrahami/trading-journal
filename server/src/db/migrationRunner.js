import { createHash } from 'node:crypto';
import { readdir, readFile } from 'node:fs/promises';
import { databaseRole } from './config.js';

export class MigrationError extends Error {
  constructor(message, code = 'MIGRATION_PREFLIGHT') { super(message); this.code = code; }
}

// Split top-level statements, preserving quoted text and PL/pgSQL bodies.
export function migrationStatements(sql) {
  const statements = [];
  let text = '', quote = null, block = 0, line = false;
  for (let i = 0; i < sql.length; i++) {
    const c = sql[i], next = sql[i + 1];
    if (line) { if (c === '\n') { line = false; text += '\n'; } continue; }
    if (block) {
      if (c === '/' && next === '*') { block++; i++; }
      else if (c === '*' && next === '/') { block--; i++; text += ' '; }
      continue;
    }
    if (quote) {
      if (quote.startsWith('$')) {
        if (sql.startsWith(quote, i)) { text += quote; i += quote.length - 1; quote = null; }
        else text += c;
      } else {
        text += c;
        if (c === '\\' && quote === 'E') text += sql[++i] || '';
        else if (c === (quote === 'E' ? "'" : quote)) {
          if (next === c) text += sql[++i]; else quote = null;
        }
      }
      continue;
    }
    if (c === '-' && next === '-') { line = true; i++; continue; }
    if (c === '/' && next === '*') { block = 1; i++; continue; }
    if (c === "'" || c === '"') { quote = c === "'" && /(?:^|\W)[eE]$/.test(text) ? 'E' : c; text += c; continue; }
    if (c === '$') {
      const tag = sql.slice(i).match(/^\$(?:[a-zA-Z_][a-zA-Z0-9_]*)?\$/)?.[0];
      if (tag) { quote = tag; text += tag; i += tag.length - 1; continue; }
    }
    if (c === ';') { if (text.trim()) statements.push(text.trim()); text = ''; }
    else text += c;
  }
  if (quote || block) throw new Error('Unterminated SQL quote or comment.');
  if (text.trim()) statements.push(text.trim());
  if (/^BEGIN$/i.test(statements[0] || '') && /^COMMIT$/i.test(statements.at(-1) || '')) { statements.shift(); statements.pop(); }
  if (statements.some(s => /^(BEGIN|COMMIT|END|ROLLBACK|ABORT|SAVEPOINT|RELEASE|START\s+TRANSACTION|PREPARE\s+TRANSACTION)\b/i.test(s))) throw new Error('Only a single outer BEGIN/COMMIT wrapper is supported in migrations.');
  return statements;
}
export async function loadMigrations(directory) {
  const names = (await readdir(directory)).filter(name => name.endsWith('.sql')).sort();
  return Promise.all(names.map(async filename => {
    if (!/^\d{3}_[a-z0-9_]+\.sql$/.test(filename)) throw new Error('Invalid migration filename.');
    const sql = await readFile(new URL(filename, directory), 'utf8');
    return { filename, checksum: createHash('sha256').update(sql.replace(/\r\n/g, '\n')).digest('hex'), statements: migrationStatements(sql) };
  }));
}
export async function runMigrations(client, migrations, { role, log = () => {} } = {}) {
  databaseRole(role, 'MIGRATION_DATABASE_ROLE');
  let locked = false, activeFile = null;
  try {
    const result = await client.query('SELECT pg_try_advisory_lock(1818584942, 2) AS locked');
    if (!result.rows[0].locked) throw Object.assign(new Error('Another migration runner is active; retry after it finishes.'), { code: 'MIGRATION_BUSY' });
    locked = true;
    await client.query(`SET ROLE "${role}"`);
    await client.query('SET search_path TO public');
    await client.query('SET standard_conforming_strings TO on');
    await client.query("SET lock_timeout TO '5s'");
    const privileges = await client.query("SELECT current_user AS role, has_schema_privilege(current_user, 'public', 'USAGE') AND has_schema_privilege(current_user, 'public', 'CREATE') AS allowed, EXISTS(SELECT 1 FROM pg_available_extensions WHERE name='pgcrypto') AS pgcrypto");
    if (privileges.rows[0].role !== role || !privileges.rows[0].allowed || !privileges.rows[0].pgcrypto) throw new MigrationError('Migration role requires public schema USAGE/CREATE and available pgcrypto.');
    const objects = await client.query("SELECT c.relname, pg_get_userbyid(c.relowner) AS owner FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public' AND c.relkind IN ('r','p')");
    if (objects.rows.some(x => x.owner !== role)) throw new MigrationError('Existing public tables must belong to the explicit migration owner; no automatic ownership reassignment.');
    if (!objects.rows.some(x => x.relname === 'schema_migrations') && objects.rows.length) throw new MigrationError('Existing tables without migration history require manual review.');
    await client.query('BEGIN');
    await client.query('CREATE TABLE IF NOT EXISTS public.schema_migrations (filename TEXT PRIMARY KEY, applied_at TIMESTAMPTZ DEFAULT NOW(), checksum TEXT)');
    await client.query('ALTER TABLE public.schema_migrations ADD COLUMN IF NOT EXISTS checksum TEXT');
    await client.query('ALTER DEFAULT PRIVILEGES REVOKE EXECUTE ON FUNCTIONS FROM PUBLIC');
    await client.query('REVOKE CREATE ON SCHEMA public FROM PUBLIC');
    await client.query('COMMIT');
    const applied = (await client.query('SELECT filename, checksum FROM public.schema_migrations ORDER BY filename')).rows;
    if (!applied.length && objects.rows.some(x => x.relname !== 'schema_migrations')) throw new MigrationError('Empty ledger with existing application tables requires manual review.');
    const known = new Map(migrations.map(m => [m.filename, m]));
    for (const [index, entry] of applied.entries()) {
      if (!known.has(entry.filename) || entry.filename !== migrations[index]?.filename || (entry.checksum && entry.checksum !== known.get(entry.filename).checksum)) throw new MigrationError('Migration history differs from the reviewed files or has gaps; no records were rewritten.');
      if (!entry.checksum) log(`Legacy checksum unavailable: ${entry.filename}; recorded timestamp retained.`);
    }
    const appliedNames = new Set(applied.map(x => x.filename));
    for (const migration of migrations) {
      if (appliedNames.has(migration.filename)) { log(`Skipped ${migration.filename}`); continue; }
      activeFile = migration.filename;
      await client.query('BEGIN');
      for (const statement of migration.statements) await client.query(statement);
      await client.query('INSERT INTO public.schema_migrations (filename, checksum) VALUES ($1, $2)', [migration.filename, migration.checksum]);
      const committed = await client.query('COMMIT');
      if (committed.command !== 'COMMIT') throw new MigrationError('Migration transaction did not commit.');
      log(`Applied ${migration.filename}`);
      activeFile = null;
    }
  } catch (error) {
    // A lost connection during COMMIT is uncertain. Atomic DDL+ledger lets a
    // later read resolve the outcome; never patch records or claim success.
    try { await client.query('ROLLBACK'); } catch {}
    error.migrationFile = activeFile;
    throw error;
  } finally {
    if (locked) { try { await client.query('RESET ROLE'); await client.query('SELECT pg_advisory_unlock(1818584942, 2)'); } catch {} }
  }
}
