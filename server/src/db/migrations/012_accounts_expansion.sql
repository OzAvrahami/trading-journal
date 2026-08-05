-- Migration 012: richer trading-account metadata and one active default per user.
-- Performance and tracked balances remain derived from Trades and are not persisted.

BEGIN;

ALTER TABLE trading_accounts
  ADD COLUMN IF NOT EXISTS base_currency VARCHAR(3) NOT NULL DEFAULT 'USD',
  ADD COLUMN IF NOT EXISTS opening_balance NUMERIC(18,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS is_default BOOLEAN NOT NULL DEFAULT FALSE;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'trading_accounts_base_currency_format'
      AND conrelid = 'trading_accounts'::regclass
  ) THEN
    ALTER TABLE trading_accounts
      ADD CONSTRAINT trading_accounts_base_currency_format
      CHECK (base_currency ~ '^[A-Z]{3}$');
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'trading_accounts_default_requires_active'
      AND conrelid = 'trading_accounts'::regclass
  ) THEN
    ALTER TABLE trading_accounts
      ADD CONSTRAINT trading_accounts_default_requires_active
      CHECK (NOT is_default OR status = 'active');
  END IF;
END;
$$;

CREATE UNIQUE INDEX IF NOT EXISTS trading_accounts_one_default_per_user
  ON trading_accounts (user_id)
  WHERE is_default = TRUE;

CREATE INDEX IF NOT EXISTS trading_accounts_user_status_default_idx
  ON trading_accounts (user_id, status, is_default DESC, company, account_number);

COMMIT;
