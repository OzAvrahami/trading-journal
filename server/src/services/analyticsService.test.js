import assert from 'node:assert/strict';
import { afterEach, describe, test } from 'node:test';
import pool from '../db/client.js';
import {
  BREAKDOWN_DIMENSIONS,
  R_BUCKETS,
  bucketPnlValues,
  bucketRValues,
  buildQueryParts,
  calculateExpectancy,
  getBreakdown,
  getDistribution,
  getRDistribution,
  getSummary,
} from './analyticsService.js';
import { baseSchema, breakdownSchema } from '../routes/analytics.js';

const originalQuery = pool.query;
const userId = '11111111-1111-4111-8111-111111111111';
const accountId = '22222222-2222-4222-8222-222222222222';

afterEach(() => {
  pool.query = originalQuery;
});

describe('analytics validation and safe dimensions', () => {
  test('whitelists existing dimensions plus market and weekday', () => {
    assert.deepEqual(Object.keys(BREAKDOWN_DIMENSIONS), [
      'symbol', 'strategy', 'timeframe', 'direction', 'account', 'company', 'market', 'weekday',
    ]);
    assert.equal(BREAKDOWN_DIMENSIONS.market.expression, 't.market');
    assert.match(BREAKDOWN_DIMENSIONS.weekday.expression, /ISODOW/);
    assert.equal(breakdownSchema.safeParse({ by: 'market' }).success, true);
    assert.equal(breakdownSchema.safeParse({ by: 'weekday' }).success, true);
  });

  test('rejects invalid dimensions, dates, UUIDs, and reversed ranges', () => {
    assert.equal(breakdownSchema.safeParse({ by: 'strategy; DROP TABLE trades' }).success, false);
    assert.equal(baseSchema.safeParse({ from: '2026-02-30' }).success, false);
    assert.equal(baseSchema.safeParse({ accountId: 'not-a-uuid' }).success, false);
    assert.equal(baseSchema.safeParse({ from: '2026-08-02', to: '2026-08-01' }).success, false);
  });

  test('refuses an unsupported service dimension before issuing SQL', async () => {
    let queried = false;
    pool.query = async () => { queried = true; return { rows: [] }; };
    await assert.rejects(() => getBreakdown(userId, { by: 'strategy; DROP TABLE trades' }), RangeError);
    assert.equal(queried, false);
  });

  test('preserves ownership and date/account/company filter parameterization', () => {
    const accountParts = buildQueryParts(userId, { from: '2026-08-01', to: '2026-08-04', accountId });
    assert.match(accountParts.where, /t\.user_id = \$1/);
    assert.match(accountParts.where, /t\.entry_datetime >= \$2/);
    assert.match(accountParts.where, /t\.entry_datetime <= \$3/);
    assert.match(accountParts.where, /t\.account_id = \$4/);
    assert.deepEqual(accountParts.params, [userId, '2026-08-01', '2026-08-04T23:59:59.999Z', accountId]);

    const companyParts = buildQueryParts(userId, { company: ' Broker A ' });
    assert.match(companyParts.join, /JOIN trading_accounts ta/);
    assert.match(companyParts.where, /ta\.company = \$2/);
    assert.deepEqual(companyParts.params, [userId, 'broker a']);
  });

  test('keeps the existing breakdown response fields and ownership query', async () => {
    let captured;
    pool.query = async (sql, params) => {
      captured = { sql, params };
      return { rows: [{ dimension_key: 'momentum', trades_count: '2', winners: '1', losers: '1', pnl_net: '25.50', avg_r: '0.75' }] };
    };
    const result = await getBreakdown(userId, { by: 'strategy', from: '2026-08-01' });
    assert.match(captured.sql, /WHERE t\.user_id = \$1/);
    assert.match(captured.sql, /t\.status = 'closed'/);
    assert.deepEqual(captured.params, [userId, '2026-08-01']);
    assert.deepEqual(result.data[0], {
      key: 'momentum', label: 'momentum', tradesCount: 2, winners: 1, losers: 1,
      winRate: 0.5, pnlNet: 25.5, avgRMultiple: 0.75,
    });
  });

  test('maps weekdays Monday through Sunday and orders them by ISO weekday', async () => {
    let sql;
    pool.query = async (query) => {
      sql = query;
      return { rows: Array.from({ length: 7 }, (_, index) => ({
        dimension_key: index + 1, trades_count: '1', winners: '0', losers: '0', pnl_net: '0', avg_r: null,
      })) };
    };
    const result = await getBreakdown(userId, { by: 'weekday' });
    assert.match(sql, /ORDER BY EXTRACT\(ISODOW FROM t\.entry_datetime\)::int ASC/);
    assert.deepEqual(result.data.map(({ key, label }) => ({ key, label })), [
      { key: 'monday', label: 'Monday' }, { key: 'tuesday', label: 'Tuesday' },
      { key: 'wednesday', label: 'Wednesday' }, { key: 'thursday', label: 'Thursday' },
      { key: 'friday', label: 'Friday' }, { key: 'saturday', label: 'Saturday' },
      { key: 'sunday', label: 'Sunday' },
    ]);
  });
});

describe('R-multiple distribution', () => {
  test('assigns every exact boundary, negative, zero, and positive value once', () => {
    const values = [-3, -2, -1.999, -1.5, -1.499, -1, -0.999, -0.5, -0.499, -0.001, 0, 0.499, 0.5, 0.999, 1, 1.999, 2, 2.999, 3, 4];
    const buckets = bucketRValues(values);
    assert.deepEqual(buckets.map((bucket) => bucket.key), R_BUCKETS.map((bucket) => bucket.key));
    assert.deepEqual(buckets.map((bucket) => bucket.count), Array(10).fill(2));
    assert.equal(buckets.reduce((sum, bucket) => sum + bucket.count, 0), values.length);
    assert.equal(buckets.find((bucket) => bucket.key === '0_to_0_5').count, 2);
  });

  test('returns an empty ordered contract when no qualifying R values exist', () => {
    assert.deepEqual(bucketRValues([]), []);
  });

  test('queries closed non-null R values with ownership and scope filters', async () => {
    let captured;
    pool.query = async (sql, params) => {
      captured = { sql, params };
      return { rows: [{ r_multiple: null }, { r_multiple: '-2' }, { r_multiple: '0' }, { r_multiple: '3' }] };
    };
    const result = await getRDistribution(userId, {
      from: '2026-08-01', to: '2026-08-04', accountId, company: 'ignored',
    });
    assert.match(captured.sql, /t\.user_id = \$1/);
    assert.match(captured.sql, /t\.status = 'closed'/);
    assert.match(captured.sql, /t\.r_multiple IS NOT NULL/);
    assert.match(captured.sql, /t\.account_id = \$4/);
    assert.doesNotMatch(captured.sql, /ta\.company/);
    assert.deepEqual(captured.params, [userId, '2026-08-01', '2026-08-04T23:59:59.999Z', accountId]);
    assert.equal(result.totalTrades, 3);
    assert.deepEqual(result.buckets.map((bucket) => bucket.count), [1, 0, 0, 0, 0, 1, 0, 0, 0, 1]);
  });

  test('preserves company filtering and empty results', async () => {
    let captured;
    pool.query = async (sql, params) => { captured = { sql, params }; return { rows: [] }; };
    const result = await getRDistribution(userId, { company: 'Broker A' });
    assert.match(captured.sql, /JOIN trading_accounts ta/);
    assert.match(captured.sql, /ta\.company = \$2/);
    assert.deepEqual(captured.params, [userId, 'broker a']);
    assert.deepEqual(result, { totalTrades: 0, buckets: [] });
  });
});

describe('expectancy', () => {
  test('is average stored net PnL across winners and losers', () => {
    assert.equal(calculateExpectancy(60, 2), 30);
  });

  test('includes breakeven closed trades in the denominator', () => {
    assert.equal(calculateExpectancy(60, 3), 20);
  });

  test('returns zero for all breakevens and null with no closed trades', () => {
    assert.equal(calculateExpectancy(0, 3), 0);
    assert.equal(calculateExpectancy(0, 0), null);
  });

  test('uses stored net PnL so fees remain reflected', () => {
    const storedNetAfterFees = 90 - 55;
    assert.equal(calculateExpectancy(storedNetAfterFees, 2), 17.5);
  });

  test('preserves the summary field and returns null when no closed trades exist', async () => {
    pool.query = async (sql) => {
      if (/AS total/.test(sql)) {
        return { rows: [{
          total: '0', closed: '0', open: '0', winners: '0', losers: '0',
          pnl_net_sum: '0', pnl_gross_sum: '0', fees_sum: '0', avg_win: null,
          avg_loss: null, avg_r: null, avg_duration: null, gross_profit: '0', gross_loss: '0',
        }] };
      }
      return { rows: [{ cnt: '0', pnl: '0' }] };
    };
    const result = await getSummary(userId, {});
    assert.equal(result.totals.expectancy, null);
    assert.ok(Object.hasOwn(result.totals, 'expectancy'));
  });

  test('summary divides total stored net PnL by all closed trades including breakevens', async () => {
    pool.query = async (sql) => {
      if (/AS total/.test(sql)) {
        return { rows: [{
          total: '3', closed: '3', open: '0', winners: '1', losers: '1',
          pnl_net_sum: '60', pnl_gross_sum: '65', fees_sum: '5', avg_win: '100',
          avg_loss: '-40', avg_r: null, avg_duration: '30', gross_profit: '100', gross_loss: '40',
        }] };
      }
      return { rows: [{ cnt: '0', pnl: '0' }] };
    };
    const result = await getSummary(userId, {});
    assert.equal(result.totals.expectancy, 20);
  });
});

describe('dollar-PnL distribution', () => {
  test('returns the established empty response for no qualifying data', async () => {
    pool.query = async () => ({ rows: [] });
    assert.deepEqual(await getDistribution(userId, {}), { buckets: [] });
  });

  test('places one value and identical values in one exact bucket', () => {
    assert.deepEqual(bucketPnlValues([25]), [{ range: '+25', min: 25, max: 25, count: 1 }]);
    assert.deepEqual(bucketPnlValues([-12, -12, -12]), [{ range: '-12', min: -12, max: -12, count: 3 }]);
  });

  test('includes minimum and maximum values exactly once', () => {
    const values = [-100, 0, 100];
    const buckets = bucketPnlValues(values);
    assert.equal(buckets.reduce((sum, bucket) => sum + bucket.count, 0), values.length);
    assert.equal(buckets.filter((bucket) => -100 >= bucket.min && -100 < bucket.max).length, 1);
    assert.equal(buckets.filter((bucket) => 100 >= bucket.min && 100 < bucket.max).length, 1);
  });

  test('handles negative-only, positive-only, and mixed values with stable counts', () => {
    for (const values of [[-300, -200, -100], [10, 20, 30], [-10, 0, 10]]) {
      const buckets = bucketPnlValues(values);
      assert.equal(buckets.reduce((sum, bucket) => sum + bucket.count, 0), values.length);
      assert.deepEqual([...buckets].sort((a, b) => a.min - b.min), buckets);
    }
  });

  test('preserves response shape, filters, and user ownership', async () => {
    let captured;
    pool.query = async (sql, params) => {
      captured = { sql, params };
      return { rows: [{ pnl_net: '-50' }, { pnl_net: '50' }] };
    };
    const result = await getDistribution(userId, { from: '2026-08-01', accountId });
    assert.match(captured.sql, /t\.user_id = \$1/);
    assert.match(captured.sql, /t\.status = 'closed'/);
    assert.match(captured.sql, /t\.pnl_net IS NOT NULL/);
    assert.deepEqual(captured.params, [userId, '2026-08-01', accountId]);
    assert.ok(Array.isArray(result.buckets));
    assert.deepEqual(Object.keys(result.buckets[0]), ['range', 'min', 'max', 'count']);
    assert.equal(result.buckets.reduce((sum, bucket) => sum + bucket.count, 0), 2);
  });
});
