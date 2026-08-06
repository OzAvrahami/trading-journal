import pool from '../db/client.js';
import { createError } from '../middleware/errorHandler.js';
import { mapPostgresDate } from '../utils/dateTime.js';
import { applyManualPrices, replayInvestmentTransactions } from './portfolioCalculationService.js';

function number(value, fallback = 0) { return value == null ? fallback : Number(value); }
function normalizeText(value) { const text = value == null ? '' : String(value).trim(); return text || null; }
function currency(value) { return String(value).trim().toUpperCase(); }
function symbol(value) { return String(value).trim().toUpperCase(); }

function mapPortfolioRow(row) {
  return {
    id: row.id, name: row.name, description: row.description, baseCurrency: row.base_currency,
    status: row.status, isDefault: Boolean(row.is_default), tradingAccountId: row.trading_account_id ?? null,
    tradingAccount: row.trading_account_id ? {
      id: row.trading_account_id,
      accountName: row.trading_account_name ?? null,
      company: row.trading_account_company ?? null,
      accountNumber: row.trading_account_number ?? null,
      status: row.trading_account_status ?? null,
      baseCurrency: row.trading_account_currency ?? row.base_currency,
      includeInInvestmentValue: Boolean(row.include_in_investment_value),
    } : null,
    createdAt: row.created_at, updatedAt: row.updated_at,
  };
}

function mapInstrumentRow(row) {
  return {
    id: row.id, symbol: row.symbol, name: row.name, exchange: row.exchange,
    assetType: row.asset_type, currency: row.currency, isActive: Boolean(row.is_active),
    createdAt: row.created_at, updatedAt: row.updated_at,
  };
}

export function mapTransactionRow(row) {
  return {
    id: row.id, portfolioId: row.portfolio_id, portfolioName: row.portfolio_name ?? null,
    instrumentId: row.instrument_id, instrumentSymbol: row.instrument_symbol ?? null,
    instrumentName: row.instrument_name ?? null, instrumentExchange: row.instrument_exchange ?? null,
    instrumentAssetType: row.instrument_asset_type ?? null,
    transactionType: row.transaction_type, transactionDate: mapPostgresDate(row.transaction_date),
    quantity: row.quantity == null ? null : number(row.quantity), price: row.price == null ? null : number(row.price),
    amount: row.amount == null ? null : number(row.amount), fees: number(row.fees), currency: row.currency,
    notes: row.notes, createdAt: row.created_at, updatedAt: row.updated_at,
  };
}

function mapPriceRow(row) {
  return {
    id: row.id, instrumentId: row.instrument_id, symbol: row.symbol ?? null,
    priceDate: mapPostgresDate(row.price_date), price: number(row.price), currency: row.currency,
    source: row.source, createdAt: row.created_at, updatedAt: row.updated_at,
  };
}

function translateConstraint(error) {
  if (error?.code === '23505') {
    if (error.constraint?.includes('portfolio')) throw createError('PORTFOLIO_NAME_EXISTS', 'A Portfolio with this name already exists.', 409);
    if (error.constraint?.includes('instrument')) throw createError('INVESTMENT_INSTRUMENT_EXISTS', 'This Instrument already exists.', 409);
    if (error.constraint?.includes('price')) throw createError('INVESTMENT_PRICE_EXISTS', 'A manual price already exists for this date.', 409);
  }
  if (error?.code === '23514') throw createError('PORTFOLIO_INTEGRITY_ERROR', 'The investment record failed an ownership, currency, or shape check.', 409);
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

const TRANSACTION_SELECT = `SELECT t.*, p.name AS portfolio_name,
  i.symbol AS instrument_symbol, i.name AS instrument_name, i.exchange AS instrument_exchange,
  i.asset_type AS instrument_asset_type
FROM investment_transactions t
JOIN investment_portfolios p ON p.id = t.portfolio_id AND p.user_id = t.user_id
LEFT JOIN investment_instruments i ON i.id = t.instrument_id AND i.user_id = t.user_id`;

const PORTFOLIO_SELECT = `SELECT p.*,
  a.account_name AS trading_account_name, a.company AS trading_account_company,
  a.account_number AS trading_account_number, a.status AS trading_account_status,
  a.base_currency AS trading_account_currency,
  a.include_in_investment_value
FROM investment_portfolios p
LEFT JOIN trading_accounts a ON a.id = p.trading_account_id AND a.user_id = p.user_id`;

async function loadOwnedPortfolio(userId, portfolioId, queryable = pool, { lock = false } = {}) {
  const result = await queryable.query(
    `${PORTFOLIO_SELECT} WHERE p.id = $1 AND p.user_id = $2${lock ? ' FOR UPDATE OF p' : ''}`,
    [portfolioId, userId],
  );
  if (!result.rows[0]) throw createError('PORTFOLIO_NOT_FOUND', 'Portfolio not found.', 404);
  return result.rows[0];
}

async function loadOwnedInstrument(userId, instrumentId, queryable = pool, { requireActive = false } = {}) {
  const result = await queryable.query(
    `SELECT * FROM investment_instruments WHERE id = $1 AND user_id = $2${requireActive ? ' AND is_active' : ''}`,
    [instrumentId, userId],
  );
  if (!result.rows[0]) throw createError('INVESTMENT_INSTRUMENT_NOT_FOUND', 'Investment Instrument not found.', 404);
  return result.rows[0];
}

async function loadPortfolioTransactions(userId, portfolioId, queryable = pool) {
  const result = await queryable.query(
    `${TRANSACTION_SELECT} WHERE t.user_id = $1 AND t.portfolio_id = $2
     ORDER BY t.transaction_date, t.created_at, t.id`,
    [userId, portfolioId],
  );
  return result.rows.map(mapTransactionRow);
}

async function loadLatestPrices(userId, instrumentIds, queryable = pool) {
  if (!instrumentIds.length) return new Map();
  const result = await queryable.query(
    `SELECT DISTINCT ON (pr.instrument_id) pr.*
     FROM investment_prices pr
     JOIN users u ON u.id = pr.user_id
     WHERE pr.user_id = $1 AND pr.instrument_id = ANY($2::uuid[])
       AND pr.price_date <= (CURRENT_TIMESTAMP AT TIME ZONE COALESCE(u.timezone, 'Asia/Jerusalem'))::date
     ORDER BY pr.instrument_id, pr.price_date DESC, pr.created_at DESC, pr.id DESC`,
    [userId, instrumentIds],
  );
  return new Map(result.rows.map((row) => [row.instrument_id, mapPriceRow(row)]));
}

async function derivePortfolio(portfolioRow, transactions, userId, queryable = pool, sharedPrices = null) {
  const replay = replayInvestmentTransactions(transactions);
  const prices = sharedPrices ?? await loadLatestPrices(userId, replay.positions.map((position) => position.instrumentId), queryable);
  const valuation = applyManualPrices(replay, prices);
  return {
    ...mapPortfolioRow(portfolioRow),
    ...valuation,
    totalInstrumentCount: new Set(transactions.filter((item) => item.instrumentId).map((item) => item.instrumentId)).size,
    lastTransactionDate: transactions.length ? transactions.at(-1).transactionDate : null,
  };
}

export async function listPortfolios(userId, { includeArchived = false, investmentEnabledOnly = false, accountId = null } = {}, queryable = pool) {
  const portfoliosResult = await queryable.query(
    `${PORTFOLIO_SELECT}
     WHERE p.user_id = $1 AND ($2::boolean OR p.status = 'active')
       AND ($3::boolean = FALSE OR (p.trading_account_id IS NOT NULL AND a.include_in_investment_value = TRUE AND a.status = 'active'))
       AND ($4::uuid IS NULL OR p.trading_account_id = $4)
     ORDER BY p.is_default DESC, p.status, lower(btrim(p.name)), p.id`,
    [userId, includeArchived, investmentEnabledOnly, accountId],
  );
  if (!portfoliosResult.rows.length) return { portfolios: [] };
  const ids = portfoliosResult.rows.map((row) => row.id);
  const transactionsResult = await queryable.query(
    `${TRANSACTION_SELECT} WHERE t.user_id = $1 AND t.portfolio_id = ANY($2::uuid[])
     ORDER BY t.portfolio_id, t.transaction_date, t.created_at, t.id`,
    [userId, ids],
  );
  const grouped = new Map(ids.map((id) => [id, []]));
  transactionsResult.rows.map(mapTransactionRow).forEach((item) => grouped.get(item.portfolioId)?.push(item));
  const instrumentIds = [...new Set(transactionsResult.rows.filter((row) => row.instrument_id).map((row) => row.instrument_id))];
  const prices = await loadLatestPrices(userId, instrumentIds, queryable);
  const portfolios = await Promise.all(portfoliosResult.rows.map((row) => derivePortfolio(row, grouped.get(row.id), userId, queryable, prices)));
  return { portfolios };
}

export async function getPortfolio(userId, portfolioId, queryable = pool) {
  const portfolio = await loadOwnedPortfolio(userId, portfolioId, queryable);
  const transactions = await loadPortfolioTransactions(userId, portfolioId, queryable);
  const derived = await derivePortfolio(portfolio, transactions, userId, queryable);
  return { portfolio: { ...derived, recentTransactions: [...transactions].reverse().slice(0, 50) } };
}

export async function createPortfolio(userId, data) {
  try {
    return await transaction(async (client) => {
      if (data.isDefault) {
        await client.query('SELECT id FROM investment_portfolios WHERE user_id = $1 FOR UPDATE', [userId]);
        await client.query('UPDATE investment_portfolios SET is_default = FALSE WHERE user_id = $1 AND is_default', [userId]);
      }
      const result = await client.query(
        `INSERT INTO investment_portfolios (user_id, name, description, base_currency, is_default)
         VALUES ($1,$2,$3,$4,$5) RETURNING *`,
        [userId, data.name.trim(), normalizeText(data.description), currency(data.baseCurrency), Boolean(data.isDefault)],
      );
      return getPortfolio(userId, result.rows[0].id, client);
    });
  } catch (error) { translateConstraint(error); }
}

export async function updatePortfolio(userId, portfolioId, data) {
  try {
    return await transaction(async (client) => {
      const existing = await loadOwnedPortfolio(userId, portfolioId, client, { lock: true });
      const nextStatus = data.status ?? existing.status;
      const nextDefault = nextStatus === 'active' ? (data.isDefault ?? existing.is_default) : false;
      const nextCurrency = data.baseCurrency ? currency(data.baseCurrency) : existing.base_currency;
      if (nextCurrency !== existing.base_currency) {
        const countResult = await client.query('SELECT COUNT(*)::int AS count FROM investment_transactions WHERE user_id = $1 AND portfolio_id = $2', [userId, portfolioId]);
        if (Number(countResult.rows[0].count) > 0) throw createError('PORTFOLIO_CURRENCY_IMMUTABLE', 'Base currency cannot change after Transactions exist.', 409);
      }
      if (data.isDefault === true && nextStatus !== 'active') throw createError('PORTFOLIO_ARCHIVED', 'Only an active Portfolio can be the default.', 409);
      if (nextDefault) {
        await client.query('SELECT id FROM investment_portfolios WHERE user_id = $1 FOR UPDATE', [userId]);
        await client.query('UPDATE investment_portfolios SET is_default = FALSE WHERE user_id = $1 AND id <> $2 AND is_default', [userId, portfolioId]);
      }
      await client.query(
        `UPDATE investment_portfolios SET name=$3, description=$4, base_currency=$5, status=$6, is_default=$7
         WHERE id=$1 AND user_id=$2`,
        [portfolioId, userId, data.name?.trim() ?? existing.name,
          data.description !== undefined ? normalizeText(data.description) : existing.description,
          nextCurrency, nextStatus, nextDefault],
      );
      return getPortfolio(userId, portfolioId, client);
    });
  } catch (error) {
    if (error?.statusCode) throw error;
    translateConstraint(error);
  }
}

export async function listInstruments(userId, filters = {}, queryable = pool) {
  const params = [userId];
  const conditions = ['user_id = $1'];
  if (!filters.includeInactive) conditions.push('is_active');
  if (filters.assetType) { params.push(filters.assetType); conditions.push(`asset_type = $${params.length}`); }
  if (filters.currency) { params.push(currency(filters.currency)); conditions.push(`currency = $${params.length}`); }
  if (filters.search) { params.push(`%${filters.search.trim()}%`); conditions.push(`(symbol ILIKE $${params.length} OR name ILIKE $${params.length})`); }
  const result = await queryable.query(
    `SELECT * FROM investment_instruments WHERE ${conditions.join(' AND ')} ORDER BY is_active DESC, symbol, id`,
    params,
  );
  return { instruments: result.rows.map(mapInstrumentRow) };
}

export async function createInstrument(userId, data, queryable = pool) {
  try {
    const result = await queryable.query(
      `INSERT INTO investment_instruments (user_id, symbol, name, exchange, asset_type, currency)
       VALUES ($1,$2,$3,$4,$5,$6) RETURNING *`,
      [userId, symbol(data.symbol), normalizeText(data.name), normalizeText(data.exchange), data.assetType, currency(data.currency)],
    );
    return { instrument: mapInstrumentRow(result.rows[0]) };
  } catch (error) { translateConstraint(error); }
}

export async function updateInstrument(userId, instrumentId, data) {
  try {
    return await transaction(async (client) => {
      const existing = await loadOwnedInstrument(userId, instrumentId, client);
      if (data.exchange !== undefined && normalizeText(data.exchange) !== existing.exchange) {
        const count = await client.query('SELECT COUNT(*)::int AS count FROM investment_transactions WHERE user_id=$1 AND instrument_id=$2', [userId, instrumentId]);
        if (Number(count.rows[0].count) > 0) throw createError('INVESTMENT_INSTRUMENT_IDENTITY_IMMUTABLE', 'Instrument exchange cannot change after Transactions exist.', 409);
      }
      const result = await client.query(
        `UPDATE investment_instruments SET name=$3, exchange=$4, is_active=$5 WHERE id=$1 AND user_id=$2 RETURNING *`,
        [instrumentId, userId, data.name !== undefined ? normalizeText(data.name) : existing.name,
          data.exchange !== undefined ? normalizeText(data.exchange) : existing.exchange,
          data.isActive ?? existing.is_active],
      );
      return { instrument: mapInstrumentRow(result.rows[0]) };
    });
  } catch (error) { if (error?.statusCode) throw error; translateConstraint(error); }
}

async function validateTransactionContext(userId, data, queryable, { currentInstrumentId = null } = {}) {
  const portfolio = await loadOwnedPortfolio(userId, data.portfolioId, queryable, { lock: true });
  if (portfolio.status !== 'active' && !data.id) throw createError('PORTFOLIO_ARCHIVED', 'Archived Portfolios cannot receive new Transactions.', 409);
  if (portfolio.trading_account_id && portfolio.trading_account_status !== 'active' && !data.id) {
    throw createError('INVESTMENT_ACCOUNT_ARCHIVED', 'The linked Account is not active and cannot receive new Investment Transactions.', 409);
  }
  let instrument = null;
  if (data.instrumentId) {
    instrument = await loadOwnedInstrument(userId, data.instrumentId, queryable, { requireActive: data.instrumentId !== currentInstrumentId });
    if (instrument.currency !== portfolio.base_currency) throw createError('PORTFOLIO_CURRENCY_MISMATCH', 'Instrument currency must match Portfolio base currency.', 409);
  }
  return { portfolio, instrument };
}

function transactionValues(data, portfolioCurrency) {
  return [data.portfolioId, data.instrumentId ?? null, data.transactionType, data.transactionDate,
    data.quantity ?? null, data.price ?? null, data.amount ?? null, data.fees ?? 0,
    portfolioCurrency, normalizeText(data.notes)];
}

export async function listTransactions(userId, filters = {}, queryable = pool) {
  const params = [userId]; const conditions = ['t.user_id = $1'];
  for (const [key, column] of [['portfolioId', 't.portfolio_id'], ['instrumentId', 't.instrument_id'], ['transactionType', 't.transaction_type']]) {
    if (filters[key]) { params.push(filters[key]); conditions.push(`${column} = $${params.length}`); }
  }
  if (filters.from) { params.push(filters.from); conditions.push(`t.transaction_date >= $${params.length}::date`); }
  if (filters.to) { params.push(filters.to); conditions.push(`t.transaction_date <= $${params.length}::date`); }
  params.push(filters.limit ?? 50); const limitPlaceholder = `$${params.length}`;
  params.push(filters.offset ?? 0); const offsetPlaceholder = `$${params.length}`;
  const [rows, count] = await Promise.all([
    queryable.query(`${TRANSACTION_SELECT} WHERE ${conditions.join(' AND ')} ORDER BY t.transaction_date DESC, t.created_at DESC, t.id DESC LIMIT ${limitPlaceholder} OFFSET ${offsetPlaceholder}`, params),
    queryable.query(`SELECT COUNT(*)::int AS count FROM investment_transactions t WHERE ${conditions.join(' AND ')}`, params.slice(0, -2)),
  ]);
  return { transactions: rows.rows.map(mapTransactionRow), total: Number(count.rows[0]?.count ?? 0), limit: filters.limit ?? 50, offset: filters.offset ?? 0 };
}

export async function createTransaction(userId, data) {
  return transaction(async (client) => {
    const { portfolio } = await validateTransactionContext(userId, data, client);
    const values = transactionValues(data, portfolio.base_currency);
    const result = await client.query(
      `INSERT INTO investment_transactions
       (user_id, portfolio_id, instrument_id, transaction_type, transaction_date, quantity, price, amount, fees, currency, notes)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) RETURNING id`,
      [userId, ...values],
    );
    const transactions = await loadPortfolioTransactions(userId, data.portfolioId, client);
    replayInvestmentTransactions(transactions);
    const row = transactions.find((item) => item.id === result.rows[0].id);
    return { transaction: row };
  }).catch((error) => { if (error?.statusCode) throw error; translateConstraint(error); });
}

async function loadOwnedTransaction(userId, transactionId, queryable = pool) {
  const result = await queryable.query(`${TRANSACTION_SELECT} WHERE t.id=$1 AND t.user_id=$2`, [transactionId, userId]);
  if (!result.rows[0]) throw createError('PORTFOLIO_TRANSACTION_NOT_FOUND', 'Investment Transaction not found.', 404);
  return mapTransactionRow(result.rows[0]);
}

export async function updateTransaction(userId, transactionId, data) {
  return transaction(async (client) => {
    const existing = await loadOwnedTransaction(userId, transactionId, client);
    const merged = { ...existing, ...data, id: transactionId, portfolioId: existing.portfolioId };
    const { portfolio } = await validateTransactionContext(userId, merged, client, { currentInstrumentId: existing.instrumentId });
    const values = transactionValues(merged, portfolio.base_currency);
    await client.query(
      `UPDATE investment_transactions SET instrument_id=$3, transaction_type=$4, transaction_date=$5,
       quantity=$6, price=$7, amount=$8, fees=$9, currency=$10, notes=$11
       WHERE id=$1 AND user_id=$2`,
      [transactionId, userId, ...values.slice(1)],
    );
    const transactions = await loadPortfolioTransactions(userId, existing.portfolioId, client);
    replayInvestmentTransactions(transactions);
    return { transaction: transactions.find((item) => item.id === transactionId) };
  }).catch((error) => { if (error?.statusCode) throw error; translateConstraint(error); });
}

export async function deleteTransaction(userId, transactionId) {
  return transaction(async (client) => {
    const existing = await loadOwnedTransaction(userId, transactionId, client);
    await client.query('DELETE FROM investment_transactions WHERE id=$1 AND user_id=$2', [transactionId, userId]);
    const transactions = await loadPortfolioTransactions(userId, existing.portfolioId, client);
    replayInvestmentTransactions(transactions);
    return { deleted: true, id: transactionId };
  });
}

export async function listPrices(userId, { instrumentId = null } = {}, queryable = pool) {
  const result = await queryable.query(
    `SELECT pr.*, i.symbol FROM investment_prices pr
     JOIN investment_instruments i ON i.id=pr.instrument_id AND i.user_id=pr.user_id
     WHERE pr.user_id=$1 AND ($2::uuid IS NULL OR pr.instrument_id=$2)
     ORDER BY pr.price_date DESC, pr.created_at DESC, pr.id DESC`,
    [userId, instrumentId],
  );
  return { prices: result.rows.map(mapPriceRow) };
}

export async function upsertPrice(userId, instrumentId, priceDate, data, queryable = pool) {
  const instrument = await loadOwnedInstrument(userId, instrumentId, queryable);
  if (currency(data.currency) !== instrument.currency) throw createError('PORTFOLIO_CURRENCY_MISMATCH', 'Manual price currency must match Instrument currency.', 409);
  try {
    const result = await queryable.query(
      `INSERT INTO investment_prices (user_id,instrument_id,price_date,price,currency)
       VALUES ($1,$2,$3,$4,$5)
       ON CONFLICT (user_id,instrument_id,price_date) DO UPDATE SET price=EXCLUDED.price,currency=EXCLUDED.currency
       RETURNING *`,
      [userId, instrumentId, priceDate, data.price, instrument.currency],
    );
    return { price: mapPriceRow({ ...result.rows[0], symbol: instrument.symbol }) };
  } catch (error) { translateConstraint(error); }
}

export async function deletePrice(userId, instrumentId, priceDate, queryable = pool) {
  await loadOwnedInstrument(userId, instrumentId, queryable);
  const result = await queryable.query(
    'DELETE FROM investment_prices WHERE user_id=$1 AND instrument_id=$2 AND price_date=$3::date RETURNING id',
    [userId, instrumentId, priceDate],
  );
  if (!result.rows[0]) throw createError('INVESTMENT_PRICE_NOT_FOUND', 'Manual price not found.', 404);
  return { deleted: true, id: result.rows[0].id };
}
