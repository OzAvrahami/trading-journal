import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { formatProfile, updateProfileSchema } from './me.js';
import { formatUser } from '../services/authService.js';

const row = {
  id: '11111111-1111-4111-8111-111111111111',
  email: 'trader@example.com',
  display_name: 'Trader',
  default_market: 'futures',
  default_timeframe: '5m',
  created_at: '2026-08-01T00:00:00.000Z',
};

describe('user timezone profile contract', () => {
  test('GET /api/me formatting exposes the stored timezone and existing fields', () => {
    assert.deepEqual(formatProfile({ ...row, timezone: 'America/New_York' }, { includeCreatedAt: true }), {
      id: row.id,
      email: row.email,
      displayName: row.display_name,
      timezone: 'America/New_York',
      defaults: { market: 'futures', timeframe: '5m' },
      createdAt: row.created_at,
    });
  });

  test('PATCH accepts and trims valid timezone values without changing other fields', () => {
    const result = updateProfileSchema.safeParse({ timezone: '  Europe/London  ' });
    assert.equal(result.success, true);
    assert.deepEqual(result.data, { timezone: 'Europe/London' });
  });

  test('PATCH rejects blank, invalid, and overlong timezone values', () => {
    for (const timezone of ['', 'Not/A_Real_Zone', 'A'.repeat(65)]) {
      assert.equal(updateProfileSchema.safeParse({ timezone }).success, false);
    }
  });

  test('legacy user rows fall back compatibly in profile and auth user objects', () => {
    assert.equal(formatProfile(row).timezone, 'Asia/Jerusalem');
    const authUser = formatUser(row);
    assert.equal(authUser.timezone, 'Asia/Jerusalem');
    assert.equal(authUser.email, row.email);
    assert.equal(authUser.defaultMarket, 'futures');
  });
});
