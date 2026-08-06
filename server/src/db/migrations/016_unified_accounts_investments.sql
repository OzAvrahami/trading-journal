-- Migration 016: align the visible Account model with the existing investment ledger.
-- Existing Portfolios remain valid when unlinked; no Account, Trade, or investment row is rewritten.

BEGIN;

ALTER TABLE trading_accounts
  ADD COLUMN IF NOT EXISTS account_group TEXT NOT NULL DEFAULT 'active_trading',
  ADD COLUMN IF NOT EXISTS include_in_investment_value BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS include_in_net_worth BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS include_in_trading_analytics BOOLEAN NOT NULL DEFAULT TRUE;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'trading_accounts_group_valid'
      AND conrelid = 'trading_accounts'::regclass
  ) THEN
    ALTER TABLE trading_accounts
      ADD CONSTRAINT trading_accounts_group_valid
      CHECK (account_group IN ('personal_investment', 'active_trading', 'prop_firm'));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'trading_accounts_prop_firm_scope_valid'
      AND conrelid = 'trading_accounts'::regclass
  ) THEN
    ALTER TABLE trading_accounts
      ADD CONSTRAINT trading_accounts_prop_firm_scope_valid
      CHECK (account_group <> 'prop_firm'
        OR (include_in_investment_value = FALSE AND include_in_net_worth = FALSE));
  END IF;
END;
$$;

CREATE INDEX IF NOT EXISTS trading_accounts_user_group_status_idx
  ON trading_accounts (user_id, account_group, status, account_name, id);
CREATE INDEX IF NOT EXISTS trading_accounts_user_investment_scope_idx
  ON trading_accounts (user_id, include_in_investment_value, status)
  WHERE include_in_investment_value = TRUE;
CREATE INDEX IF NOT EXISTS trading_accounts_user_trading_scope_idx
  ON trading_accounts (user_id, include_in_trading_analytics, status)
  WHERE include_in_trading_analytics = TRUE;

ALTER TABLE investment_portfolios
  ADD COLUMN IF NOT EXISTS trading_account_id UUID NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'investment_portfolios_trading_account_fk'
      AND conrelid = 'investment_portfolios'::regclass
  ) THEN
    ALTER TABLE investment_portfolios
      ADD CONSTRAINT investment_portfolios_trading_account_fk
      FOREIGN KEY (trading_account_id) REFERENCES trading_accounts(id) ON DELETE RESTRICT;
  END IF;
END;
$$;

CREATE UNIQUE INDEX IF NOT EXISTS investment_portfolios_one_per_trading_account
  ON investment_portfolios (trading_account_id)
  WHERE trading_account_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS investment_portfolios_user_trading_account_idx
  ON investment_portfolios (user_id, trading_account_id, status);

CREATE OR REPLACE FUNCTION validate_investment_portfolio_account_context()
RETURNS TRIGGER AS $$
DECLARE
  account_owner UUID;
  account_currency TEXT;
BEGIN
  IF NEW.trading_account_id IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT a.user_id, a.base_currency
    INTO account_owner, account_currency
  FROM trading_accounts a
  WHERE a.id = NEW.trading_account_id;

  IF NOT FOUND OR account_owner <> NEW.user_id THEN
    RAISE EXCEPTION USING ERRCODE = '23514',
      CONSTRAINT = 'investment_portfolios_trading_account_owner',
      MESSAGE = 'Investment Portfolio and Trading Account ownership must match.';
  END IF;
  IF account_currency <> NEW.base_currency THEN
    RAISE EXCEPTION USING ERRCODE = '23514',
      CONSTRAINT = 'investment_portfolios_trading_account_currency_match',
      MESSAGE = 'Investment Portfolio currency must match Trading Account base currency.';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION validate_trading_account_portfolio_context()
RETURNS TRIGGER AS $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM investment_portfolios p
    WHERE p.trading_account_id = NEW.id
      AND (p.user_id <> NEW.user_id OR p.base_currency <> NEW.base_currency)
  ) THEN
    RAISE EXCEPTION USING ERRCODE = '23514',
      CONSTRAINT = 'trading_accounts_linked_portfolio_context',
      MESSAGE = 'Trading Account ownership and currency must match its linked Investment Portfolio.';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION validate_investment_transaction_context()
RETURNS TRIGGER AS $$
DECLARE
  portfolio_currency TEXT;
  linked_account_status TEXT;
  instrument_currency TEXT;
BEGIN
  SELECT p.base_currency, a.status
    INTO portfolio_currency, linked_account_status
  FROM investment_portfolios p
  LEFT JOIN trading_accounts a
    ON a.id = p.trading_account_id AND a.user_id = p.user_id
  WHERE p.id = NEW.portfolio_id AND p.user_id = NEW.user_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION USING ERRCODE = '23514', CONSTRAINT = 'investment_transactions_portfolio_owner',
      MESSAGE = 'Investment Transaction and Portfolio ownership must match.';
  END IF;
  IF linked_account_status IS NOT NULL AND linked_account_status <> 'active' THEN
    RAISE EXCEPTION USING ERRCODE = '23514', CONSTRAINT = 'investment_transactions_linked_account_active',
      MESSAGE = 'An inactive or archived linked Account cannot receive new Investment Transactions.';
  END IF;
  IF NEW.currency <> portfolio_currency THEN
    RAISE EXCEPTION USING ERRCODE = '23514', CONSTRAINT = 'investment_transactions_portfolio_currency_match',
      MESSAGE = 'Investment Transaction currency must match Portfolio base currency.';
  END IF;
  IF NEW.instrument_id IS NOT NULL THEN
    SELECT i.currency INTO instrument_currency
    FROM investment_instruments i
    WHERE i.id = NEW.instrument_id AND i.user_id = NEW.user_id;
    IF NOT FOUND THEN
      RAISE EXCEPTION USING ERRCODE = '23514', CONSTRAINT = 'investment_transactions_instrument_owner',
        MESSAGE = 'Investment Transaction and Instrument ownership must match.';
    END IF;
    IF instrument_currency <> portfolio_currency THEN
      RAISE EXCEPTION USING ERRCODE = '23514', CONSTRAINT = 'investment_transactions_instrument_currency_match',
        MESSAGE = 'Instrument currency must match Portfolio base currency.';
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS investment_portfolios_validate_trading_account ON investment_portfolios;
CREATE TRIGGER investment_portfolios_validate_trading_account
  BEFORE INSERT OR UPDATE OF user_id, trading_account_id, base_currency ON investment_portfolios
  FOR EACH ROW EXECUTE FUNCTION validate_investment_portfolio_account_context();

DROP TRIGGER IF EXISTS trading_accounts_validate_linked_portfolio ON trading_accounts;
CREATE TRIGGER trading_accounts_validate_linked_portfolio
  BEFORE UPDATE OF user_id, base_currency ON trading_accounts
  FOR EACH ROW EXECUTE FUNCTION validate_trading_account_portfolio_context();

COMMIT;
