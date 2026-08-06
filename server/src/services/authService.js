import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import pool from '../db/client.js';
import { createError } from '../middleware/errorHandler.js';
import { DEFAULT_TIMEZONE, isValidTimezone } from '../utils/dateTime.js';

// ---- Helpers ----------------------------------------------------------------

function hashToken(rawToken) {
  return crypto.createHash('sha256').update(rawToken).digest('hex');
}

function generateAccessToken(user) {
  return jwt.sign(
    { sub: user.id, email: user.email },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN || '15m' }
  );
}

function generateRefreshToken() {
  return crypto.randomBytes(64).toString('hex');
}

async function saveRefreshToken(userId, rawToken, queryable = pool) {
  const tokenHash = hashToken(rawToken);
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days
  await queryable.query(
    'INSERT INTO refresh_tokens (user_id, token_hash, expires_at) VALUES ($1, $2, $3)',
    [userId, tokenHash, expiresAt]
  );
}

async function withTransaction(queryable, work) {
  const client = await queryable.connect();
  try {
    await client.query('BEGIN');
    const value = await work(client);
    await client.query('COMMIT');
    return value;
  } catch (error) {
    try {
      await client.query('ROLLBACK');
    } catch (rollbackError) {
      console.error('Authentication transaction rollback failed.', { code: rollbackError?.code ?? 'UNKNOWN' });
    }
    throw error;
  } finally {
    client.release();
  }
}

export function formatUser(row) {
  return {
    id: row.id,
    email: row.email,
    displayName: row.display_name,
    defaultMarket: row.default_market,
    defaultTimeframe: row.default_timeframe,
    timezone: isValidTimezone(row.timezone) ? row.timezone : DEFAULT_TIMEZONE,
    createdAt: row.created_at,
  };
}

// ---- Public service functions -----------------------------------------------

export async function signup({ email, password, displayName }, queryable = pool) {
  const lowerEmail = email.toLowerCase();
  const passwordHash = await bcrypt.hash(password, 12);
  try {
    return await withTransaction(queryable, async (client) => {
      const existing = await client.query('SELECT id FROM users WHERE email = $1', [lowerEmail]);
      if (existing.rows.length > 0) throw createError('EMAIL_IN_USE', 'An account with this email already exists.', 409);
      const result = await client.query(
        'INSERT INTO users (email, password_hash, display_name) VALUES ($1, $2, $3) RETURNING *',
        [lowerEmail, passwordHash, displayName || null],
      );
      const user = result.rows[0];
      const accessToken = generateAccessToken(user);
      const rawRefreshToken = generateRefreshToken();
      await saveRefreshToken(user.id, rawRefreshToken, client);
      return { user: formatUser(user), accessToken, refreshToken: rawRefreshToken };
    });
  } catch (error) {
    if (error?.code === '23505' && error?.constraint === 'users_email_key') {
      throw createError('EMAIL_IN_USE', 'An account with this email already exists.', 409);
    }
    throw error;
  }
}

export async function login({ email, password }) {
  const result = await pool.query('SELECT * FROM users WHERE email = $1', [email.toLowerCase()]);
  const user = result.rows[0];

  // Use constant-time comparison to prevent timing attacks
  const dummyHash = '$2a$12$XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX';
  const passwordHash = user ? user.password_hash : dummyHash;
  const valid = await bcrypt.compare(password, passwordHash);

  if (!user || !valid) {
    throw createError('INVALID_CREDENTIALS', 'Invalid email or password.', 401);
  }

  const accessToken = generateAccessToken(user);
  const rawRefreshToken = generateRefreshToken();
  await saveRefreshToken(user.id, rawRefreshToken);

  return { user: formatUser(user), accessToken, refreshToken: rawRefreshToken };
}

export async function refresh(rawToken, queryable = pool) {
  const tokenHash = hashToken(rawToken);
  return withTransaction(queryable, async (client) => {
    const result = await client.query(
      `SELECT rt.id AS token_id, rt.user_id, u.email
       FROM refresh_tokens rt
       JOIN users u ON u.id = rt.user_id
       WHERE rt.token_hash = $1 AND rt.expires_at > NOW()
       FOR UPDATE OF rt`,
      [tokenHash],
    );
    if (result.rows.length === 0) throw createError('INVALID_REFRESH_TOKEN', 'Invalid or expired refresh token.', 401);

    const row = result.rows[0];
    await client.query('DELETE FROM refresh_tokens WHERE id = $1 AND user_id = $2', [row.token_id, row.user_id]);
    const user = { id: row.user_id, email: row.email };
    const accessToken = generateAccessToken(user);
    const newRawToken = generateRefreshToken();
    await saveRefreshToken(user.id, newRawToken, client);
    return { accessToken, refreshToken: newRawToken };
  });
}

export async function logout(rawToken) {
  const tokenHash = hashToken(rawToken);
  await pool.query('DELETE FROM refresh_tokens WHERE token_hash = $1', [tokenHash]);
}
