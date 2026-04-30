-- Migration 002: add dedup_key column for CSV import duplicate detection
-- Run once against your Supabase SQL editor or via the migrate script.

ALTER TABLE trades
  ADD COLUMN IF NOT EXISTS dedup_key TEXT;

-- Optional unique constraint (only on non-null values) to enforce at DB level
-- using a partial unique index so manually-entered trades (null dedup_key) are unaffected.
CREATE UNIQUE INDEX IF NOT EXISTS trades_dedup_key_unique
  ON trades (user_id, dedup_key)
  WHERE dedup_key IS NOT NULL;
