import assert from 'node:assert/strict';
import { afterEach, describe, test } from 'node:test';
import pool from '../db/client.js';
import { createSchema, filtersSchema, updateSchema } from '../routes/trades.js';
import { computeFields, createTrade, exportTradesCsv, listTrades, updateTrade, validateTradeState } from './tradeService.js';

const originalQuery = pool.query;
const userId = '11111111-1111-4111-8111-111111111111';
const accountId = '22222222-2222-4222-8222-222222222222';
const tradeId = '33333333-3333-4333-8333-333333333333';

afterEach(() => { pool.query = originalQuery; });

function createPayload(overrides = {}) {
  return {
    accountId,
    symbol: 'AAPL',
    market: 'stocks',
    direction: 'long',
    entryDatetime: '2026-08-01T10:00:00.000Z',
    entryPrice: 100,
    quantity: 2,
    fees: 1,
    ...overrides,
  };
}

function tradeRow(overrides = {}) {
  return {
    id: tradeId,
    user_id: userId,
    account_id: accountId,
    symbol: 'AAPL',
    market: 'stocks',
    direction: 'long',
    entry_datetime: '2026-08-01T10:00:00.000Z',
    exit_datetime: null,
    entry_price: '100',
    exit_price: null,
    quantity: '2',
    fees: '1',
    strategy: null,
    setup: null,
    timeframe: null,
    risk_amount: null,
    stop_loss: null,
    take_profit: null,
    notes: null,
    emotions: null,
    screenshot_links: null,
    status: 'open',
    pnl_gross: null,
    pnl_net: null,
    r_multiple: null,
    duration_minutes: null,
    created_at: '2026-08-01T10:00:00.000Z',
    updated_at: '2026-08-01T10:00:00.000Z',
    ...overrides,
  };
}

describe('trade exit-field validation', () => {
  test('accepts valid open and closed create payloads', () => {
    assert.equal(createSchema.safeParse(createPayload()).success, true);
    assert.equal(createSchema.safeParse(createPayload({
      exitDatetime: '2026-08-01T11:00:00.000Z',
      exitPrice: 105,
    })).success, true);
  });

  test('rejects exit datetime only, exit price only, and an exit before entry', () => {
    assert.equal(createSchema.safeParse(createPayload({ exitDatetime: '2026-08-01T11:00:00.000Z' })).success, false);
    assert.equal(createSchema.safeParse(createPayload({ exitPrice: 105 })).success, false);
    assert.equal(createSchema.safeParse(createPayload({
      exitDatetime: '2026-08-01T09:59:00.000Z',
      exitPrice: 105,
    })).success, false);
  });

  test('preserves empty-string-to-null normalization for partial updates', () => {
    const parsed = updateSchema.safeParse({ exitDatetime: '', exitPrice: '' });
    assert.equal(parsed.success, true);
    assert.deepEqual(parsed.data, { exitDatetime: null, exitPrice: null });
  });

  test('rejects invalid merged state and never silently clears the companion field', () => {
    assert.throws(
      () => validateTradeState(createPayload({ exitDatetime: '2026-08-01T11:00:00.000Z' })),
      error => error.code === 'VALIDATION_ERROR'
    );
    assert.throws(
      () => validateTradeState(createPayload({ exitPrice: 105 })),
      error => error.code === 'VALIDATION_ERROR'
    );
  });
});

describe('trade/account ownership', () => {
  test('same-user account is accepted and ownership query includes user ID', async () => {
    const calls = [];
    pool.query = async (sql, params) => {
      calls.push({ sql, params });
      if (/SELECT id FROM trading_accounts/.test(sql)) return { rows: [{ id: accountId }] };
      if (/INSERT INTO trades/.test(sql)) return { rows: [tradeRow()] };
      throw new Error('Unexpected query');
    };

    const result = await createTrade(userId, createPayload());
    assert.equal(result.id, tradeId);
    assert.match(calls[0].sql, /WHERE id = \$1 AND user_id = \$2/);
    assert.deepEqual(calls[0].params, [accountId, userId]);
    assert.match(calls[1].sql, /INSERT INTO trades/);
  });

  test('foreign and missing accounts return the same not-found error before insert', async () => {
    for (const scenario of ['foreign', 'missing']) {
      const calls = [];
      pool.query = async (sql, params) => {
        calls.push({ sql, params });
        return { rows: [] };
      };

      await assert.rejects(
        () => createTrade(userId, createPayload()),
        error => error.code === 'ACCOUNT_NOT_FOUND' && error.statusCode === 404
      );
      assert.equal(calls.length, 1, scenario);
      assert.match(calls[0].sql, /WHERE id = \$1 AND user_id = \$2/);
      assert.doesNotMatch(calls[0].sql, /INSERT INTO trades/);
    }
  });

  test('update verifies the existing immutable account and does not write after rejection', async () => {
    const calls = [];
    pool.query = async (sql, params) => {
      calls.push({ sql, params });
      if (/SELECT \* FROM trades/.test(sql)) return { rows: [tradeRow()] };
      if (/SELECT id FROM trading_accounts/.test(sql)) return { rows: [] };
      throw new Error('Unexpected query');
    };

    await assert.rejects(
      () => updateTrade(userId, tradeId, { quantity: 3 }),
      error => error.code === 'ACCOUNT_NOT_FOUND' && error.statusCode === 404
    );
    assert.equal(calls.length, 2);
    assert.match(calls[1].sql, /WHERE id = \$1 AND user_id = \$2/);
    assert.deepEqual(calls[1].params, [accountId, userId]);
    assert.doesNotMatch(calls.map(call => call.sql).join('\n'), /UPDATE trades/);
  });
});

describe('trade update state and duration', () => {
  function installUpdateQueries(existingRow = tradeRow()) {
    const calls = [];
    pool.query = async (sql, params) => {
      calls.push({ sql, params });
      if (/SELECT \* FROM trades/.test(sql)) return { rows: [existingRow] };
      if (/SELECT id FROM trading_accounts/.test(sql)) return { rows: [{ id: accountId }] };
      if (/UPDATE trades/.test(sql)) {
        return { rows: [tradeRow({
          exit_datetime: params[2],
          exit_price: params[3],
          quantity: String(params[4]),
          fees: String(params[5]),
          status: params[15],
          pnl_gross: params[16],
          pnl_net: params[17],
          r_multiple: params[18],
          duration_minutes: params[19],
        })] };
      }
      throw new Error('Unexpected query');
    };
    return calls;
  }

  test('partial update that creates an invalid final combination does not update', async () => {
    const calls = installUpdateQueries();
    await assert.rejects(
      () => updateTrade(userId, tradeId, { exitDatetime: '2026-08-01T11:00:00.000Z' }),
      error => error.code === 'VALIDATION_ERROR'
    );
    assert.equal(calls.filter(call => /UPDATE trades/.test(call.sql)).length, 0);
  });

  test('partial update can close a trade and derives a nonnegative duration', async () => {
    installUpdateQueries();
    const result = await updateTrade(userId, tradeId, {
      exitDatetime: '2026-08-01T11:15:00.000Z',
      exitPrice: 105,
    });
    assert.equal(result.status, 'closed');
    assert.equal(result.durationMinutes, 75);
    assert.equal(result.pnlNet, 9);
  });

  test('partial update can reopen a trade only when both exit fields are null', async () => {
    installUpdateQueries(tradeRow({
      exit_datetime: '2026-08-01T11:15:00.000Z',
      exit_price: '105',
      status: 'closed',
      pnl_gross: '10',
      pnl_net: '9',
      duration_minutes: 75,
    }));
    const result = await updateTrade(userId, tradeId, { exitDatetime: null, exitPrice: null });
    assert.equal(result.status, 'open');
    assert.equal(result.durationMinutes, null);
    assert.equal(result.pnlNet, null);
  });

  test('exit-before-entry is rejected before duration calculation or update', async () => {
    const calls = installUpdateQueries();
    await assert.rejects(
      () => updateTrade(userId, tradeId, {
        exitDatetime: '2026-08-01T09:59:00.000Z',
        exitPrice: 99,
      }),
      error => error.code === 'VALIDATION_ERROR'
    );
    assert.equal(calls.filter(call => /UPDATE trades/.test(call.sql)).length, 0);
  });

  test('computeFields keeps open duration null and valid closed duration nonnegative', () => {
    assert.equal(computeFields(createPayload()).durationMinutes, null);
    assert.equal(computeFields(createPayload({
      exitDatetime: '2026-08-01T10:00:00.000Z',
      exitPrice: 100,
    })).durationMinutes, 0);
    assert.throws(() => computeFields(createPayload({
      exitDatetime: '2026-08-01T09:59:00.000Z',
      exitPrice: 99,
    })), error => error.code === 'VALIDATION_ERROR');
  });
});

describe('trade list timezone boundaries', () => {
  test('validates strict inclusive product date filters', () => {
    assert.equal(filtersSchema.safeParse({ from: '2026-03-27', to: '2026-03-28' }).success, true);
    assert.equal(filtersSchema.safeParse({ from: '2026-02-30' }).success, false);
    assert.equal(filtersSchema.safeParse({ from: '2026-03-28', to: '2026-03-27' }).success, false);
  });

  test('list uses parameterized local start and exclusive day-after-to boundaries', async () => {
    const calls = [];
    pool.query = async (sql, params) => {
      calls.push({ sql, params });
      return /COUNT/.test(sql) ? { rows: [{ count: '0' }] } : { rows: [] };
    };
    await listTrades(userId, { from: '2026-03-27', to: '2026-03-28' }, 'Asia/Jerusalem');
    const dataCall = calls.find((call) => /SELECT \*/.test(call.sql));
    assert.match(dataCall.sql, /entry_datetime >= \(\$2::date::timestamp AT TIME ZONE \$3\)/);
    assert.match(dataCall.sql, /entry_datetime < \(\(\$4::date \+ 1\)::timestamp AT TIME ZONE \$3\)/);
    assert.deepEqual(dataCall.params.slice(0, 4), [userId, '2026-03-27', 'Asia/Jerusalem', '2026-03-28']);
  });

  test('CSV export delegates to the identical list boundary semantics', async () => {
    const calls = [];
    pool.query = async (sql, params) => {
      calls.push({ sql, params });
      return /COUNT/.test(sql) ? { rows: [{ count: '0' }] } : { rows: [] };
    };
    assert.deepEqual(
      await exportTradesCsv(userId, { from: '2026-11-01', to: '2026-11-01' }, 'America/New_York'),
      [],
    );
    const dataCall = calls.find((call) => /SELECT \*/.test(call.sql));
    assert.match(dataCall.sql, /entry_datetime >=/);
    assert.match(dataCall.sql, /entry_datetime </);
    assert.deepEqual(dataCall.params.slice(0, 4), [userId, '2026-11-01', 'America/New_York', '2026-11-01']);
  });
});
