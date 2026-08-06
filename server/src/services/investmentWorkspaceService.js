import pool from '../db/client.js';
import { createError } from '../middleware/errorHandler.js';
import { mapPostgresDate } from '../utils/dateTime.js';
import { applyManualPrices, replayInvestmentTransactions } from './portfolioCalculationService.js';
import { mapTransactionRow } from './portfolioService.js';

const round = (value, decimals = 2) => Number(Number(value || 0).toFixed(decimals));
const numeric = (value) => value == null ? null : Number(value);

function mapAccountPortfolio(row) {
  return {
    accountId: row.account_id,
    accountName: row.account_name,
    company: row.company,
    accountNumber: row.account_number,
    accountStatus: row.account_status,
    includeInInvestmentValue: Boolean(row.include_in_investment_value),
    baseCurrency: row.base_currency,
    portfolioId: row.portfolio_id,
    portfolioStatus: row.portfolio_status,
    portfolioName: row.portfolio_name,
  };
}

function mapWorkspaceTransaction(row) {
  return {
    ...mapTransactionRow(row),
    accountId: row.account_id,
    accountName: row.account_name,
    accountCompany: row.account_company,
    accountNumber: row.account_number,
  };
}

function mapPrice(row) {
  return {
    instrumentId: row.instrument_id,
    priceDate: mapPostgresDate(row.price_date),
    price: Number(row.price),
    currency: row.currency,
  };
}

export async function resolveInvestmentScope(userId, accountId = null, queryable = pool) {
  const params = [userId];
  let condition = "a.status = 'active' AND a.include_in_investment_value = TRUE AND p.status = 'active'";
  if (accountId) {
    params.push(accountId);
    condition = "((a.status = 'active' AND a.include_in_investment_value = TRUE AND p.status = 'active') OR a.id = $2)";
  }
  const result = await queryable.query(
    `SELECT a.id AS account_id, a.account_name, a.company, a.account_number,
            a.status AS account_status, a.include_in_investment_value, a.base_currency,
            p.id AS portfolio_id, p.status AS portfolio_status, p.name AS portfolio_name
       FROM trading_accounts a
       LEFT JOIN investment_portfolios p ON p.trading_account_id = a.id AND p.user_id = a.user_id
      WHERE a.user_id = $1 AND ${condition}
      ORDER BY a.account_name, a.company, a.account_number, a.id`,
    params,
  );

  const selectedRow = accountId ? result.rows.find((row) => row.account_id === accountId) : null;
  if (accountId && (!selectedRow || !selectedRow.portfolio_id)) {
    throw createError('INVESTMENT_SCOPE_NOT_FOUND', 'Investment Account scope not found.', 404);
  }

  const accounts = result.rows.filter((row) => row.portfolio_id).map(mapAccountPortfolio);
  const selectedAccount = accountId ? accounts.find((item) => item.accountId === accountId) : null;
  const unlinked = await queryable.query(
    `SELECT id, name, description, base_currency, status, created_at, updated_at
       FROM investment_portfolios
      WHERE user_id = $1 AND trading_account_id IS NULL
      ORDER BY status, lower(btrim(name)), id`,
    [userId],
  );
  return {
    mode: accountId ? 'account' : 'all',
    selectedAccount,
    accounts,
    portfolioIds: accountId ? [selectedAccount.portfolioId] : accounts.map((item) => item.portfolioId),
    historicalScope: Boolean(accountId && (selectedAccount.accountStatus !== 'active'
      || selectedAccount.portfolioStatus !== 'active'
      || !selectedAccount.includeInInvestmentValue)),
    unlinkedPortfolios: unlinked.rows.map((row) => ({
      id: row.id,
      name: row.name,
      description: row.description,
      baseCurrency: row.base_currency,
      status: row.status,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    })),
  };
}

async function loadLedger(userId, scope, queryable = pool) {
  if (!scope.portfolioIds.length) return { transactions: [], prices: [], byPortfolio: new Map(), current: [] };
  const [transactionResult, priceResult] = await Promise.all([
    queryable.query(
      `SELECT t.*, p.name AS portfolio_name,
              i.symbol AS instrument_symbol, i.name AS instrument_name,
              i.exchange AS instrument_exchange, i.asset_type AS instrument_asset_type,
              a.id AS account_id, a.account_name, a.company AS account_company, a.account_number
         FROM investment_transactions t
         JOIN investment_portfolios p ON p.id = t.portfolio_id AND p.user_id = t.user_id
         JOIN trading_accounts a ON a.id = p.trading_account_id AND a.user_id = p.user_id
         LEFT JOIN investment_instruments i ON i.id = t.instrument_id AND i.user_id = t.user_id
        WHERE t.user_id = $1 AND t.portfolio_id = ANY($2::uuid[])
        ORDER BY t.transaction_date, t.created_at, t.id`,
      [userId, scope.portfolioIds],
    ),
    queryable.query(
      `SELECT pr.instrument_id, pr.price_date, pr.price, pr.currency
         FROM investment_prices pr
         JOIN users u ON u.id = pr.user_id
       WHERE pr.user_id = $1
          AND EXISTS (
            SELECT 1
              FROM investment_transactions scoped_transaction
             WHERE scoped_transaction.user_id = pr.user_id
               AND scoped_transaction.instrument_id = pr.instrument_id
               AND scoped_transaction.portfolio_id = ANY($2::uuid[])
          )
          AND pr.price_date <= (CURRENT_TIMESTAMP AT TIME ZONE COALESCE(u.timezone, 'Asia/Jerusalem'))::date
        ORDER BY pr.instrument_id, pr.price_date, pr.created_at, pr.id`,
      [userId, scope.portfolioIds],
    ),
  ]);
  const transactions = transactionResult.rows.map(mapWorkspaceTransaction);
  const prices = priceResult.rows.map(mapPrice);
  const byPortfolio = new Map(scope.portfolioIds.map((id) => [id, []]));
  transactions.forEach((item) => byPortfolio.get(item.portfolioId)?.push(item));
  const latest = new Map();
  prices.forEach((item) => latest.set(item.instrumentId, item));
  const accountByPortfolio = new Map(scope.accounts.map((item) => [item.portfolioId, item]));
  const current = scope.portfolioIds.map((portfolioId) => {
    const replay = replayInvestmentTransactions(byPortfolio.get(portfolioId) || []);
    return {
      ...accountByPortfolio.get(portfolioId),
      ...applyManualPrices(replay, latest),
    };
  });
  return { transactions, prices, byPortfolio, current };
}

export function groupCurrent(current) {
  const groups = new Map();
  for (const item of current) {
    const group = groups.get(item.baseCurrency) || {
      currency: item.baseCurrency,
      accountCount: 0,
      positionCount: 0,
      cashBalance: 0,
      totalCostBasis: 0,
      realizedPnl: 0,
      dividendIncome: 0,
      totalFees: 0,
      netContributions: 0,
      marketValue: 0,
      unrealizedPnl: 0,
      totalValue: 0,
      missingPriceCount: 0,
      valuationAvailable: true,
    };
    group.accountCount += 1;
    group.positionCount += item.positionCount;
    for (const key of ['cashBalance', 'totalCostBasis', 'realizedPnl', 'dividendIncome', 'totalFees', 'netContributions']) {
      group[key] += item[key] || 0;
    }
    group.missingPriceCount += item.missingPriceCount;
    if (item.valuationAvailable) {
      group.marketValue += item.marketValue || 0;
      group.unrealizedPnl += item.unrealizedPnl || 0;
      group.totalValue += item.totalValue || 0;
    } else {
      group.valuationAvailable = false;
    }
    groups.set(item.baseCurrency, group);
  }
  return [...groups.values()].map((group) => ({
    ...group,
    cashBalance: round(group.cashBalance),
    totalCostBasis: round(group.totalCostBasis),
    realizedPnl: round(group.realizedPnl),
    dividendIncome: round(group.dividendIncome),
    totalFees: round(group.totalFees),
    netContributions: round(group.netContributions),
    marketValue: group.valuationAvailable ? round(group.marketValue) : null,
    unrealizedPnl: group.valuationAvailable ? round(group.unrealizedPnl) : null,
    totalValue: group.valuationAvailable ? round(group.totalValue) : null,
  })).sort((left, right) => left.currency.localeCompare(right.currency));
}

function currentHoldings(current) {
  return current.flatMap((ledger) => ledger.positions.map((position) => ({
    ...position,
    accountId: ledger.accountId,
    accountName: ledger.accountName,
    accountCompany: ledger.company,
    accountNumber: ledger.accountNumber,
    accountStatus: ledger.accountStatus,
    portfolioId: ledger.portfolioId,
  })));
}

function latestPriceMap(prices, pointDate) {
  const map = new Map();
  for (const price of prices) {
    if (price.priceDate <= pointDate) map.set(price.instrumentId, price);
  }
  return map;
}

function aggregatePoint(current, date) {
  return groupCurrent(current).map((group) => ({ ...group, date }));
}

export function buildPerformanceSeries(scope, ledger, { from = null, to = null } = {}) {
  const dates = [...new Set([
    ...ledger.transactions.map((item) => item.transactionDate),
    ...ledger.prices.map((item) => item.priceDate),
  ])].filter((date) => (!from || date >= from) && (!to || date <= to)).sort();
  return dates.flatMap((date) => {
    const priceMap = latestPriceMap(ledger.prices, date);
    const current = scope.accounts.filter((account) => scope.portfolioIds.includes(account.portfolioId)).map((account) => {
      const transactions = (ledger.byPortfolio.get(account.portfolioId) || []).filter((item) => item.transactionDate <= date);
      return { ...account, ...applyManualPrices(replayInvestmentTransactions(transactions), priceMap) };
    });
    return aggregatePoint(current, date);
  });
}

export function allocationForCurrency(currency, ledgers) {
  const positions = currentHoldings(ledgers).filter((item) => item.currency === currency);
  const cash = round(ledgers.filter((item) => item.baseCurrency === currency).reduce((sum, item) => sum + item.cashBalance, 0));
  const valuationAvailable = positions.every((item) => item.valuationAvailable);
  const marketValue = valuationAvailable ? round(positions.reduce((sum, item) => sum + item.marketValue, 0)) : null;
  const totalValue = valuationAvailable ? round(cash + marketValue) : null;
  const percent = (amount) => valuationAvailable && totalValue > 0 ? round(amount / totalValue, 6) : null;
  const group = (key, label) => {
    const map = new Map();
    for (const position of positions) {
      const value = position[key] || 'unclassified';
      const item = map.get(value) || { key: value, label: label(position), amount: 0, positionCount: 0 };
      item.positionCount += 1;
      if (position.valuationAvailable) item.amount += position.marketValue;
      map.set(value, item);
    }
    return [...map.values()].map((item) => ({
      ...item,
      amount: valuationAvailable ? round(item.amount) : null,
      percentage: valuationAvailable ? percent(item.amount) : null,
    })).sort((left, right) => (right.amount || 0) - (left.amount || 0));
  };
  return {
    currency,
    valuationAvailable,
    missingPriceCount: positions.filter((item) => !item.valuationAvailable).length,
    cash,
    marketValue,
    totalValue,
    cashVersusInvested: [
      { key: 'cash', amount: cash, percentage: percent(cash) },
      { key: 'invested', amount: marketValue, percentage: marketValue == null ? null : percent(marketValue) },
    ],
    byAccount: group('accountId', (item) => item.accountName || item.accountCompany),
    byAssetType: group('assetType', (item) => item.assetType),
    byInstrument: group('instrumentId', (item) => item.symbol),
  };
}

export async function getScope(userId, accountId, queryable = pool) {
  const scope = await resolveInvestmentScope(userId, accountId, queryable);
  return { scope: { ...scope, portfolioIds: undefined } };
}

export async function getOverview(userId, filters = {}, queryable = pool) {
  const scope = await resolveInvestmentScope(userId, filters.accountId, queryable);
  const ledger = await loadLedger(userId, scope, queryable);
  const holdings = currentHoldings(ledger.current);
  const dividends = ledger.transactions.filter((item) => item.transactionType === 'dividend');
  const history = buildPerformanceSeries(scope, ledger).slice(-24);
  return {
    scope: { ...scope, portfolioIds: undefined },
    currencyGroups: groupCurrent(ledger.current),
    topHoldings: [...holdings].sort((a, b) => (b.marketValue ?? -1) - (a.marketValue ?? -1)).slice(0, 5),
    recentTransactions: [...ledger.transactions].reverse().slice(0, 8),
    dividendSummary: {
      paymentCount: dividends.length,
      currencies: Object.values(dividends.reduce((groups, item) => {
        const group = groups[item.currency] || { currency: item.currency, gross: 0, fees: 0, net: 0 };
        group.gross += item.amount || 0; group.fees += item.fees || 0; group.net += (item.amount || 0) - (item.fees || 0);
        groups[item.currency] = group; return groups;
      }, {})).map((item) => ({ ...item, gross: round(item.gross), fees: round(item.fees), net: round(item.net) })),
    },
    allocationPreview: [...new Set(ledger.current.map((item) => item.baseCurrency))].map((currency) => allocationForCurrency(currency, ledger.current)),
    valueHistory: history,
  };
}

export async function getHoldings(userId, filters = {}, queryable = pool) {
  const scope = await resolveInvestmentScope(userId, filters.accountId, queryable);
  const ledger = await loadLedger(userId, scope, queryable);
  let holdings = currentHoldings(ledger.current);
  if (filters.search) {
    const search = filters.search.toLowerCase();
    holdings = holdings.filter((item) => `${item.symbol || ''} ${item.name || ''}`.toLowerCase().includes(search));
  }
  if (filters.assetType) holdings = holdings.filter((item) => item.assetType === filters.assetType);
  if (filters.priceAvailability === 'available') holdings = holdings.filter((item) => item.valuationAvailable);
  if (filters.priceAvailability === 'missing') holdings = holdings.filter((item) => !item.valuationAvailable);
  return { scope: { ...scope, portfolioIds: undefined }, holdings };
}

export async function getTransactions(userId, filters = {}, queryable = pool) {
  const scope = await resolveInvestmentScope(userId, filters.accountId, queryable);
  if (!scope.portfolioIds.length) return { scope: { ...scope, portfolioIds: undefined }, transactions: [], total: 0, limit: filters.limit, offset: filters.offset };
  const params = [userId, scope.portfolioIds];
  const conditions = ['t.user_id = $1', 't.portfolio_id = ANY($2::uuid[])'];
  for (const [key, column] of [['instrumentId', 't.instrument_id'], ['transactionType', 't.transaction_type']]) {
    if (filters[key]) { params.push(filters[key]); conditions.push(`${column} = $${params.length}`); }
  }
  if (filters.from) { params.push(filters.from); conditions.push(`t.transaction_date >= $${params.length}::date`); }
  if (filters.to) { params.push(filters.to); conditions.push(`t.transaction_date <= $${params.length}::date`); }
  if (filters.search) {
    params.push(`%${filters.search.trim()}%`);
    conditions.push(`(i.symbol ILIKE $${params.length} OR i.name ILIKE $${params.length} OR t.notes ILIKE $${params.length})`);
  }
  const countParams = [...params];
  params.push(filters.limit); const limit = `$${params.length}`;
  params.push(filters.offset); const offset = `$${params.length}`;
  const from = `FROM investment_transactions t
    JOIN investment_portfolios p ON p.id=t.portfolio_id AND p.user_id=t.user_id
    JOIN trading_accounts a ON a.id=p.trading_account_id AND a.user_id=p.user_id
    LEFT JOIN investment_instruments i ON i.id=t.instrument_id AND i.user_id=t.user_id
    WHERE ${conditions.join(' AND ')}`;
  const [rows, count] = await Promise.all([
    queryable.query(`SELECT t.*, p.name AS portfolio_name, i.symbol AS instrument_symbol,
      i.name AS instrument_name, i.exchange AS instrument_exchange, i.asset_type AS instrument_asset_type,
      a.id AS account_id, a.account_name, a.company AS account_company, a.account_number
      ${from} ORDER BY t.transaction_date DESC, t.created_at DESC, t.id DESC LIMIT ${limit} OFFSET ${offset}`, params),
    queryable.query(`SELECT COUNT(*)::int AS count ${from}`, countParams),
  ]);
  return {
    scope: { ...scope, portfolioIds: undefined },
    transactions: rows.rows.map(mapWorkspaceTransaction),
    total: Number(count.rows[0]?.count || 0),
    limit: filters.limit,
    offset: filters.offset,
  };
}

export async function getDividends(userId, filters = {}, queryable = pool) {
  const scope = await resolveInvestmentScope(userId, filters.accountId, queryable);
  const ledger = await loadLedger(userId, scope, queryable);
  const history = ledger.transactions.filter((item) => item.transactionType === 'dividend'
    && (!filters.from || item.transactionDate >= filters.from)
    && (!filters.to || item.transactionDate <= filters.to));
  const summarize = (key, label) => Object.values(history.reduce((groups, item) => {
    const value = key(item);
    const groupKey = `${item.currency}:${value}`;
    const group = groups[groupKey] || { key: value, label: label(item), currency: item.currency, gross: 0, fees: 0, net: 0, payments: 0 };
    group.gross += item.amount || 0; group.fees += item.fees || 0; group.net += (item.amount || 0) - (item.fees || 0); group.payments += 1;
    groups[groupKey] = group; return groups;
  }, {})).map((item) => ({ ...item, gross: round(item.gross), fees: round(item.fees), net: round(item.net) }));
  const currencyGroups = summarize(() => 'total', () => '').map((item) => {
    const payments = history.filter((row) => row.currency === item.currency);
    const instruments = new Set(payments.map((row) => row.instrumentId));
    const byInstrument = summarize((row) => row.instrumentId, (row) => row.instrumentSymbol).filter((row) => row.currency === item.currency);
    return {
      ...item,
      payingInstrumentCount: instruments.size,
      topPayingInstrument: [...byInstrument].sort((a, b) => b.net - a.net)[0] || null,
      latestPaymentDate: payments.map((row) => row.transactionDate).sort().at(-1) || null,
    };
  });
  return {
    scope: { ...scope, portfolioIds: undefined }, currencyGroups,
    byMonth: summarize((item) => item.transactionDate.slice(0, 7), (item) => item.transactionDate.slice(0, 7)),
    byInstrument: summarize((item) => item.instrumentId, (item) => item.instrumentSymbol),
    byAccount: summarize((item) => item.accountId, (item) => item.accountName || item.accountCompany),
    history: [...history].reverse().map((item) => ({
      ...item,
      grossAmount: round(item.amount),
      netAmount: round((item.amount || 0) - (item.fees || 0)),
    })),
  };
}

export async function getPerformance(userId, filters = {}, queryable = pool) {
  const scope = await resolveInvestmentScope(userId, filters.accountId, queryable);
  const ledger = await loadLedger(userId, scope, queryable);
  return {
    scope: { ...scope, portfolioIds: undefined },
    series: buildPerformanceSeries(scope, ledger, filters),
    current: groupCurrent(ledger.current),
  };
}

export async function getAllocation(userId, filters = {}, queryable = pool) {
  const scope = await resolveInvestmentScope(userId, filters.accountId, queryable);
  const ledger = await loadLedger(userId, scope, queryable);
  return {
    scope: { ...scope, portfolioIds: undefined },
    currencyGroups: [...new Set(ledger.current.map((item) => item.baseCurrency))]
      .sort().map((currency) => allocationForCurrency(currency, ledger.current)),
  };
}
