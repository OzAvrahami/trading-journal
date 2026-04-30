-- Migration 003: multi-account support
-- Creates trading_accounts, links trades to accounts, backfills a default account per user.

BEGIN;

-- ============================================================
-- TRADING ACCOUNTS
-- ============================================================
CREATE TABLE IF NOT EXISTS trading_accounts (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id        UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  company        VARCHAR(100) NOT NULL,
  account_number VARCHAR(100) NOT NULL,
  account_name   VARCHAR(200),
  account_type   VARCHAR(50),
  status         VARCHAR(20) NOT NULL DEFAULT 'active'
                   CHECK (status IN ('active', 'inactive', 'archived')),
  created_at     TIMESTAMPTZ DEFAULT NOW(),
  updated_at     TIMESTAMPTZ DEFAULT NOW(),

  CONSTRAINT uq_account_per_user UNIQUE (user_id, company, account_number)
);

CREATE INDEX IF NOT EXISTS idx_accounts_user_id      ON trading_accounts(user_id);
CREATE INDEX IF NOT EXISTS idx_accounts_user_company  ON trading_accounts(user_id, company);

DROP TRIGGER IF EXISTS accounts_updated_at ON trading_accounts;
CREATE TRIGGER accounts_updated_at
  BEFORE UPDATE ON trading_accounts
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================
-- Add account_id to trades (nullable while we backfill)
-- ============================================================
ALTER TABLE trades
  ADD COLUMN IF NOT EXISTS account_id UUID REFERENCES trading_accounts(id) ON DELETE RESTRICT;

-- ============================================================
-- Create one default account for EVERY user
-- ============================================================
INSERT INTO trading_accounts (user_id, company, account_number, account_name)
SELECT id, 'default', 'default', 'Default Account'
FROM users
ON CONFLICT (user_id, company, account_number) DO NOTHING;

-- ============================================================
-- Backfill: assign all existing trades to their user's default account
-- ============================================================
UPDATE trades t
SET account_id = (
  SELECT a.id
  FROM trading_accounts a
  WHERE a.user_id        = t.user_id
    AND a.company        = 'default'
    AND a.account_number = 'default'
);

-- ============================================================
-- Enforce NOT NULL now that every trade has an account
-- ============================================================
ALTER TABLE trades ALTER COLUMN account_id SET NOT NULL;

-- ============================================================
-- Index for fast per-account trade lookups
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_trades_account_id ON trades(account_id);

COMMIT;
