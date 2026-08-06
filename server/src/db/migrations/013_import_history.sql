BEGIN;

CREATE TABLE IF NOT EXISTS import_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  account_id UUID NULL REFERENCES trading_accounts(id) ON DELETE SET NULL,
  original_filename TEXT NOT NULL,
  file_size_bytes BIGINT NOT NULL,
  file_sha256 TEXT NOT NULL,
  source_type TEXT NOT NULL,
  status TEXT NOT NULL,
  total_rows INTEGER NOT NULL DEFAULT 0,
  imported_rows INTEGER NOT NULL DEFAULT 0,
  skipped_rows INTEGER NOT NULL DEFAULT 0,
  failed_rows INTEGER NOT NULL DEFAULT 0,
  mapping JSONB NOT NULL DEFAULT '{}'::JSONB,
  failure_code TEXT NULL,
  failure_detail TEXT NULL,
  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMPTZ NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT import_runs_filename_nonblank CHECK (btrim(original_filename) <> ''),
  CONSTRAINT import_runs_filename_length CHECK (char_length(original_filename) <= 255),
  CONSTRAINT import_runs_file_size_nonnegative CHECK (file_size_bytes >= 0),
  CONSTRAINT import_runs_sha256_format CHECK (file_sha256 ~ '^[0-9a-f]{64}$'),
  CONSTRAINT import_runs_source_type_nonblank CHECK (btrim(source_type) <> ''),
  CONSTRAINT import_runs_source_type_length CHECK (char_length(source_type) <= 64),
  CONSTRAINT import_runs_status_valid CHECK (status IN ('processing', 'completed', 'completed_with_errors', 'failed')),
  CONSTRAINT import_runs_counts_nonnegative CHECK (total_rows >= 0 AND imported_rows >= 0 AND skipped_rows >= 0 AND failed_rows >= 0),
  CONSTRAINT import_runs_counts_bounded CHECK (imported_rows + skipped_rows + failed_rows <= total_rows),
  CONSTRAINT import_runs_terminal_counts_complete CHECK (status = 'processing' OR imported_rows + skipped_rows + failed_rows = total_rows),
  CONSTRAINT import_runs_mapping_object CHECK (jsonb_typeof(mapping) = 'object'),
  CONSTRAINT import_runs_failure_code_nonblank CHECK (failure_code IS NULL OR btrim(failure_code) <> ''),
  CONSTRAINT import_runs_failure_detail_nonblank CHECK (failure_detail IS NULL OR btrim(failure_detail) <> ''),
  CONSTRAINT import_runs_failure_detail_length CHECK (failure_detail IS NULL OR char_length(failure_detail) <= 2000),
  CONSTRAINT import_runs_completion_consistent CHECK (
    (status = 'processing' AND completed_at IS NULL)
    OR (status IN ('completed', 'completed_with_errors', 'failed') AND completed_at IS NOT NULL)
  )
);

CREATE TABLE IF NOT EXISTS import_run_rows (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  import_run_id UUID NOT NULL REFERENCES import_runs(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  row_number INTEGER NOT NULL,
  status TEXT NOT NULL,
  trade_id UUID NULL REFERENCES trades(id) ON DELETE SET NULL,
  symbol TEXT NULL,
  source_identifier TEXT NULL,
  error_code TEXT NULL,
  error_detail TEXT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT import_run_rows_row_positive CHECK (row_number > 0),
  CONSTRAINT import_run_rows_run_row_unique UNIQUE (import_run_id, row_number),
  CONSTRAINT import_run_rows_status_valid CHECK (status IN ('imported', 'skipped_duplicate', 'failed_validation', 'failed_insert')),
  CONSTRAINT import_run_rows_symbol_nonblank CHECK (symbol IS NULL OR btrim(symbol) <> ''),
  CONSTRAINT import_run_rows_symbol_length CHECK (symbol IS NULL OR char_length(symbol) <= 32),
  CONSTRAINT import_run_rows_source_identifier_nonblank CHECK (source_identifier IS NULL OR btrim(source_identifier) <> ''),
  CONSTRAINT import_run_rows_source_identifier_length CHECK (source_identifier IS NULL OR char_length(source_identifier) <= 255),
  CONSTRAINT import_run_rows_error_code_nonblank CHECK (error_code IS NULL OR btrim(error_code) <> ''),
  CONSTRAINT import_run_rows_error_code_length CHECK (error_code IS NULL OR char_length(error_code) <= 96),
  CONSTRAINT import_run_rows_error_detail_nonblank CHECK (error_detail IS NULL OR btrim(error_detail) <> ''),
  CONSTRAINT import_run_rows_error_detail_length CHECK (error_detail IS NULL OR char_length(error_detail) <= 1000)
);

CREATE INDEX IF NOT EXISTS import_runs_user_created_idx ON import_runs(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS import_runs_user_status_created_idx ON import_runs(user_id, status, created_at DESC);
CREATE UNIQUE INDEX IF NOT EXISTS import_runs_user_successful_file_uidx
  ON import_runs(user_id, file_sha256)
  WHERE status IN ('completed', 'completed_with_errors');
CREATE INDEX IF NOT EXISTS import_run_rows_run_row_idx ON import_run_rows(import_run_id, row_number);
CREATE INDEX IF NOT EXISTS import_run_rows_user_trade_idx ON import_run_rows(user_id, trade_id) WHERE trade_id IS NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger
    WHERE tgname = 'update_import_runs_updated_at'
      AND tgrelid = 'import_runs'::regclass
      AND NOT tgisinternal
  ) THEN
    CREATE TRIGGER update_import_runs_updated_at
      BEFORE UPDATE ON import_runs
      FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION enforce_import_run_ownership()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.account_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM trading_accounts WHERE id = NEW.account_id AND user_id = NEW.user_id
  ) THEN
    RAISE EXCEPTION USING ERRCODE = '23514', CONSTRAINT = 'import_runs_account_owner', MESSAGE = 'Import Run Account must belong to the same user.';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger
    WHERE tgname = 'enforce_import_run_ownership_trigger'
      AND tgrelid = 'import_runs'::regclass
      AND NOT tgisinternal
  ) THEN
    CREATE TRIGGER enforce_import_run_ownership_trigger
      BEFORE INSERT OR UPDATE OF user_id, account_id ON import_runs
      FOR EACH ROW EXECUTE FUNCTION enforce_import_run_ownership();
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION enforce_import_run_row_ownership()
RETURNS TRIGGER AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM import_runs WHERE id = NEW.import_run_id AND user_id = NEW.user_id) THEN
    RAISE EXCEPTION USING ERRCODE = '23514', CONSTRAINT = 'import_run_rows_run_owner', MESSAGE = 'Import Run row must belong to the Run owner.';
  END IF;
  IF NEW.trade_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM trades WHERE id = NEW.trade_id AND user_id = NEW.user_id) THEN
    RAISE EXCEPTION USING ERRCODE = '23514', CONSTRAINT = 'import_run_rows_trade_owner', MESSAGE = 'Imported Trade must belong to the Run owner.';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger
    WHERE tgname = 'enforce_import_run_row_ownership_trigger'
      AND tgrelid = 'import_run_rows'::regclass
      AND NOT tgisinternal
  ) THEN
    CREATE TRIGGER enforce_import_run_row_ownership_trigger
      BEFORE INSERT OR UPDATE OF import_run_id, user_id, trade_id ON import_run_rows
      FOR EACH ROW EXECUTE FUNCTION enforce_import_run_row_ownership();
  END IF;
END;
$$;

COMMIT;
