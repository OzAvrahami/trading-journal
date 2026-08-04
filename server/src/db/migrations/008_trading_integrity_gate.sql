-- Trading integrity gate: enforce trade/account ownership and coherent exit fields.
-- The CHECK constraints are NOT VALID so PostgreSQL enforces them for future
-- inserts and updates without scanning or rejecting unaudited historical rows.
BEGIN;

CREATE OR REPLACE FUNCTION validate_trade_account_ownership()
RETURNS TRIGGER AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM trading_accounts
    WHERE id = NEW.account_id
      AND user_id = NEW.user_id
  ) THEN
    RAISE EXCEPTION USING
      ERRCODE = '23514',
      MESSAGE = 'Trade account ownership is inconsistent.',
      DETAIL = 'The selected account does not belong to the trade owner.',
      CONSTRAINT = 'trades_account_owner';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_trigger
    WHERE tgname = 'trades_validate_account_ownership'
      AND tgrelid = 'trades'::regclass
  ) THEN
    CREATE TRIGGER trades_validate_account_ownership
      BEFORE INSERT OR UPDATE OF user_id, account_id ON trades
      FOR EACH ROW
      EXECUTE FUNCTION validate_trade_account_ownership();
  END IF;
END;
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'trades_exit_fields_consistent'
      AND conrelid = 'trades'::regclass
  ) THEN
    ALTER TABLE trades
      ADD CONSTRAINT trades_exit_fields_consistent
      CHECK (
        (exit_datetime IS NULL AND exit_price IS NULL)
        OR
        (exit_datetime IS NOT NULL AND exit_price IS NOT NULL)
      ) NOT VALID;
  END IF;
END;
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'trades_exit_datetime_not_before_entry'
      AND conrelid = 'trades'::regclass
  ) THEN
    ALTER TABLE trades
      ADD CONSTRAINT trades_exit_datetime_not_before_entry
      CHECK (exit_datetime IS NULL OR exit_datetime >= entry_datetime)
      NOT VALID;
  END IF;
END;
$$;

-- After historical rows have been audited and corrected, validate explicitly:
-- ALTER TABLE trades VALIDATE CONSTRAINT trades_exit_fields_consistent;
-- ALTER TABLE trades VALIDATE CONSTRAINT trades_exit_datetime_not_before_entry;

COMMIT;
