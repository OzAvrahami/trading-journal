import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { dateRangeSchema, holdingsSchema, scopeSchema, transactionsSchema } from '../routes/investments.js';
import { allocationForCurrency, buildPerformanceSeries, getDividends, groupCurrent, resolveInvestmentScope } from './investmentWorkspaceService.js';

const userId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const accountId = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const portfolioId = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';
const instrumentId = 'dddddddd-dddd-4ddd-8ddd-dddddddddddd';
const accountRow = {
  account_id: accountId, account_name: 'IBKR', company: 'Interactive Brokers', account_number: 'U123',
  account_status: 'active', include_in_investment_value: true, base_currency: 'USD',
  portfolio_id: portfolioId, portfolio_status: 'active', portfolio_name: 'Ledger',
};

describe('Investment workspace validation and scope ownership', () => {
  test('accepts only supported filters and exact dates', () => {
    assert.equal(scopeSchema.safeParse({ accountId }).success, true);
    assert.equal(scopeSchema.safeParse({ accountId: 'not-a-uuid' }).success, false);
    assert.equal(holdingsSchema.safeParse({ assetType: 'stock', priceAvailability: 'missing' }).success, true);
    assert.equal(transactionsSchema.safeParse({ from: '2026-08-01', to: '2026-08-31', limit: '25', offset: '0' }).success, true);
    assert.equal(transactionsSchema.safeParse({ from: '2026-08-31', to: '2026-08-01' }).success, false);
    assert.equal(dateRangeSchema.safeParse({ from: '2026-02-30' }).success, false);
    assert.equal(scopeSchema.safeParse({ userId }).success, false);
  });

  test('all-scope is user-scoped and returns only linked rows supplied by the aggregate query', async () => {
    const calls = [];
    const queryable = { query: async (sql, params) => {
      calls.push({ sql, params });
      return calls.length === 1 ? { rows: [accountRow] } : { rows: [] };
    } };
    const scope = await resolveInvestmentScope(userId, null, queryable);
    assert.deepEqual(scope.portfolioIds, [portfolioId]);
    assert.equal(scope.accounts[0].accountId, accountId);
    assert.equal(calls[0].params[0], userId);
    assert.match(calls[0].sql, /a\.user_id = \$1/);
    assert.match(calls[0].sql, /include_in_investment_value = TRUE/);
    assert.match(calls[0].sql, /a\.status = 'active'/);
    assert.match(calls[0].sql, /p\.status = 'active'/);
    assert.match(calls[1].sql, /user_id = \$1 AND trading_account_id IS NULL/);
  });

  test('explicit archived or disabled scope remains readable without exposing foreign or unlinked Accounts', async () => {
    const historical = { ...accountRow, account_status: 'archived', include_in_investment_value: false };
    const queryable = { query: async (sql) => /trading_account_id IS NULL/.test(sql) ? { rows: [] } : { rows: [historical] } };
    const scope = await resolveInvestmentScope(userId, accountId, queryable);
    assert.equal(scope.selectedAccount.accountId, accountId);
    assert.equal(scope.historicalScope, true);
    assert.deepEqual(scope.portfolioIds, [portfolioId]);

    const missing = { query: async (sql) => /trading_account_id IS NULL/.test(sql) ? { rows: [] } : { rows: [] } };
    await assert.rejects(resolveInvestmentScope(userId, accountId, missing), (error) => error.code === 'INVESTMENT_SCOPE_NOT_FOUND' && error.statusCode === 404);
  });
});

describe('Investment workspace calculations reuse canonical replay output', () => {
  const scope = { accounts: [{ accountId, accountName: 'IBKR', company: 'Broker', accountNumber: 'U1', accountStatus: 'active', includeInInvestmentValue: true, baseCurrency: 'USD', portfolioId, portfolioStatus: 'active' }], portfolioIds: [portfolioId] };
  const base = { portfolioId, accountId, accountName: 'IBKR', accountCompany: 'Broker', accountNumber: 'U1', currency: 'USD', createdAt: '2026-01-01T10:00:00Z' };
  const transactions = [
    { ...base, id: '1', transactionType: 'deposit', transactionDate: '2026-01-01', amount: 1000, fees: 0, instrumentId: null },
    { ...base, id: '2', transactionType: 'buy', transactionDate: '2026-01-02', quantity: 5, price: 100, fees: 5, instrumentId, instrumentSymbol: 'VOO', instrumentAssetType: 'etf' },
    { ...base, id: '3', transactionType: 'dividend', transactionDate: '2026-02-01', amount: 20, fees: 1, instrumentId, instrumentSymbol: 'VOO', instrumentAssetType: 'etf' },
  ];
  const ledger = {
    transactions,
    prices: [{ instrumentId, priceDate: '2026-01-03', price: 110, currency: 'USD' }],
    byPortfolio: new Map([[portfolioId, transactions]]),
  };

  test('historical series uses exact DATE points and latest manual price on or before each point', () => {
    const series = buildPerformanceSeries(scope, ledger);
    assert.deepEqual(series.map((item) => item.date), ['2026-01-01', '2026-01-02', '2026-01-03', '2026-02-01']);
    assert.equal(series[0].totalValue, 1000);
    assert.equal(series[1].valuationAvailable, false);
    assert.equal(series[1].totalValue, null);
    assert.equal(series[2].marketValue, 550);
    assert.equal(series[2].totalValue, 1045);
    assert.equal(series[3].dividendIncome, 20);
    assert.equal(series[3].totalValue, 1064);
  });

  test('currency grouping never combines currencies and keeps unavailable money null', () => {
    const groups = groupCurrent([
      { baseCurrency: 'USD', accountId, positionCount: 1, cashBalance: 100, totalCostBasis: 200, realizedPnl: 10, dividendIncome: 5, totalFees: 2, netContributions: 300, marketValue: 220, unrealizedPnl: 20, totalValue: 320, missingPriceCount: 0, valuationAvailable: true },
      { baseCurrency: 'ILS', accountId: 'other', positionCount: 1, cashBalance: 50, totalCostBasis: 80, realizedPnl: 0, dividendIncome: 0, totalFees: 1, netContributions: 100, marketValue: null, unrealizedPnl: null, totalValue: null, missingPriceCount: 1, valuationAvailable: false },
    ]);
    assert.equal(groups.length, 2);
    assert.equal(groups.find((item) => item.currency === 'USD').totalValue, 320);
    assert.equal(groups.find((item) => item.currency === 'ILS').totalValue, null);
  });

  test('allocation exposes only supported dimensions and requires complete valuation', () => {
    const complete = allocationForCurrency('USD', [{ baseCurrency: 'USD', cashBalance: 100, positions: [{ accountId, accountName: 'IBKR', instrumentId, symbol: 'VOO', assetType: 'etf', currency: 'USD', marketValue: 300, valuationAvailable: true }] }]);
    assert.equal(complete.cashVersusInvested[0].percentage, 0.25);
    assert.equal(complete.byAssetType[0].key, 'etf');
    assert.ok(!('sector' in complete));
    const missing = allocationForCurrency('USD', [{ baseCurrency: 'USD', cashBalance: 100, positions: [{ accountId, instrumentId, symbol: 'VOO', assetType: 'etf', currency: 'USD', marketValue: null, valuationAvailable: false }] }]);
    assert.equal(missing.valuationAvailable, false);
    assert.equal(missing.totalValue, null);
    assert.equal(missing.byInstrument[0].percentage, null);
  });

  test('dividend history is recorded-only and returns server-derived gross, fees, and net amounts', async () => {
    const queryable = { query: async (sql) => {
      if (/FROM trading_accounts a/.test(sql)) return { rows: [accountRow] };
      if (/trading_account_id IS NULL/.test(sql)) return { rows: [] };
      if (/FROM investment_prices pr/.test(sql)) return { rows: [] };
      if (/FROM investment_transactions t/.test(sql)) return { rows: [{
        id: 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee', portfolio_id: portfolioId,
        instrument_id: instrumentId, transaction_type: 'dividend', transaction_date: '2026-02-01',
        quantity: null, price: null, amount: '20.00', fees: '1.50', currency: 'USD', notes: 'Recorded payment',
        created_at: '2026-02-01T10:00:00Z', updated_at: '2026-02-01T10:00:00Z',
        portfolio_name: 'Ledger', instrument_symbol: 'VOO', instrument_name: 'Fund', instrument_exchange: 'NYSEARCA',
        instrument_asset_type: 'etf', account_id: accountId, account_name: 'IBKR', account_company: 'Broker', account_number: 'U1',
      }] };
      throw new Error(`Unexpected query: ${sql}`);
    } };
    const result = await getDividends(userId, {}, queryable);
    assert.equal(result.currencyGroups[0].gross, 20);
    assert.equal(result.currencyGroups[0].fees, 1.5);
    assert.equal(result.currencyGroups[0].net, 18.5);
    assert.equal(result.history[0].grossAmount, 20);
    assert.equal(result.history[0].netAmount, 18.5);
    assert.equal(result.history[0].transactionType, 'dividend');
  });
});
