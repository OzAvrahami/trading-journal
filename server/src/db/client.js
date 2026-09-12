import pg from 'pg';
import { databaseConfig, safeDatabaseError } from './config.js';
const { Pool, types } = pg;

export const POSTGRES_DATE_OID = 1082;
export const parsePostgresDate = (value) => value;

// PostgreSQL DATE is a calendar value, not an instant. Returning the wire value
// prevents the pg default parser from creating a local-midnight Date that can
// shift to the previous day when later formatted through UTC.
types.setTypeParser(POSTGRES_DATE_OID, parsePostgresDate);

// Do not read connection credentials merely to import a service with an injected
// test queryable. Startup validates configuration; real DB operations share pg.
let connectionPool;
function getPool() {
  if (!connectionPool) {
    connectionPool = new Pool(databaseConfig());
    connectionPool.on('error', err => {
      // pg removes failed idle clients; subsequent requests can reconnect.
      console.error('Database idle connection failed.', { code: safeDatabaseError(err) });
    });
  }
  return connectionPool;
}
const pool = {
  query: (...args) => getPool().query(...args),
  connect: (...args) => getPool().connect(...args),
  end: () => connectionPool ? connectionPool.end() : Promise.resolve(),
};

export default pool;
