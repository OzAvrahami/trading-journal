import { readFileSync } from 'node:fs';
import { checkServerIdentity } from 'node:tls';

export function databaseRole(value, name = 'DATABASE_ROLE') {
  if (typeof value !== 'string' || !/^[a-z_][a-z0-9_]{0,62}$/.test(value)) throw new Error(`${name} must be a lowercase PostgreSQL role identifier.`);
  return value;
}
function integer(env, name, fallback, maximum) {
  if (env[name] === undefined || env[name] === '') return fallback;
  if (!/^\d+$/.test(env[name]) || Number(env[name]) < 1 || Number(env[name]) > maximum) throw new Error(`${name} must be an integer between 1 and ${maximum}.`);
  return Number(env[name]);
}

// Do not give pg a connectionString: its URL SSL settings override ssl objects.
export function databaseConfig(env = process.env, { migration = false } = {}) {
  const prefix = migration ? 'MIGRATION_DATABASE' : 'DATABASE';
  let url;
  try { url = new URL(env[`${prefix}_URL`]); } catch { throw new Error(`${prefix}_URL must be an explicit PostgreSQL URL.`); }
  const host = url.hostname.replace(/^\[|\]$/g, '');
  if (!['postgres:', 'postgresql:'].includes(url.protocol) || !host || !url.username || url.pathname.length < 2 || url.hash) throw new Error(`${prefix}_URL must specify PostgreSQL host, user and database.`);
  for (const key of url.searchParams.keys()) {
    if (key !== 'sslmode' || url.searchParams.getAll(key).length !== 1) throw new Error(`${prefix}_URL permits only one optional sslmode parameter; use explicit database settings.`);
  }
  const mode = env[`${prefix}_SSL_MODE`] || url.searchParams.get('sslmode') || 'verify-full';
  if (!['verify-full', 'disable'].includes(mode) || (url.searchParams.has('sslmode') && url.searchParams.get('sslmode') !== mode)) throw new Error(`${prefix}_SSL_MODE must be verify-full or disable, without conflicting URL settings.`);
  const local = ['localhost', '127.0.0.1', '::1'].includes(host);
  if (mode === 'disable' && (!local || env.NODE_ENV === 'production')) throw new Error('TLS may be disabled only for explicit loopback development databases outside production.');
  let ca;
  if (env[`${prefix}_SSL_CA_FILE`]) {
    if (mode === 'disable') throw new Error(`${prefix}_SSL_CA_FILE cannot be combined with disabled TLS.`);
    try { ca = readFileSync(env[`${prefix}_SSL_CA_FILE`], 'utf8'); } catch { throw new Error(`${prefix}_SSL_CA_FILE could not be read.`); }
    if (!ca.includes('-----BEGIN CERTIFICATE-----')) throw new Error(`${prefix}_SSL_CA_FILE must contain PEM certificates.`);
  }
  const role = migration || env[`${prefix}_ROLE`] ? databaseRole(env[`${prefix}_ROLE`], `${prefix}_ROLE`) : null;
  if (migration && /-pooler\./i.test(host)) throw new Error('MIGRATION_DATABASE_URL must use a direct endpoint.');
  let user, database, password;
  try { user = decodeURIComponent(url.username); database = decodeURIComponent(url.pathname.slice(1)); password = decodeURIComponent(url.password); }
  catch { throw new Error(`${prefix}_URL contains invalid percent encoding.`); }
  if (!local && !password) throw new Error(`${prefix}_URL must include remote database credentials.`);
  return {
    host, port: Number(url.port || 5432), user, database,
    password: () => password, // No fallback to inherited PGPASSWORD or .pgpass.
    ssl: mode === 'disable' ? false : {
      rejectUnauthorized: true, minVersion: 'TLSv1.2', ...(ca ? { ca } : {}),
      checkServerIdentity: (_servername, cert) => checkServerIdentity(host, cert),
    },
    sslnegotiation: 'postgres', enableChannelBinding: true,
    options: `-c search_path=public${!migration && role ? ` -c role=${role}` : ''}`,
    application_name: migration ? 'trading-journal-migrations' : 'trading-journal-api',
    max: migration ? 1 : integer(env, 'DATABASE_POOL_MAX', 10, 50),
    idleTimeoutMillis: integer(env, 'DATABASE_IDLE_TIMEOUT_MS', 30000, 300000),
    connectionTimeoutMillis: integer(env, 'DATABASE_CONNECT_TIMEOUT_MS', 8000, 60000),
    statement_timeout: integer(env, migration ? 'MIGRATION_STATEMENT_TIMEOUT_MS' : 'DATABASE_STATEMENT_TIMEOUT_MS', migration ? 120000 : 30000, migration ? 3600000 : 300000),
    idle_in_transaction_session_timeout: integer(env, 'DATABASE_IDLE_TRANSACTION_TIMEOUT_MS', 30000, 300000),
  };
}
export function safeDatabaseError(error) {
  return typeof error?.code === 'string' && /^[A-Z0-9_]{2,64}$/.test(error.code) ? error.code : 'DATABASE_ERROR';
}
