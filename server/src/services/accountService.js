import pool from '../db/client.js';
import { createError } from '../middleware/errorHandler.js';

function normalizeCompany(company) {
  return company.toLowerCase().trim();
}

function mapAccount(row) {
  return {
    id:            row.id,
    userId:        row.user_id,
    company:       row.company,
    accountNumber: row.account_number,
    accountName:   row.account_name,
    accountType:   row.account_type,
    status:        row.status,
    tradesCount:   row.trades_count != null ? parseInt(row.trades_count, 10) : 0,
    createdAt:     row.created_at,
    updatedAt:     row.updated_at,
  };
}

export async function listAccounts(userId) {
  const result = await pool.query(
    `SELECT a.*, COUNT(t.id)::int AS trades_count
     FROM trading_accounts a
     LEFT JOIN trades t ON t.account_id = a.id
     WHERE a.user_id = $1
     GROUP BY a.id
     ORDER BY a.company, a.account_number`,
    [userId]
  );
  return result.rows.map(mapAccount);
}

export async function getAccount(userId, accountId) {
  const result = await pool.query(
    'SELECT * FROM trading_accounts WHERE id = $1 AND user_id = $2',
    [accountId, userId]
  );
  if (!result.rows[0]) throw createError('ACCOUNT_NOT_FOUND', 'Account not found.', 404);
  return mapAccount(result.rows[0]);
}

export async function validateAccountOwnership(userId, accountId) {
  const result = await pool.query(
    'SELECT id FROM trading_accounts WHERE id = $1 AND user_id = $2',
    [accountId, userId]
  );
  if (!result.rows[0]) throw createError('ACCOUNT_NOT_FOUND', 'Account not found.', 404);
}

export async function createAccount(userId, data) {
  const result = await pool.query(
    `INSERT INTO trading_accounts
       (user_id, company, account_number, account_name, account_type, status)
     VALUES ($1, $2, $3, $4, $5, $6)
     RETURNING *`,
    [
      userId,
      normalizeCompany(data.company),
      data.accountNumber.trim(),
      data.accountName?.trim() ?? null,
      data.accountType ?? null,
      data.status ?? 'active',
    ]
  );
  return mapAccount(result.rows[0]);
}

export async function updateAccount(userId, accountId, data) {
  const existing = await getAccount(userId, accountId);

  const result = await pool.query(
    `UPDATE trading_accounts SET
       company        = $3,
       account_number = $4,
       account_name   = $5,
       account_type   = $6,
       status         = $7
     WHERE id = $1 AND user_id = $2
     RETURNING *`,
    [
      accountId,
      userId,
      data.company != null       ? normalizeCompany(data.company)         : existing.company,
      data.accountNumber != null ? data.accountNumber.trim()              : existing.accountNumber,
      data.accountName !== undefined ? (data.accountName?.trim() ?? null) : existing.accountName,
      data.accountType !== undefined ? data.accountType                   : existing.accountType,
      data.status ?? existing.status,
    ]
  );
  return mapAccount(result.rows[0]);
}

export async function deleteAccount(userId, accountId) {
  await getAccount(userId, accountId);

  const countRes = await pool.query(
    'SELECT COUNT(*)::int AS cnt FROM trades WHERE account_id = $1',
    [accountId]
  );
  const tradeCount = countRes.rows[0].cnt;
  if (tradeCount > 0) {
    throw createError(
      'ACCOUNT_HAS_TRADES',
      `Cannot delete an account with ${tradeCount} trade(s). Reassign or delete those trades first.`,
      409
    );
  }

  const result = await pool.query(
    'DELETE FROM trading_accounts WHERE id = $1 AND user_id = $2 RETURNING id',
    [accountId, userId]
  );
  if (!result.rows[0]) throw createError('ACCOUNT_NOT_FOUND', 'Account not found.', 404);
  return { deleted: true, id: accountId };
}
