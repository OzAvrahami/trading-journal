import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { describe, test } from 'node:test';

const sql = readFileSync(new URL('../db/migrations/008_trading_integrity_gate.sql', import.meta.url), 'utf8');

describe('trading integrity migration contract', () => {
  test('is transactional and idempotently installs the ownership trigger', () => {
    assert.match(sql, /^\s*--[\s\S]*\bBEGIN;/i);
    assert.match(sql, /COMMIT;\s*$/i);
    assert.match(sql, /CREATE OR REPLACE FUNCTION validate_trade_account_ownership\(\)/i);
    assert.match(sql, /WHERE id = NEW\.account_id\s+AND user_id = NEW\.user_id/i);
    assert.match(sql, /BEFORE INSERT OR UPDATE OF user_id, account_id ON trades/i);
    assert.match(sql, /pg_trigger[\s\S]*tgname = 'trades_validate_account_ownership'/i);
    assert.match(sql, /ERRCODE = '23514'/i);
  });

  test('adds named NOT VALID exit consistency constraints', () => {
    assert.match(sql, /ADD CONSTRAINT trades_exit_fields_consistent[\s\S]*CHECK[\s\S]*exit_datetime IS NULL AND exit_price IS NULL[\s\S]*exit_datetime IS NOT NULL AND exit_price IS NOT NULL[\s\S]*NOT VALID/i);
    assert.match(sql, /ADD CONSTRAINT trades_exit_datetime_not_before_entry[\s\S]*CHECK \(exit_datetime IS NULL OR exit_datetime >= entry_datetime\)[\s\S]*NOT VALID/i);
    assert.match(sql, /pg_constraint[\s\S]*conname = 'trades_exit_fields_consistent'/i);
    assert.match(sql, /pg_constraint[\s\S]*conname = 'trades_exit_datetime_not_before_entry'/i);
    assert.match(sql, /ALTER TABLE trades VALIDATE CONSTRAINT trades_exit_fields_consistent/i);
  });

  test('contains no data rewrite or destructive statement', () => {
    const executableSql = sql
      .split('\n')
      .filter(line => !line.trim().startsWith('--'))
      .join('\n');
    assert.doesNotMatch(executableSql, /\b(?:DELETE\s+FROM|TRUNCATE|DROP\s+TABLE|UPDATE\s+trades|INSERT\s+INTO\s+trades)\b/i);
  });
});
