import pg from 'pg';
const { Pool, types } = pg;

export const POSTGRES_DATE_OID = 1082;
export const parsePostgresDate = (value) => value;

// PostgreSQL DATE is a calendar value, not an instant. Returning the wire value
// prevents the pg default parser from creating a local-midnight Date that can
// shift to the previous day when later formatted through UTC.
types.setTypeParser(POSTGRES_DATE_OID, parsePostgresDate);

const isSupabase = (process.env.DATABASE_URL || '').includes('supabase.co');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  // Supabase direct connections require SSL; rejectUnauthorized: false
  // handles their self-signed intermediate certs without a full CA bundle.
  ssl: isSupabase ? { rejectUnauthorized: false } : false,
  max: 10,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 8000, // Supabase cold-start can take > 2 s
});

pool.on('error', (err) => {
  console.error('Unexpected DB pool error:', err);
  process.exit(-1);
});

export default pool;
