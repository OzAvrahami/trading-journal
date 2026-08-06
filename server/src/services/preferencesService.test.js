import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { afterEach, describe, test } from 'node:test';
import pool from '../db/client.js';
import { updatePreferencesSchema } from '../routes/preferences.js';
import { getPreferences, mapPreferences, updatePreferences } from './preferencesService.js';

const migration = readFileSync(new URL('../db/migrations/014_user_preferences.sql', import.meta.url), 'utf8');
const seedSource = readFileSync(new URL('../db/seedDemo.js', import.meta.url), 'utf8');
const userId = '11111111-1111-4111-8111-111111111111';
const originalConnect = pool.connect;

afterEach(() => { pool.connect = originalConnect; });

describe('user preferences migration contract', () => {
  test('creates one optional constrained row per user with updated-at behavior', () => {
    assert.match(migration, /CREATE TABLE IF NOT EXISTS user_preferences/);
    assert.match(migration, /user_id UUID PRIMARY KEY REFERENCES users\(id\) ON DELETE CASCADE/);
    assert.match(migration, /locale TEXT NULL/);
    assert.match(migration, /theme TEXT NULL/);
    assert.match(migration, /trade_form_mode TEXT NULL/);
    assert.match(migration, /locale IS NULL OR locale IN \('en', 'he'\)/);
    assert.match(migration, /theme IS NULL OR theme IN \('system', 'light', 'dark'\)/);
    assert.match(migration, /trade_form_mode IS NULL OR trade_form_mode IN \('simple', 'advanced'\)/);
    assert.match(migration, /update_updated_at_column\(\)/);
  });

  test('is transactional, has no backfill, and does not alter canonical domains', () => {
    assert.match(migration, /^BEGIN;/);
    assert.match(migration, /COMMIT;\s*$/);
    assert.doesNotMatch(migration, /INSERT INTO user_preferences|UPDATE users|ALTER TABLE users|trading_accounts|DELETE FROM|TRUNCATE|DROP TABLE|ROW LEVEL SECURITY/i);
  });
});

describe('preferences validation and composite response', () => {
  test('accepts supported keys and rejects invalid, unknown, empty, null, or user-owned fields', () => {
    assert.equal(updatePreferencesSchema.safeParse({ locale: 'he', theme: 'system', tradeFormMode: 'simple', timezone: 'Asia/Jerusalem' }).success, true);
    for (const payload of [
      {}, { locale: 'fr' }, { locale: null }, { theme: 'sepia' }, { tradeFormMode: 'compact' },
      { timezone: 'Not/A_Zone' }, { userId }, { defaultAccountId: 'account' },
    ]) assert.equal(updatePreferencesSchema.safeParse(payload).success, false);
  });

  test('maps nullable preferences, canonical timezone, and the existing default Account', () => {
    assert.deepEqual(mapPreferences({ locale: null, theme: null, trade_form_mode: null, timezone: 'Asia/Jerusalem', default_account_id: null }), {
      locale: null, theme: null, tradeFormMode: null, timezone: 'Asia/Jerusalem', defaultAccount: null,
    });
    const mapped = mapPreferences({ locale: 'he', theme: 'dark', trade_form_mode: 'advanced', timezone: 'Europe/London', default_account_id: 'account', default_account_name: 'Main', default_account_company: 'Broker', default_account_number: 'A-1', default_account_status: 'active', default_account_currency: 'USD' });
    assert.equal(mapped.defaultAccount.id, 'account');
    assert.equal(mapped.defaultAccount.accountNumber, 'A-1');
    assert.equal(mapped.timezone, 'Europe/London');
  });

  test('GET remains user-scoped and reads default state without duplicating it', async () => {
    const calls = [];
    const result = await getPreferences(userId, { query: async (sql, params) => {
      calls.push({ sql, params });
      return { rows: [{ locale: null, theme: null, trade_form_mode: null, timezone: 'Asia/Jerusalem', default_account_id: null }] };
    } });
    assert.equal(result.locale, null);
    assert.deepEqual(calls[0].params, [userId]);
    assert.match(calls[0].sql, /p\.user_id = u\.id/);
    assert.match(calls[0].sql, /a\.user_id = u\.id AND a\.is_default = TRUE/);
  });
});

describe('atomic preference and timezone updates', () => {
  function harness({ failUpsert = false } = {}) {
    const calls = [];
    const client = {
      async query(sql, params = []) {
        calls.push({ sql, params });
        if (failUpsert && /INSERT INTO user_preferences/.test(sql)) throw new Error('preference write failed');
        if (/UPDATE users/.test(sql) || /SELECT id FROM users/.test(sql)) return { rows: [{ id: userId }] };
        if (/SELECT u\.timezone/.test(sql)) return { rows: [{ locale: 'he', theme: 'dark', trade_form_mode: 'simple', timezone: 'America/New_York', default_account_id: null }] };
        return { rows: [] };
      },
      release() { calls.push({ sql: 'RELEASE', params: [] }); },
    };
    pool.connect = async () => client;
    return calls;
  }

  test('upserts preferences and canonical timezone in one transaction', async () => {
    const calls = harness();
    const result = await updatePreferences(userId, { locale: 'he', theme: 'dark', tradeFormMode: 'simple', timezone: 'America/New_York' });
    assert.equal(result.timezone, 'America/New_York');
    assert.deepEqual(calls.filter(call => /^(BEGIN|COMMIT)$/.test(call.sql)).map(call => call.sql), ['BEGIN', 'COMMIT']);
    assert.ok(calls.some(call => /UPDATE users SET timezone/.test(call.sql) && call.params[0] === userId));
    assert.ok(calls.some(call => /INSERT INTO user_preferences/.test(call.sql) && call.params[0] === userId));
    assert.equal(calls.some(call => /trading_accounts SET is_default|UPDATE trades/.test(call.sql)), false);
  });

  test('rolls back timezone and preferences together when either write fails', async () => {
    const calls = harness({ failUpsert: true });
    await assert.rejects(() => updatePreferences(userId, { locale: 'he', timezone: 'UTC' }), /preference write failed/);
    assert.ok(calls.some(call => call.sql === 'ROLLBACK'));
    assert.equal(calls.some(call => call.sql === 'COMMIT'), false);
  });
});

describe('demo seed preference preservation', () => {
  test('never backs up, inserts, resets, or deletes user_preferences', () => {
    assert.doesNotMatch(seedSource, /(?:DELETE FROM|INSERT INTO|SELECT \* FROM)\s+user_preferences/i);
    assert.doesNotMatch(seedSource, /DEMO_LOCALE[\s\S]{0,200}(?:locale preference|user_preferences)/i);
  });
});
