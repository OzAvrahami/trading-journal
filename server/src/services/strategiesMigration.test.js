import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { describe, test } from 'node:test';

const sql = readFileSync(new URL('../db/migrations/011_strategies_setups.sql', import.meta.url), 'utf8');

describe('Strategies and Setups migration contract', () => {
  test('creates managed tables and retains historical text columns', () => {
    assert.match(sql, /CREATE TABLE IF NOT EXISTS strategies/);
    assert.match(sql, /CREATE TABLE IF NOT EXISTS setups/);
    assert.match(sql, /ADD COLUMN IF NOT EXISTS strategy_id UUID/);
    assert.match(sql, /ADD COLUMN IF NOT EXISTS setup_id UUID/);
    assert.doesNotMatch(sql, /DROP COLUMN\s+(?:strategy|setup)/i);
  });
  test('enforces case-insensitive owned uniqueness and shared timestamps', () => {
    assert.match(sql, /strategies_user_name_unique[\s\S]*user_id, lower\(btrim\(name\)\)/);
    assert.match(sql, /setups_user_strategy_name_unique[\s\S]*user_id, strategy_id, lower\(btrim\(name\)\)/);
    assert.match(sql, /strategies_updated_at[\s\S]*update_updated_at_column/);
    assert.match(sql, /setups_updated_at[\s\S]*update_updated_at_column/);
  });
  test('enforces parent and Trade ownership relationships', () => {
    assert.match(sql, /validate_setup_strategy_owner/);
    assert.match(sql, /WHERE s\.id = NEW\.strategy_id AND s\.user_id = NEW\.user_id/);
    assert.match(sql, /trades_setup_requires_strategy/);
    assert.match(sql, /trades_strategy_owner_match/);
    assert.match(sql, /trades_setup_owner_match/);
    assert.match(sql, /trades_setup_strategy_match/);
  });
  test('uses requested delete behavior and performance indexes', () => {
    assert.match(sql, /strategy_id UUID NOT NULL REFERENCES strategies\(id\) ON DELETE CASCADE/);
    assert.match(sql, /REFERENCES strategies\(id\) ON DELETE SET NULL/);
    assert.match(sql, /REFERENCES setups\(id\) ON DELETE SET NULL/);
    assert.match(sql, /trades_user_strategy_id_idx ON trades \(user_id, strategy_id\)/);
    assert.match(sql, /trades_user_setup_id_idx ON trades \(user_id, setup_id\)/);
  });
  test('is transactional, idempotent, and contains no backfill or destructive data statement', () => {
    assert.match(sql, /^--[\s\S]*\bBEGIN;/);
    assert.match(sql, /COMMIT;\s*$/);
    assert.doesNotMatch(sql, /\b(?:INSERT INTO|UPDATE|DELETE FROM|TRUNCATE)\s+trades\b/i);
    assert.doesNotMatch(sql, /strategy\s*=|setup\s*=/i);
  });
});
