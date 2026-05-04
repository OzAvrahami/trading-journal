-- Migration 004: scope dedup uniqueness to account level instead of user level.
-- Allows the same trade to exist across different accounts of the same user.

DROP INDEX IF EXISTS trades_dedup_key_unique;

CREATE UNIQUE INDEX IF NOT EXISTS trades_dedup_key_unique
  ON trades (account_id, dedup_key)
  WHERE dedup_key IS NOT NULL AND account_id IS NOT NULL;
