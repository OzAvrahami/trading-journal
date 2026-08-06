-- Migration 015: separate user-owned long-term investment portfolio foundation.
-- Holdings and performance remain derived by chronological replay; no day Trades are changed.

BEGIN;

CREATE TABLE IF NOT EXISTS investment_portfolios (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT NULL,
  base_currency VARCHAR(3) NOT NULL DEFAULT 'USD',
  status TEXT NOT NULL DEFAULT 'active',
  is_default BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT investment_portfolios_name_valid
    CHECK (char_length(btrim(name)) BETWEEN 1 AND 120),
  CONSTRAINT investment_portfolios_description_valid
    CHECK (description IS NULL OR (btrim(description) <> '' AND char_length(description) <= 2000)),
  CONSTRAINT investment_portfolios_currency_valid
    CHECK (base_currency ~ '^[A-Z]{3}$'),
  CONSTRAINT investment_portfolios_status_valid
    CHECK (status IN ('active', 'archived')),
  CONSTRAINT investment_portfolios_default_requires_active
    CHECK (NOT is_default OR status = 'active')
);

CREATE UNIQUE INDEX IF NOT EXISTS investment_portfolios_user_name_unique
  ON investment_portfolios (user_id, lower(btrim(name)));
CREATE UNIQUE INDEX IF NOT EXISTS investment_portfolios_one_default_per_user
  ON investment_portfolios (user_id) WHERE is_default = TRUE;
CREATE INDEX IF NOT EXISTS investment_portfolios_user_status_idx
  ON investment_portfolios (user_id, status, is_default DESC, lower(btrim(name)));

CREATE TABLE IF NOT EXISTS investment_instruments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  symbol TEXT NOT NULL,
  name TEXT NULL,
  exchange TEXT NULL,
  asset_type TEXT NOT NULL,
  currency VARCHAR(3) NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT investment_instruments_symbol_valid
    CHECK (symbol = btrim(symbol) AND symbol = upper(symbol) AND symbol ~ '^[A-Z0-9.-]{1,24}$'),
  CONSTRAINT investment_instruments_name_valid
    CHECK (name IS NULL OR (btrim(name) <> '' AND char_length(name) <= 200)),
  CONSTRAINT investment_instruments_exchange_valid
    CHECK (exchange IS NULL OR (btrim(exchange) <> '' AND char_length(exchange) <= 40)),
  CONSTRAINT investment_instruments_asset_type_valid
    CHECK (asset_type IN ('stock', 'etf')),
  CONSTRAINT investment_instruments_currency_valid
    CHECK (currency ~ '^[A-Z]{3}$')
);

CREATE UNIQUE INDEX IF NOT EXISTS investment_instruments_user_identity_unique
  ON investment_instruments (user_id, symbol, lower(COALESCE(btrim(exchange), '')), asset_type);
CREATE INDEX IF NOT EXISTS investment_instruments_user_active_symbol_idx
  ON investment_instruments (user_id, is_active, symbol);

CREATE TABLE IF NOT EXISTS investment_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  portfolio_id UUID NOT NULL REFERENCES investment_portfolios(id) ON DELETE CASCADE,
  instrument_id UUID NULL REFERENCES investment_instruments(id) ON DELETE RESTRICT,
  transaction_type TEXT NOT NULL,
  transaction_date DATE NOT NULL,
  quantity NUMERIC(24,8) NULL,
  price NUMERIC(24,8) NULL,
  amount NUMERIC(18,2) NULL,
  fees NUMERIC(18,2) NOT NULL DEFAULT 0,
  currency VARCHAR(3) NOT NULL,
  notes TEXT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT investment_transactions_type_valid
    CHECK (transaction_type IN ('buy', 'sell', 'dividend', 'fee', 'deposit', 'withdrawal')),
  CONSTRAINT investment_transactions_currency_valid
    CHECK (currency ~ '^[A-Z]{3}$'),
  CONSTRAINT investment_transactions_fees_nonnegative
    CHECK (fees >= 0),
  CONSTRAINT investment_transactions_notes_valid
    CHECK (notes IS NULL OR (btrim(notes) <> '' AND char_length(notes) <= 2000)),
  CONSTRAINT investment_transactions_shape_valid CHECK (
    (transaction_type IN ('buy', 'sell')
      AND instrument_id IS NOT NULL AND quantity > 0 AND price > 0
      AND amount IS NULL AND fees >= 0)
    OR
    (transaction_type = 'dividend'
      AND instrument_id IS NOT NULL AND amount > 0
      AND quantity IS NULL AND price IS NULL AND fees >= 0)
    OR
    (transaction_type = 'fee'
      AND amount > 0 AND quantity IS NULL AND price IS NULL AND fees = 0)
    OR
    (transaction_type IN ('deposit', 'withdrawal')
      AND instrument_id IS NULL AND amount > 0
      AND quantity IS NULL AND price IS NULL AND fees = 0)
  )
);

CREATE INDEX IF NOT EXISTS investment_transactions_user_portfolio_chronology_idx
  ON investment_transactions (user_id, portfolio_id, transaction_date, created_at, id);
CREATE INDEX IF NOT EXISTS investment_transactions_user_instrument_chronology_idx
  ON investment_transactions (user_id, instrument_id, transaction_date, created_at, id)
  WHERE instrument_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS investment_transactions_user_type_idx
  ON investment_transactions (user_id, transaction_type, transaction_date DESC);
CREATE INDEX IF NOT EXISTS investment_transactions_user_date_idx
  ON investment_transactions (user_id, transaction_date DESC, id);

CREATE TABLE IF NOT EXISTS investment_prices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  instrument_id UUID NOT NULL REFERENCES investment_instruments(id) ON DELETE CASCADE,
  price_date DATE NOT NULL,
  price NUMERIC(24,8) NOT NULL,
  currency VARCHAR(3) NOT NULL,
  source TEXT NOT NULL DEFAULT 'manual',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT investment_prices_price_positive CHECK (price > 0),
  CONSTRAINT investment_prices_currency_valid CHECK (currency ~ '^[A-Z]{3}$'),
  CONSTRAINT investment_prices_source_manual CHECK (source = 'manual'),
  CONSTRAINT investment_prices_user_instrument_date_unique UNIQUE (user_id, instrument_id, price_date)
);

CREATE INDEX IF NOT EXISTS investment_prices_user_instrument_date_idx
  ON investment_prices (user_id, instrument_id, price_date DESC);

CREATE OR REPLACE FUNCTION validate_investment_transaction_context()
RETURNS TRIGGER AS $$
DECLARE
  portfolio_currency TEXT;
  instrument_currency TEXT;
BEGIN
  SELECT p.base_currency INTO portfolio_currency
  FROM investment_portfolios p
  WHERE p.id = NEW.portfolio_id AND p.user_id = NEW.user_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION USING ERRCODE = '23514', CONSTRAINT = 'investment_transactions_portfolio_owner',
      MESSAGE = 'Investment Transaction and Portfolio ownership must match.';
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

CREATE OR REPLACE FUNCTION validate_investment_price_context()
RETURNS TRIGGER AS $$
DECLARE
  instrument_currency TEXT;
BEGIN
  SELECT i.currency INTO instrument_currency
  FROM investment_instruments i
  WHERE i.id = NEW.instrument_id AND i.user_id = NEW.user_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION USING ERRCODE = '23514', CONSTRAINT = 'investment_prices_instrument_owner',
      MESSAGE = 'Investment Price and Instrument ownership must match.';
  END IF;
  IF NEW.currency <> instrument_currency THEN
    RAISE EXCEPTION USING ERRCODE = '23514', CONSTRAINT = 'investment_prices_instrument_currency_match',
      MESSAGE = 'Investment Price currency must match Instrument currency.';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS investment_transactions_validate_context ON investment_transactions;
CREATE TRIGGER investment_transactions_validate_context
  BEFORE INSERT OR UPDATE OF user_id, portfolio_id, instrument_id, currency ON investment_transactions
  FOR EACH ROW EXECUTE FUNCTION validate_investment_transaction_context();

DROP TRIGGER IF EXISTS investment_prices_validate_context ON investment_prices;
CREATE TRIGGER investment_prices_validate_context
  BEFORE INSERT OR UPDATE OF user_id, instrument_id, currency ON investment_prices
  FOR EACH ROW EXECUTE FUNCTION validate_investment_price_context();

DROP TRIGGER IF EXISTS investment_portfolios_updated_at ON investment_portfolios;
CREATE TRIGGER investment_portfolios_updated_at
  BEFORE UPDATE ON investment_portfolios
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS investment_instruments_updated_at ON investment_instruments;
CREATE TRIGGER investment_instruments_updated_at
  BEFORE UPDATE ON investment_instruments
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS investment_transactions_updated_at ON investment_transactions;
CREATE TRIGGER investment_transactions_updated_at
  BEFORE UPDATE ON investment_transactions
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS investment_prices_updated_at ON investment_prices;
CREATE TRIGGER investment_prices_updated_at
  BEFORE UPDATE ON investment_prices
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

COMMIT;
