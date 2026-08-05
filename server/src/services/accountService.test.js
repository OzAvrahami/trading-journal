import assert from 'node:assert/strict';
import { afterEach, describe, test } from 'node:test';
import pool from '../db/client.js';
import { deleteAccount } from './accountService.js';

const originalQuery = pool.query;
const userId = '11111111-1111-4111-8111-111111111111';
const accountId = '22222222-2222-4222-8222-222222222222';

afterEach(() => { pool.query = originalQuery; });

function ownedAccountRow() {
  return {
    id: accountId,
    user_id: userId,
    company: 'broker',
    account_number: 'A-1',
    account_name: null,
    account_type: null,
    status: 'active',
    created_at: '2026-08-01T00:00:00Z',
    updated_at: '2026-08-01T00:00:00Z',
  };
}

describe('account deletion ownership ordering', () => {
  test('foreign and nonexistent accounts do not expose linked trade counts', async () => {
    for (const scenario of ['foreign', 'missing']) {
      const calls = [];
      pool.query = async (sql, params) => {
        calls.push({ sql, params });
        return { rows: [] };
      };

      await assert.rejects(
        () => deleteAccount(userId, accountId),
        error => error.code === 'ACCOUNT_NOT_FOUND' && error.statusCode === 404
      );
      assert.equal(calls.length, 1, scenario);
      assert.match(calls[0].sql, /WHERE id = \$1 AND user_id = \$2/);
      assert.deepEqual(calls[0].params, [accountId, userId]);
      assert.doesNotMatch(calls[0].sql, /COUNT/);
    }
  });

  test('owned account with trades preserves the existing conflict', async () => {
    const calls = [];
    pool.query = async (sql, params) => {
      calls.push({ sql, params });
      if (/FROM trading_accounts/.test(sql)) return { rows: [ownedAccountRow()] };
      if (/COUNT/.test(sql)) return { rows: [{ cnt: 2 }] };
      throw new Error('Unexpected query');
    };

    await assert.rejects(
      () => deleteAccount(userId, accountId),
      error => error.code === 'ACCOUNT_HAS_TRADES' && error.statusCode === 409
    );
    assert.equal(calls.length, 2);
    assert.doesNotMatch(calls.map(call => call.sql).join('\n'), /DELETE FROM/);
  });

  test('owned empty account deletes successfully', async () => {
    const calls = [];
    pool.query = async (sql, params) => {
      calls.push({ sql, params });
      if (/SELECT \* FROM trading_accounts/.test(sql)) return { rows: [ownedAccountRow()] };
      if (/COUNT/.test(sql)) return { rows: [{ cnt: 0 }] };
      if (/DELETE FROM trading_accounts/.test(sql)) return { rows: [{ id: accountId }] };
      throw new Error('Unexpected query');
    };

    assert.deepEqual(await deleteAccount(userId, accountId), { deleted: true, id: accountId });
    assert.equal(calls.length, 3);
    assert.match(calls[2].sql, /WHERE id = \$1 AND user_id = \$2/);
  });
});
