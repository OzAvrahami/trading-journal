import pool from '../db/client.js';
import { createError } from '../middleware/errorHandler.js';

function mapDefaultAccount(row) {
  if (!row.default_account_id) return null;
  return {
    id: row.default_account_id,
    accountName: row.default_account_name,
    company: row.default_account_company,
    accountNumber: row.default_account_number,
    status: row.default_account_status,
    baseCurrency: row.default_account_currency,
  };
}

export function mapPreferences(row) {
  return {
    locale: row.locale ?? null,
    theme: row.theme ?? null,
    tradeFormMode: row.trade_form_mode ?? null,
    timezone: row.timezone,
    defaultAccount: mapDefaultAccount(row),
  };
}

const PREFERENCES_SELECT = `SELECT u.timezone, p.locale, p.theme, p.trade_form_mode,
  a.id AS default_account_id, a.account_name AS default_account_name,
  a.company AS default_account_company, a.account_number AS default_account_number,
  a.status AS default_account_status, a.base_currency AS default_account_currency
FROM users u
LEFT JOIN user_preferences p ON p.user_id = u.id
LEFT JOIN trading_accounts a ON a.user_id = u.id AND a.is_default = TRUE
WHERE u.id = $1`;

export async function getPreferences(userId, queryable = pool) {
  const result = await queryable.query(PREFERENCES_SELECT, [userId]);
  if (!result.rows[0]) throw createError('USER_NOT_FOUND', 'User not found.', 404);
  return mapPreferences(result.rows[0]);
}

export async function updatePreferences(userId, data, queryable = pool) {
  const client = await queryable.connect();
  try {
    await client.query('BEGIN');
    if (data.timezone !== undefined) {
      const updated = await client.query('UPDATE users SET timezone = $2 WHERE id = $1 RETURNING id', [userId, data.timezone]);
      if (!updated.rows[0]) throw createError('USER_NOT_FOUND', 'User not found.', 404);
    } else {
      const owned = await client.query('SELECT id FROM users WHERE id = $1 FOR UPDATE', [userId]);
      if (!owned.rows[0]) throw createError('USER_NOT_FOUND', 'User not found.', 404);
    }
    if (data.locale !== undefined || data.theme !== undefined || data.tradeFormMode !== undefined) {
      await client.query(
        `INSERT INTO user_preferences (user_id, locale, theme, trade_form_mode)
         VALUES ($1,$2,$3,$4)
         ON CONFLICT (user_id) DO UPDATE SET
           locale = COALESCE(EXCLUDED.locale, user_preferences.locale),
           theme = COALESCE(EXCLUDED.theme, user_preferences.theme),
           trade_form_mode = COALESCE(EXCLUDED.trade_form_mode, user_preferences.trade_form_mode)`,
        [userId, data.locale ?? null, data.theme ?? null, data.tradeFormMode ?? null],
      );
    }
    const resolved = await getPreferences(userId, client);
    await client.query('COMMIT');
    return resolved;
  } catch (error) {
    try { await client.query('ROLLBACK'); } catch {}
    throw error;
  } finally {
    client.release();
  }
}
