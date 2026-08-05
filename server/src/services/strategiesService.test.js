import assert from 'node:assert/strict';
import { afterEach, describe, test } from 'node:test';
import pool from '../db/client.js';
import { createStrategySchema, updateStrategySchema } from '../routes/strategies.js';
import { createSetupSchema, updateSetupSchema } from '../routes/setups.js';
import {
  calculateProfitFactor, createSetup, createStrategy, listLegacyClassifications,
  listSetups, listStrategies, resolveTradeClassification, updateSetup, updateStrategy,
} from './strategiesService.js';

const originalQuery = pool.query;
const userId = '11111111-1111-4111-8111-111111111111';
const strategyId = '22222222-2222-4222-8222-222222222222';
const setupId = '33333333-3333-4333-8333-333333333333';
afterEach(() => { pool.query = originalQuery; });

describe('managed classification validation', () => {
  test('normalizes descriptions and rejects blank or unexpected fields', () => {
    assert.deepEqual(createStrategySchema.parse({ name: ' ORB ', description: ' ' }), { name: 'ORB', description: null });
    assert.equal(createStrategySchema.safeParse({ name: ' ' }).success, false);
    assert.equal(createStrategySchema.safeParse({ name: 'x'.repeat(101) }).success, false);
    assert.equal(createSetupSchema.safeParse({ strategyId, name: 'Retest', userId }).success, false);
  });
  test('Setup parent is immutable in PATCH validation', () => {
    assert.equal(updateSetupSchema.safeParse({ name: 'New' }).success, true);
    assert.equal(updateSetupSchema.safeParse({ strategyId }).success, false);
    assert.equal(updateStrategySchema.safeParse({}).success, false);
  });
});

describe('managed performance and ownership', () => {
  test('preserves the Analytics profit-factor definition', () => {
    assert.equal(calculateProfitFactor(170, 100), 1.7);
    assert.equal(calculateProfitFactor(0, 0), 0);
    assert.equal(calculateProfitFactor(50, 0), null);
  });
  test('lists Strategies and summary with user-scoped set-based queries', async () => {
    const calls = [];
    const queryable = { query: async (sql, params) => {
      calls.push({ sql, params });
      if (/WITH setup_counts/.test(sql)) return { rows: [{ id: strategyId, name: 'ORB', description: null, is_active: true, setup_count: 2, active_setup_count: 1, closed_trades: 3, open_trades: 1, winners: 2, losers: 1, breakeven: 0, pnl_net: '70', average_r: '0.5', gross_profit: '170', gross_loss: '100' }] };
      return { rows: [{ active_strategies: 1, active_setups: 1, managed_closed_trades: 3, unlinked_closed_trades: 2 }] };
    } };
    const result = await listStrategies(userId, { includeArchived: true }, queryable);
    assert.equal(result.strategies[0].profitFactor, 1.7);
    assert.equal(result.strategies[0].winRate, 0.6667);
    assert.equal(result.summary.unlinkedClosedTrades, 2);
    assert.ok(calls.every((call) => call.params[0] === userId));
    assert.equal(calls.length, 2);
  });
  test('lists Setups with owned Strategy filtering and honest unavailable metrics', async () => {
    const queryable = { query: async (sql, params) => {
      assert.match(sql, /su\.user_id = \$1/);
      assert.deepEqual(params, [userId, strategyId, true]);
      return { rows: [{ id: setupId, strategy_id: strategyId, strategy_name: 'ORB', name: 'Retest', is_active: true, closed_trades: 0, open_trades: 1, pnl_net: 0 }] };
    } };
    const setup = (await listSetups(userId, { strategyId, includeArchived: true }, queryable)).setups[0];
    assert.equal(setup.winRate, null);
    assert.equal(setup.averageR, null);
    assert.equal(setup.profitFactor, null);
  });
  test('legacy reporting is read-only, deterministic, and user-scoped', async () => {
    const queryable = { query: async (sql, params) => {
      assert.match(sql, /strategy_id IS NULL/);
      assert.match(sql, /setup_id IS NULL/);
      assert.match(sql, /user_id = \$1/);
      assert.deepEqual(params, [userId]);
      return { rows: [{ kind: 'strategy', value: 'Legacy ORB', trade_count: 2, closed_trades: 2, winners: 1, pnl_net: '10' }] };
    } };
    const result = await listLegacyClassifications(userId, queryable);
    assert.deepEqual(result.strategies[0], { value: 'Legacy ORB', tradeCount: 2, closedTrades: 2, pnlNet: 10, winRate: 0.5 });
  });
});

describe('managed persistence', () => {
  test('creates owned Strategy and maps duplicate names to a stable conflict', async () => {
    const queryable = { query: async (sql, params) => {
      assert.match(sql, /INSERT INTO strategies/); assert.equal(params[0], userId);
      return { rows: [{ id: strategyId, user_id: userId, name: params[1], description: params[2], is_active: true }] };
    } };
    assert.equal((await createStrategy(userId, { name: ' ORB ', description: '' }, queryable)).strategy.name, 'ORB');
    await assert.rejects(() => createStrategy(userId, { name: 'ORB' }, { query: async () => { const error = new Error('duplicate'); error.code = '23505'; throw error; } }), (error) => error.code === 'STRATEGY_NAME_EXISTS');
  });
  test('updates only owned Strategies and never touches Trade snapshots', async () => {
    const queryable = { query: async (sql, params) => {
      assert.match(sql, /WHERE id = \$1 AND user_id = \$2/);
      assert.doesNotMatch(sql, /UPDATE trades/);
      return { rows: [{ id: strategyId, name: 'Renamed', is_active: false }] };
    } };
    assert.equal((await updateStrategy(userId, strategyId, { name: 'Renamed', isActive: false }, queryable)).strategy.name, 'Renamed');
  });
  test('creates Setup only below an owned active Strategy', async () => {
    let call = 0;
    const queryable = { query: async () => {
      call += 1;
      return call === 1 ? { rows: [{ id: strategyId, name: 'ORB', is_active: true }] } : { rows: [{ id: setupId, strategy_id: strategyId, name: 'Retest', is_active: true }] };
    } };
    assert.equal((await createSetup(userId, { strategyId, name: 'Retest' }, queryable)).setup.strategyName, 'ORB');
  });
  test('foreign parent and foreign Setup remain inaccessible', async () => {
    await assert.rejects(() => createSetup(userId, { strategyId, name: 'Retest' }, { query: async () => ({ rows: [] }) }), (error) => error.code === 'STRATEGY_NOT_FOUND');
    await assert.rejects(() => updateSetup(userId, setupId, { name: 'X' }, { query: async () => ({ rows: [] }) }), (error) => error.code === 'SETUP_NOT_FOUND');
  });
});

describe('Trade classification resolver', () => {
  test('rejects Setup without Strategy, foreign IDs, and mismatched relationships', async () => {
    await assert.rejects(() => resolveTradeClassification(userId, { setupId }), (error) => error.code === 'SETUP_REQUIRES_STRATEGY');
    await assert.rejects(() => resolveTradeClassification(userId, { strategyId }, { queryable: { query: async () => ({ rows: [] }) } }), (error) => error.code === 'STRATEGY_NOT_FOUND');
    let calls = 0;
    const queryable = { query: async () => (++calls === 1
      ? { rows: [{ id: strategyId, name: 'ORB', is_active: true }] }
      : { rows: [{ id: setupId, strategy_id: '44444444-4444-4444-8444-444444444444', name: 'Wrong', is_active: true }] }) };
    await assert.rejects(() => resolveTradeClassification(userId, { strategyId, setupId }, { queryable }), (error) => error.code === 'SETUP_STRATEGY_MISMATCH');
  });
  test('allows an unchanged archived link during edit but rejects a new archived selection', async () => {
    const queryable = { query: async () => ({ rows: [{ id: strategyId, name: 'Archived', is_active: false }] }) };
    assert.equal((await resolveTradeClassification(userId, { strategyId }, { currentStrategyId: strategyId, queryable })).strategy.id, strategyId);
    await assert.rejects(() => resolveTradeClassification(userId, { strategyId }, { queryable }), (error) => error.code === 'STRATEGY_ARCHIVED');
  });
});
