import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { afterEach, describe, test } from 'node:test';
import pool from '../db/client.js';
import { createSchema, updateSchema } from '../routes/accounts.js';
import {
  createAccount,
  getScopeCurrencyMetadata,
  mapAccount,
  updateAccount,
  validateAccountOwnership,
} from './accountService.js';

const migration = readFileSync(new URL('../db/migrations/012_accounts_expansion.sql', import.meta.url), 'utf8');
const userId = '11111111-1111-4111-8111-111111111111';
const accountId = '22222222-2222-4222-8222-222222222222';
const originalConnect = pool.connect;

afterEach(() => { pool.connect = originalConnect; });

function row(overrides = {}) {
  return {
    id: accountId, user_id: userId, company: 'broker', account_number: 'A-1', account_name: 'Main',
    account_type: 'live', status: 'active', base_currency: 'USD', opening_balance: '10000', is_default: false,
    trades_count: 4, closed_trades: 3, open_trades: 1, winners: 1, losers: 1, breakeven: 1,
    pnl_net: '250', total_fees: '12', average_r: '0.5', gross_profit: '500', gross_loss: '250',
    last_trade_at: '2026-08-04T10:00:00.000Z', created_at: '2026-01-01T00:00:00.000Z', updated_at: '2026-01-01T00:00:00.000Z',
    ...overrides,
  };
}

describe('Accounts expansion migration contract', () => {
  test('adds only account metadata with safe defaults and exact currency validation', () => {
    assert.match(migration, /ADD COLUMN IF NOT EXISTS base_currency VARCHAR\(3\) NOT NULL DEFAULT 'USD'/);
    assert.match(migration, /ADD COLUMN IF NOT EXISTS opening_balance NUMERIC\(18,2\) NOT NULL DEFAULT 0/);
    assert.match(migration, /ADD COLUMN IF NOT EXISTS is_default BOOLEAN NOT NULL DEFAULT FALSE/);
    assert.match(migration, /CHECK \(base_currency ~ '\^\[A-Z\]\{3\}\$'\)/);
  });

  test('enforces one active default per user without changing Trade relationships', () => {
    assert.match(migration, /CREATE UNIQUE INDEX IF NOT EXISTS trading_accounts_one_default_per_user[\s\S]*WHERE is_default = TRUE/);
    assert.match(migration, /CHECK \(NOT is_default OR status = 'active'\)/);
    assert.doesNotMatch(migration, /ALTER TABLE trades|UPDATE trades|DELETE FROM|TRUNCATE|DROP TABLE/i);
  });

  test('is transactional, idempotent, and adds no RLS or ledger', () => {
    assert.match(migration, /^\s*--[\s\S]*BEGIN;/);
    assert.match(migration, /COMMIT;\s*$/);
    assert.match(migration, /IF NOT EXISTS/g);
    assert.doesNotMatch(migration, /ENABLE ROW LEVEL SECURITY|deposit|withdrawal|ledger/i);
  });
});

describe('Account validation and calculated metrics', () => {
  test('normalizes currency and rejects invalid currency or client metrics', () => {
    const parsed = createSchema.parse({ company: ' Broker ', accountNumber: ' A-1 ', baseCurrency: 'usd', openingBalance: -25 });
    assert.equal(parsed.baseCurrency, 'USD');
    assert.equal(parsed.openingBalance, -25);
    assert.equal(createSchema.safeParse({ company: 'Broker', accountNumber: 'A-1', baseCurrency: 'US' }).success, false);
    assert.equal(createSchema.safeParse({ company: 'Broker', accountNumber: 'A-1', pnlNet: 10 }).success, false);
  });

  test('maps stored Trade metrics and tracked balance without unrealized PnL', () => {
    const account = mapAccount(row());
    assert.deepEqual({ closed: account.closedTrades, open: account.openTrades, winners: account.winners, losers: account.losers, breakeven: account.breakeven }, { closed: 3, open: 1, winners: 1, losers: 1, breakeven: 1 });
    assert.equal(account.pnlNet, 250);
    assert.equal(account.totalFees, 12);
    assert.equal(account.winRate, 0.3333);
    assert.equal(account.averageR, 0.5);
    assert.equal(account.profitFactor, 2);
    assert.equal(account.trackedBalance, 10250);
  });

  test('returns honest unavailable averages with no eligible closed Trades', () => {
    const account = mapAccount(row({ closed_trades: 0, open_trades: 2, winners: 0, losers: 0, breakeven: 0, average_r: null, gross_profit: 0, gross_loss: 0 }));
    assert.equal(account.winRate, null);
    assert.equal(account.averageR, null);
    assert.equal(account.profitFactor, null);
  });

  test('reports single and mixed currency scopes without conversion', async () => {
    const single = await getScopeCurrencyMetadata(userId, {}, { query: async () => ({ rows: [{ currencies: ['USD'] }] }) });
    const mixed = await getScopeCurrencyMetadata(userId, {}, { query: async () => ({ rows: [{ currencies: ['ILS', 'USD'] }] }) });
    assert.deepEqual(single, { currency: 'USD', currencies: ['USD'], isMixedCurrency: false, monetaryTotalsAvailable: true });
    assert.deepEqual(mixed, { currency: null, currencies: ['ILS', 'USD'], isMixedCurrency: true, monetaryTotalsAvailable: false });
  });

  test('requires active ownership for new Trade selection but permits historical ownership checks', async () => {
    const queries = [];
    const queryable = { query: async sql => { queries.push(sql); return { rows: queries.length === 1 ? [] : [{ id: accountId }] }; } };
    await assert.rejects(() => validateAccountOwnership(userId, accountId, { requireActive: true, queryable }), error => error.code === 'ACCOUNT_NOT_FOUND');
    assert.match(queries[0], /status = 'active'/);
    assert.deepEqual(await validateAccountOwnership(userId, accountId, { queryable }), { id: accountId });
    assert.doesNotMatch(queries[1], /status = 'active'/);
  });
});

describe('Default and archive transactions', () => {
  function installClient(handler) {
    const calls = [];
    const client = { query: async (sql, params = []) => { calls.push({ sql, params }); return handler(sql, params); }, release() {} };
    pool.connect = async () => client;
    return calls;
  }

  test('creating a default locks owned Accounts, clears the prior default, then inserts', async () => {
    const calls = installClient((sql) => {
      if (/INSERT INTO trading_accounts/.test(sql)) return { rows: [row({ is_default: true })] };
      if (/WITH trade_metrics/.test(sql)) return { rows: [row({ is_default: true })] };
      return { rows: [] };
    });
    const created = await createAccount(userId, { company: 'Broker', accountNumber: 'A-1', accountName: null, accountType: 'live', status: 'active', baseCurrency: 'usd', openingBalance: 10000, isDefault: true });
    assert.equal(created.isDefault, true);
    assert.deepEqual(calls.map(call => call.sql.trim().split(/\s+/).slice(0, 3).join(' ')), ['BEGIN', 'SELECT id FROM', 'UPDATE trading_accounts SET', 'INSERT INTO trading_accounts', 'WITH trade_metrics AS', 'COMMIT']);
  });

  test('archiving an owned default clears default in the same Account update and commits', async () => {
    let metricReads = 0;
    const calls = installClient((sql) => {
      if (/WITH trade_metrics/.test(sql)) {
        metricReads += 1;
        return { rows: [row(metricReads === 1 ? { is_default: true } : { status: 'archived', is_default: false })] };
      }
      if (/UPDATE trading_accounts SET company/.test(sql)) return { rows: [row({ status: 'archived', is_default: false })] };
      return { rows: [] };
    });
    const updated = await updateAccount(userId, accountId, { status: 'archived' });
    assert.equal(updated.status, 'archived');
    assert.equal(updated.isDefault, false);
    const write = calls.find(call => /UPDATE trading_accounts SET company/.test(call.sql));
    assert.equal(write.params[9], false);
    assert.equal(calls.some(call => /COMMIT/.test(call.sql)), true);
  });

  test('restore leaves an Account non-default unless explicitly selected', () => {
    const parsed = updateSchema.parse({ status: 'active' });
    assert.deepEqual(parsed, { status: 'active' });
  });
});
