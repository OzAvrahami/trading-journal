-- Storage and integrity only. Reconciliation decisions remain in JavaScript.
-- No historical values, timestamps, fees or dedup keys are rewritten.
ALTER TABLE trades ALTER COLUMN fees DROP NOT NULL;
ALTER TABLE trades ADD COLUMN source_managed BOOLEAN NOT NULL DEFAULT FALSE;

CREATE TABLE capture_accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  account_id UUID NOT NULL REFERENCES trading_accounts(id) ON DELETE CASCADE,
  provider TEXT NOT NULL,
  environment TEXT NOT NULL,
  external_id TEXT NOT NULL,
  external_name TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(user_id, provider, environment, external_id),
  UNIQUE(user_id, account_id, provider)
);
CREATE TABLE source_captures (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  mapping_id UUID NOT NULL REFERENCES capture_accounts(id) ON DELETE CASCADE,
  import_run_id UUID NOT NULL UNIQUE REFERENCES import_runs(id) ON DELETE CASCADE,
  package_sha256 TEXT NOT NULL,
  performance_sha256 TEXT NOT NULL,
  captured_at TIMESTAMPTZ NOT NULL,
  verified_offset_minutes INTEGER NOT NULL CHECK (verified_offset_minutes BETWEEN -840 AND 840),
  provenance JSONB NOT NULL,
  UNIQUE(mapping_id, package_sha256)
);
CREATE TABLE capture_financial_snapshots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  mapping_id UUID NOT NULL REFERENCES capture_accounts(id) ON DELETE CASCADE,
  evidence_key TEXT NOT NULL,
  coverage JSONB NOT NULL,
  currency TEXT NOT NULL,
  gross NUMERIC(18,4) NOT NULL,
  trading_fees NUMERIC(18,4) NOT NULL,
  net NUMERIC(18,4) NOT NULL,
  summary_captured_at TIMESTAMPTZ NOT NULL,
  cash_captured_at TIMESTAMPTZ NOT NULL,
  evidence JSONB NOT NULL,
  UNIQUE(mapping_id, evidence_key)
);
ALTER TABLE source_captures ADD COLUMN financial_snapshot_id UUID REFERENCES capture_financial_snapshots(id);
CREATE TABLE capture_trade_groups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  mapping_id UUID NOT NULL REFERENCES capture_accounts(id) ON DELETE CASCADE,
  group_key TEXT NOT NULL,
  trade_id UUID REFERENCES trades(id) ON DELETE SET NULL,
  UNIQUE(mapping_id, group_key)
);
CREATE TABLE capture_execution_pairs (
  mapping_id UUID NOT NULL REFERENCES capture_accounts(id) ON DELETE CASCADE,
  buy_fill_id TEXT NOT NULL,
  sell_fill_id TEXT NOT NULL,
  group_id UUID NOT NULL REFERENCES capture_trade_groups(id) ON DELETE CASCADE,
  first_capture_id UUID NOT NULL REFERENCES source_captures(id),
  execution JSONB NOT NULL,
  PRIMARY KEY(mapping_id, buy_fill_id, sell_fill_id)
);
-- Deleted trades leave group/pair tombstones so a later capture cannot recreate them silently.
ALTER TABLE capture_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE source_captures ENABLE ROW LEVEL SECURITY;
ALTER TABLE capture_financial_snapshots ENABLE ROW LEVEL SECURITY;
ALTER TABLE capture_trade_groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE capture_execution_pairs ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON capture_accounts, source_captures, capture_financial_snapshots,
  capture_trade_groups, capture_execution_pairs FROM PUBLIC;
DO $$ DECLARE api_role text; BEGIN
  FOREACH api_role IN ARRAY ARRAY['anon', 'authenticated'] LOOP
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname=api_role) THEN
      EXECUTE format('REVOKE ALL ON capture_accounts, source_captures, capture_financial_snapshots, capture_trade_groups, capture_execution_pairs FROM %I', api_role);
    END IF;
  END LOOP;
END $$;
