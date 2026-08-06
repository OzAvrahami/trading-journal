import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { refresh, signup } from './authService.js';

function fakePool(handler) {
  const calls = [];
  let released = false;
  const client = {
    async query(sql, params = []) {
      calls.push({ sql, params });
      return handler(sql, params, calls);
    },
    release() { released = true; },
  };
  return { pool: { connect: async () => client }, calls, wasReleased: () => released };
}

describe('authentication write transactions', () => {
  test('refresh-token rotation locks, deletes, and replaces the token atomically', async () => {
    process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-only-secret';
    const fixture = fakePool(async (sql) => {
      if (/SELECT rt\.id/.test(sql)) return { rows: [{ token_id: 'token-1', user_id: 'user-1', email: 'trader@example.com' }] };
      return { rows: [] };
    });

    const result = await refresh('old-refresh-token', fixture.pool);
    const statements = fixture.calls.map(({ sql }) => sql.trim());

    assert.ok(result.accessToken);
    assert.ok(result.refreshToken);
    assert.equal(statements[0], 'BEGIN');
    assert.match(statements[1], /FOR UPDATE OF rt/);
    assert.match(statements[2], /DELETE FROM refresh_tokens WHERE id = \$1 AND user_id = \$2/);
    assert.match(statements[3], /INSERT INTO refresh_tokens/);
    assert.equal(statements[4], 'COMMIT');
    assert.equal(fixture.wasReleased(), true);
  });

  test('failed refresh-token replacement rolls back the old-token deletion', async () => {
    process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-only-secret';
    const fixture = fakePool(async (sql) => {
      if (/SELECT rt\.id/.test(sql)) return { rows: [{ token_id: 'token-1', user_id: 'user-1', email: 'trader@example.com' }] };
      if (/INSERT INTO refresh_tokens/.test(sql)) throw new Error('transient insert failure');
      return { rows: [] };
    });

    await assert.rejects(() => refresh('old-refresh-token', fixture.pool), /transient insert failure/);
    assert.equal(fixture.calls.at(-1).sql, 'ROLLBACK');
    assert.equal(fixture.calls.some(({ sql }) => sql === 'COMMIT'), false);
    assert.equal(fixture.wasReleased(), true);
  });

  test('signup creates the user and refresh token in one transaction', async () => {
    process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-only-secret';
    const fixture = fakePool(async (sql) => {
      if (/SELECT id FROM users/.test(sql)) return { rows: [] };
      if (/INSERT INTO users/.test(sql)) return { rows: [{
        id: 'user-1', email: 'new@example.com', display_name: 'New trader',
        default_market: 'futures', default_timeframe: '5m', timezone: 'UTC', created_at: '2026-08-06T00:00:00Z',
      }] };
      return { rows: [] };
    });

    const result = await signup({ email: 'NEW@example.com', password: 'password-123', displayName: 'New trader' }, fixture.pool);
    assert.equal(result.user.email, 'new@example.com');
    assert.deepEqual(fixture.calls.map(({ sql }) => sql.trim()).filter((sql) => /^(BEGIN|COMMIT|ROLLBACK)$/.test(sql)), ['BEGIN', 'COMMIT']);
    assert.equal(fixture.calls.some(({ sql }) => /INSERT INTO refresh_tokens/.test(sql)), true);
  });

  test('signup maps only the email uniqueness race to EMAIL_IN_USE', async () => {
    const duplicate = Object.assign(new Error('unique violation'), { code: '23505', constraint: 'users_email_key' });
    const fixture = fakePool(async (sql) => {
      if (/SELECT id FROM users/.test(sql)) return { rows: [] };
      if (/INSERT INTO users/.test(sql)) throw duplicate;
      return { rows: [] };
    });
    await assert.rejects(
      () => signup({ email: 'duplicate@example.com', password: 'password-123' }, fixture.pool),
      (error) => error.code === 'EMAIL_IN_USE' && error.statusCode === 409,
    );

    const unrelated = Object.assign(new Error('different unique violation'), { code: '23505', constraint: 'users_pkey' });
    const otherFixture = fakePool(async (sql) => {
      if (/SELECT id FROM users/.test(sql)) return { rows: [] };
      if (/INSERT INTO users/.test(sql)) throw unrelated;
      return { rows: [] };
    });
    await assert.rejects(
      () => signup({ email: 'other@example.com', password: 'password-123' }, otherFixture.pool),
      (error) => error === unrelated,
    );
  });
});
