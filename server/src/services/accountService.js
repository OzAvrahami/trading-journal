import pool from '../db/client.js';
import { createError } from '../middleware/errorHandler.js';
import { listPortfolios } from './portfolioService.js';

function normalizeCompany(company) { return company.toLowerCase().trim(); }
function normalizeCurrency(currency = 'USD') { return currency.trim().toUpperCase(); }
function number(value, fallback = 0) { return value == null ? fallback : Number(value); }
function round(value, decimals = 4) {
  if (value == null || !Number.isFinite(Number(value))) return null;
  return Number(Number(value).toFixed(decimals));
}

export function calculateProfitFactor(grossProfit, grossLoss) {
  const profit = number(grossProfit);
  const loss = number(grossLoss);
  if (loss > 0) return round(profit / loss);
  return profit > 0 ? null : 0;
}

function mapLinkedPortfolio(portfolio) {
  if (!portfolio) return null;
  return {
    portfolioId: portfolio.id,
    status: portfolio.status,
    positionCount: portfolio.positionCount,
    cashBalance: portfolio.cashBalance,
    totalValue: portfolio.totalValue,
    valuationAvailable: portfolio.valuationAvailable,
    missingPriceCount: portfolio.missingPriceCount,
  };
}

export function mapAccount(row, linkedPortfolio = null) {
  const closedTrades = number(row.closed_trades);
  const winners = number(row.winners);
  const pnlNet = round(row.pnl_net, 2) ?? 0;
  const openingBalance = round(row.opening_balance, 2) ?? 0;
  return {
    id: row.id,
    userId: row.user_id,
    company: row.company,
    accountNumber: row.account_number,
    accountName: row.account_name,
    accountType: row.account_type,
    accountGroup: row.account_group || 'active_trading',
    includeInInvestmentValue: Boolean(row.include_in_investment_value),
    includeInNetWorth: Boolean(row.include_in_net_worth),
    includeInTradingAnalytics: row.include_in_trading_analytics !== false,
    status: row.status,
    baseCurrency: row.base_currency || 'USD',
    openingBalance,
    isDefault: Boolean(row.is_default),
    archived: row.status === 'archived',
    tradesCount: number(row.trades_count, closedTrades + number(row.open_trades)),
    closedTrades,
    openTrades: number(row.open_trades),
    winners,
    losers: number(row.losers),
    breakeven: number(row.breakeven),
    pnlNet,
    totalFees: round(row.total_fees, 2) ?? 0,
    winRate: closedTrades > 0 ? round(winners / closedTrades) : null,
    averageR: row.average_r == null ? null : round(row.average_r),
    profitFactor: closedTrades > 0 ? calculateProfitFactor(row.gross_profit, row.gross_loss) : null,
    trackedBalance: round(openingBalance + pnlNet, 2),
    lastTradeAt: row.last_trade_at ?? null,
    currency: row.base_currency || 'USD',
    currencies: [row.base_currency || 'USD'],
    isMixedCurrency: false,
    monetaryTotalsAvailable: true,
    linkedInvestmentPortfolio: mapLinkedPortfolio(linkedPortfolio),
    investmentSetupComplete: !Boolean(row.include_in_investment_value) || Boolean(linkedPortfolio),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

const ACCOUNT_METRICS_SQL = `WITH trade_metrics AS (
  SELECT account_id,
    COUNT(*)::int AS trades_count,
    COUNT(*) FILTER (WHERE status = 'closed')::int AS closed_trades,
    COUNT(*) FILTER (WHERE status = 'open')::int AS open_trades,
    COUNT(*) FILTER (WHERE status = 'closed' AND pnl_net > 0)::int AS winners,
    COUNT(*) FILTER (WHERE status = 'closed' AND pnl_net < 0)::int AS losers,
    COUNT(*) FILTER (WHERE status = 'closed' AND pnl_net = 0)::int AS breakeven,
    COALESCE(SUM(pnl_net) FILTER (WHERE status = 'closed'), 0) AS pnl_net,
    COALESCE(SUM(fees), 0) AS total_fees,
    AVG(r_multiple) FILTER (WHERE status = 'closed' AND r_multiple IS NOT NULL) AS average_r,
    COALESCE(SUM(pnl_net) FILTER (WHERE status = 'closed' AND pnl_net > 0), 0) AS gross_profit,
    COALESCE(ABS(SUM(pnl_net) FILTER (WHERE status = 'closed' AND pnl_net < 0)), 0) AS gross_loss,
    MAX(entry_datetime) AS last_trade_at
  FROM trades WHERE user_id = $1 GROUP BY account_id
)
SELECT a.*,
  ip.id AS investment_portfolio_id,
  COALESCE(tm.trades_count, 0) AS trades_count,
  COALESCE(tm.closed_trades, 0) AS closed_trades,
  COALESCE(tm.open_trades, 0) AS open_trades,
  COALESCE(tm.winners, 0) AS winners,
  COALESCE(tm.losers, 0) AS losers,
  COALESCE(tm.breakeven, 0) AS breakeven,
  COALESCE(tm.pnl_net, 0) AS pnl_net,
  COALESCE(tm.total_fees, 0) AS total_fees,
  tm.average_r, tm.gross_profit, tm.gross_loss, tm.last_trade_at
FROM trading_accounts a
LEFT JOIN trade_metrics tm ON tm.account_id = a.id
LEFT JOIN investment_portfolios ip ON ip.trading_account_id = a.id AND ip.user_id = a.user_id`;

async function attachInvestmentPortfolios(userId, rows, queryable) {
  const mapped = rows.map((row) => mapAccount(row));
  if (!rows.some((row) => row.id && row.investment_portfolio_id)) return mapped;
  const result = await listPortfolios(userId, { includeArchived: true }, queryable);
  const byAccount = new Map(result.portfolios.filter((portfolio) => portfolio.tradingAccountId).map((portfolio) => [portfolio.tradingAccountId, portfolio]));
  return rows.map((row) => mapAccount(row, byAccount.get(row.id)));
}

export async function listAccounts(userId, { includeArchived = false } = {}, queryable = pool) {
  const result = await queryable.query(
    `${ACCOUNT_METRICS_SQL}
     WHERE a.user_id = $1 AND ($2::boolean OR a.status <> 'archived')
     ORDER BY a.is_default DESC, a.status, a.company, a.account_number`,
    [userId, includeArchived],
  );
  return attachInvestmentPortfolios(userId, result.rows, queryable);
}

export async function getAccount(userId, accountId, queryable = pool) {
  const result = await queryable.query(
    `${ACCOUNT_METRICS_SQL} WHERE a.id = $2 AND a.user_id = $1`,
    [userId, accountId],
  );
  if (!result.rows[0]) throw createError('ACCOUNT_NOT_FOUND', 'Account not found.', 404);
  return (await attachInvestmentPortfolios(userId, result.rows, queryable))[0];
}

export async function validateAccountOwnership(userId, accountId, { requireActive = false, queryable = pool } = {}) {
  const result = await queryable.query(
    `SELECT id FROM trading_accounts WHERE id = $1 AND user_id = $2${requireActive ? " AND status = 'active'" : ''}`,
    [accountId, userId],
  );
  if (!result.rows[0]) throw createError('ACCOUNT_NOT_FOUND', 'Account not found.', 404);
  return result.rows[0];
}

function translateConstraint(error) {
  if (error?.code === '23505') {
    if (error.constraint === 'investment_portfolios_one_per_trading_account') throw createError('ACCOUNT_INVESTMENT_ALREADY_LINKED', 'The Account already has linked investment data.', 409);
    if (error.constraint?.includes('investment_portfolios_user_name')) throw createError('PORTFOLIO_NAME_EXISTS', 'An Investment Account with this display name already exists.', 409);
    throw createError('ACCOUNT_EXISTS', 'An Account with this company and account number already exists.', 409);
  }
  if (error?.code === '23514') {
    if (error.constraint?.includes('currency')) throw createError('ACCOUNT_INVESTMENT_CURRENCY_MISMATCH', 'The Account and investment data must use the same base currency.', 409);
    throw createError('ACCOUNT_STATE_INVALID', 'The Account lifecycle, grouping, or participation is invalid.', 409);
  }
  if (error?.code === '23503' && error.constraint === 'investment_portfolios_trading_account_fk') {
    throw createError('ACCOUNT_HAS_INVESTMENT_DATA', 'An Account with linked investment data cannot be deleted.', 409);
  }
  throw error;
}

async function transaction(work) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await work(client);
    await client.query('COMMIT');
    return result;
  } catch (error) {
    try { await client.query('ROLLBACK'); } catch {}
    throw error;
  } finally { client.release(); }
}

export async function createAccount(userId, data) {
  try {
    return await transaction(async client => {
      if (data.isDefault) {
        await client.query('SELECT id FROM trading_accounts WHERE user_id = $1 FOR UPDATE', [userId]);
        await client.query('UPDATE trading_accounts SET is_default = FALSE WHERE user_id = $1 AND is_default', [userId]);
      }
       const result = await client.query(
         `INSERT INTO trading_accounts
          (user_id, company, account_number, account_name, account_type, status, base_currency, opening_balance, is_default,
           account_group, include_in_investment_value, include_in_net_worth, include_in_trading_analytics)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13) RETURNING *`,
         [userId, normalizeCompany(data.company), data.accountNumber.trim(), data.accountName?.trim() || null,
          data.accountType ?? null, data.status ?? 'active', normalizeCurrency(data.baseCurrency), data.openingBalance ?? 0, data.isDefault ?? false,
          data.accountGroup ?? 'active_trading', Boolean(data.includeInInvestmentValue), Boolean(data.includeInNetWorth), data.includeInTradingAnalytics ?? true],
       );
      const account = result.rows[0];
      if (data.includeInInvestmentValue) {
        if (data.linkPortfolioId) {
          await linkPortfolioRow(userId, account.id, data.linkPortfolioId, account.base_currency, client);
        } else {
          const portfolioName = data.investmentDisplayName?.trim() || account.account_name || account.company;
          await client.query(
            `INSERT INTO investment_portfolios (user_id, name, base_currency, trading_account_id)
             VALUES ($1,$2,$3,$4)`,
            [userId, portfolioName, account.base_currency, account.id],
          );
        }
      }
       return getAccount(userId, result.rows[0].id, client);
    });
  } catch (error) { translateConstraint(error); }
}

export async function updateAccount(userId, accountId, data) {
  try {
    return await transaction(async client => {
      const existing = await getAccount(userId, accountId, client);
      const status = data.status ?? existing.status;
      const isDefault = status === 'active' ? (data.isDefault ?? existing.isDefault) : false;
      const accountGroup = data.accountGroup ?? existing.accountGroup;
      const includeInInvestmentValue = data.includeInInvestmentValue ?? existing.includeInInvestmentValue;
      const includeInNetWorth = data.includeInNetWorth ?? existing.includeInNetWorth;
      const includeInTradingAnalytics = data.includeInTradingAnalytics ?? existing.includeInTradingAnalytics;
      if (accountGroup === 'prop_firm' && (includeInInvestmentValue || includeInNetWorth)) {
        throw createError('ACCOUNT_GROUP_SCOPE_INVALID', 'Prop Firm Accounts can participate only in Trading Analytics.', 409);
      }
      if (data.isDefault === true && status !== 'active') throw createError('ACCOUNT_NOT_ACTIVE', 'Only an active Account can be the default.', 409);
      if (isDefault) {
        await client.query('SELECT id FROM trading_accounts WHERE user_id = $1 FOR UPDATE', [userId]);
        await client.query('UPDATE trading_accounts SET is_default = FALSE WHERE user_id = $1 AND id <> $2 AND is_default', [userId, accountId]);
      }
      const result = await client.query(
         `UPDATE trading_accounts SET company=$3, account_number=$4, account_name=$5, account_type=$6,
            status=$7, base_currency=$8, opening_balance=$9, is_default=$10, account_group=$11,
            include_in_investment_value=$12, include_in_net_worth=$13, include_in_trading_analytics=$14
         WHERE id=$1 AND user_id=$2 RETURNING *`,
        [accountId, userId, data.company != null ? normalizeCompany(data.company) : existing.company,
          data.accountNumber != null ? data.accountNumber.trim() : existing.accountNumber,
          data.accountName !== undefined ? (data.accountName?.trim() || null) : existing.accountName,
          data.accountType !== undefined ? data.accountType : existing.accountType, status,
          data.baseCurrency ? normalizeCurrency(data.baseCurrency) : existing.baseCurrency,
          data.openingBalance ?? existing.openingBalance, isDefault, accountGroup,
          includeInInvestmentValue, includeInNetWorth, includeInTradingAnalytics],
       );
      if (includeInInvestmentValue && !existing.linkedInvestmentPortfolio) {
        const portfolioName = data.investmentDisplayName?.trim() || result.rows[0].account_name || result.rows[0].company;
        await client.query(
          `INSERT INTO investment_portfolios (user_id, name, base_currency, trading_account_id)
           VALUES ($1,$2,$3,$4)`,
          [userId, portfolioName, result.rows[0].base_currency, accountId],
        );
      }
      return getAccount(userId, result.rows[0].id, client);
    });
  } catch (error) {
    if (error?.code && !['23505', '23514'].includes(error.code)) throw error;
    translateConstraint(error);
  }
}

export async function getScopeCurrencyMetadata(userId, { accountId, company, tradingAnalyticsOnly = false } = {}, queryable = pool) {
  const params = [userId];
  const conditions = ['user_id = $1'];
  if (accountId) { params.push(accountId); conditions.push(`id = $${params.length}`); }
  else if (company) { params.push(normalizeCompany(company)); conditions.push(`company = $${params.length}`); }
  if (tradingAnalyticsOnly && !accountId) conditions.push('include_in_trading_analytics = TRUE');
  const result = await queryable.query(
    `SELECT ARRAY_AGG(DISTINCT base_currency ORDER BY base_currency) AS currencies
     FROM trading_accounts WHERE ${conditions.join(' AND ')}`,
    params,
  );
  const currencies = result.rows[0]?.currencies ?? [];
  return {
    currency: currencies.length === 1 ? currencies[0] : null,
    currencies,
    isMixedCurrency: currencies.length > 1,
    monetaryTotalsAvailable: currencies.length <= 1,
  };
}

export async function deleteAccount(userId, accountId) {
  const owned = await pool.query('SELECT * FROM trading_accounts WHERE id = $1 AND user_id = $2', [accountId, userId]);
  if (!owned.rows[0]) throw createError('ACCOUNT_NOT_FOUND', 'Account not found.', 404);
  const linked = await pool.query('SELECT id FROM investment_portfolios WHERE trading_account_id = $1 AND user_id = $2', [accountId, userId]);
  if (linked.rows[0]) throw createError('ACCOUNT_HAS_INVESTMENT_DATA', 'An Account with linked investment data cannot be deleted. Archive it instead.', 409);
  const countRes = await pool.query('SELECT COUNT(*)::int AS cnt FROM trades WHERE account_id = $1', [accountId]);
  const tradeCount = countRes.rows[0].cnt;
  if (tradeCount > 0) throw createError('ACCOUNT_HAS_TRADES', `Cannot delete an account with ${tradeCount} trade(s). Reassign or delete those trades first.`, 409);
  const result = await pool.query('DELETE FROM trading_accounts WHERE id = $1 AND user_id = $2 RETURNING id', [accountId, userId]);
  if (!result.rows[0]) throw createError('ACCOUNT_NOT_FOUND', 'Account not found.', 404);
  return { deleted: true, id: accountId };
}

async function linkPortfolioRow(userId, accountId, portfolioId, accountCurrency, queryable) {
  const portfolio = await queryable.query(
    `SELECT id, base_currency, trading_account_id
     FROM investment_portfolios WHERE id = $1 AND user_id = $2 FOR UPDATE`,
    [portfolioId, userId],
  );
  if (!portfolio.rows[0]) throw createError('PORTFOLIO_NOT_FOUND', 'Investment data not found.', 404);
  if (portfolio.rows[0].trading_account_id && portfolio.rows[0].trading_account_id !== accountId) {
    throw createError('PORTFOLIO_ALREADY_LINKED', 'The investment data is already linked to another Account.', 409);
  }
  if (portfolio.rows[0].base_currency !== accountCurrency) {
    throw createError('ACCOUNT_INVESTMENT_CURRENCY_MISMATCH', 'The Account and investment data must use the same base currency.', 409);
  }
  const conflict = await queryable.query(
    'SELECT id FROM investment_portfolios WHERE trading_account_id = $1 AND id <> $2',
    [accountId, portfolioId],
  );
  if (conflict.rows[0]) throw createError('ACCOUNT_INVESTMENT_ALREADY_LINKED', 'The Account already has linked investment data.', 409);
  await queryable.query(
    'UPDATE investment_portfolios SET trading_account_id = $1 WHERE id = $2 AND user_id = $3',
    [accountId, portfolioId, userId],
  );
}

export async function linkInvestmentPortfolio(userId, accountId, portfolioId) {
  try {
    return await transaction(async (client) => {
      const accountResult = await client.query(
        'SELECT * FROM trading_accounts WHERE id = $1 AND user_id = $2 FOR UPDATE',
        [accountId, userId],
      );
      if (!accountResult.rows[0]) throw createError('ACCOUNT_NOT_FOUND', 'Account not found.', 404);
      await linkPortfolioRow(userId, accountId, portfolioId, accountResult.rows[0].base_currency, client);
      await client.query(
        'UPDATE trading_accounts SET include_in_investment_value = TRUE WHERE id = $1 AND user_id = $2',
        [accountId, userId],
      );
      return getAccount(userId, accountId, client);
    });
  } catch (error) {
    if (error?.statusCode) throw error;
    translateConstraint(error);
  }
}
