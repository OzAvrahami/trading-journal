import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { describe, test } from 'node:test';
import { createSchema, linkPortfolioSchema, updateSchema } from '../routes/accounts.js';
import { buildQueryParts } from './analyticsService.js';
import { mapAccount } from './accountService.js';
import { generateDemoDataset } from '../db/demoSeedData.js';

const migration = readFileSync(new URL('../db/migrations/016_unified_accounts_investments.sql', import.meta.url), 'utf8');
const accountId = '11111111-1111-4111-8111-111111111111';

describe('Unified Accounts and Investments migration', () => {
  test('adds explicit Account grouping and participation with compatibility defaults', () => {
    assert.match(migration, /account_group TEXT NOT NULL DEFAULT 'active_trading'/);
    for (const key of ['personal_investment', 'active_trading', 'prop_firm']) assert.match(migration, new RegExp(key));
    assert.match(migration, /include_in_investment_value BOOLEAN NOT NULL DEFAULT FALSE/);
    assert.match(migration, /include_in_net_worth BOOLEAN NOT NULL DEFAULT FALSE/);
    assert.match(migration, /include_in_trading_analytics BOOLEAN NOT NULL DEFAULT TRUE/);
    assert.match(migration, /include_in_investment_value = FALSE AND include_in_net_worth = FALSE/);
  });

  test('links at most one owned same-currency Portfolio to an Account', () => {
    assert.match(migration, /ADD COLUMN IF NOT EXISTS trading_account_id UUID/);
    assert.match(migration, /CREATE UNIQUE INDEX IF NOT EXISTS investment_portfolios_one_per_trading_account[\s\S]*ON investment_portfolios \(trading_account_id\)/);
    assert.match(migration, /validate_investment_portfolio_account_context/);
    assert.match(migration, /investment_portfolios_trading_account_owner/);
    assert.match(migration, /investment_portfolios_trading_account_currency_match/);
    assert.match(migration, /ON DELETE RESTRICT/);
  });

  test('preserves existing rows and contains no matching or destructive rewrite', () => {
    assert.match(migration, /^\s*--[\s\S]*BEGIN;/);
    assert.match(migration, /COMMIT;\s*$/);
    assert.doesNotMatch(migration, /DELETE FROM|TRUNCATE|DROP TABLE|UPDATE\s+(trading_accounts|investment_portfolios)|similarity\(|levenshtein|fuzzy/i);
    assert.doesNotMatch(migration, /ALTER TABLE\s+trades|UPDATE\s+trades/i);
  });

  test('blocks new activity through an archived linked Account without replacing the Portfolio engine', () => {
    assert.match(migration, /investment_transactions_linked_account_active/);
    assert.match(migration, /validate_investment_transaction_context/);
    assert.doesNotMatch(migration, /CREATE TABLE\s+holdings|CREATE TABLE\s+positions/i);
  });
});

describe('Account grouping and participation contract', () => {
  test('validates group keys and Prop Firm participation', () => {
    assert.equal(createSchema.safeParse({ company: 'Broker', accountNumber: '1', accountGroup: 'other' }).success, false);
    assert.equal(createSchema.safeParse({ company: 'Broker', accountNumber: '1', accountGroup: 'prop_firm', includeInInvestmentValue: true }).success, false);
    assert.equal(createSchema.safeParse({ company: 'Broker', accountNumber: '1', accountGroup: 'prop_firm', includeInTradingAnalytics: true }).success, true);
  });

  test('accepts additive participation updates and a strict owned-link payload shape', () => {
    assert.deepEqual(updateSchema.parse({ includeInInvestmentValue: false }), { includeInInvestmentValue: false });
    assert.deepEqual(linkPortfolioSchema.parse({ portfolioId: accountId }), { portfolioId: accountId });
    assert.equal(linkPortfolioSchema.safeParse({ portfolioId: accountId, userId: accountId }).success, false);
  });

  test('maps linked investment status additively without changing trading metrics', () => {
    const mapped = mapAccount({ id: accountId, user_id: accountId, company: 'broker', account_number: '7', account_name: 'Main', account_type: 'live', account_group: 'active_trading', include_in_investment_value: true, include_in_net_worth: true, include_in_trading_analytics: false, status: 'active', base_currency: 'USD', opening_balance: '100', pnl_net: '25', closed_trades: 1, winners: 1 });
    assert.equal(mapped.accountGroup, 'active_trading');
    assert.equal(mapped.includeInTradingAnalytics, false);
    assert.equal(mapped.trackedBalance, 125);
    assert.equal(mapped.investmentSetupComplete, false);
    assert.equal(mapped.linkedInvestmentPortfolio, null);
  });
});

describe('Trading Analytics Account participation', () => {
  test('cross-account queries require the analytics flag', () => {
    const query = buildQueryParts(accountId, {});
    assert.match(query.join, /trading_accounts/);
    assert.match(query.where, /include_in_trading_analytics = TRUE/);
  });

  test('explicit Account scope remains available even when excluded from aggregates', () => {
    const query = buildQueryParts(accountId, { accountId });
    assert.match(query.where, /t\.account_id/);
    assert.doesNotMatch(query.where, /include_in_trading_analytics/);
  });

  test('Daily Review compatibility can explicitly retain all owned Accounts', () => {
    const query = buildQueryParts(accountId, { includeExcludedAccounts: true });
    assert.doesNotMatch(query.join, /trading_accounts/);
    assert.doesNotMatch(query.where, /include_in_trading_analytics/);
  });
});

describe('Unified demo relationships', () => {
  test('keeps grouping, participation, and Account links deterministic across locales', () => {
    const options = { userId: accountId, timezone: 'Asia/Jerusalem', anchorDate: '2026-08-06' };
    const en = generateDemoDataset({ ...options, locale: 'en' });
    const he = generateDemoDataset({ ...options, locale: 'he' });
    assert.deepEqual(
      en.accounts.map(({ id, accountGroup, includeInInvestmentValue, includeInNetWorth, includeInTradingAnalytics }) => ({ id, accountGroup, includeInInvestmentValue, includeInNetWorth, includeInTradingAnalytics })),
      he.accounts.map(({ id, accountGroup, includeInInvestmentValue, includeInNetWorth, includeInTradingAnalytics }) => ({ id, accountGroup, includeInInvestmentValue, includeInNetWorth, includeInTradingAnalytics })),
    );
    assert.deepEqual(en.investmentPortfolios.map(row => [row.id, row.tradingAccountId]), he.investmentPortfolios.map(row => [row.id, row.tradingAccountId]));
    assert.ok(en.investmentPortfolios.every(row => row.tradingAccountId));
  });
});
