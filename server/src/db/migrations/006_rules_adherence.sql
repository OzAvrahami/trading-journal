-- Migration 006: Rules & Adherence MVP.
-- Adds user-owned trading rules and historical rule checks with optional context links.

BEGIN;

CREATE TABLE IF NOT EXISTS trading_rules (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name        VARCHAR(120) NOT NULL,
  description TEXT,
  scope       VARCHAR(24) NOT NULL,
  is_active   BOOLEAN NOT NULL DEFAULT TRUE,
  sort_order  INTEGER NOT NULL DEFAULT 0,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT trading_rules_name_not_blank
    CHECK (btrim(name) <> ''),
  CONSTRAINT trading_rules_description_not_blank
    CHECK (description IS NULL OR btrim(description) <> ''),
  CONSTRAINT trading_rules_scope_valid
    CHECK (scope IN ('trade', 'daily', 'general')),
  CONSTRAINT trading_rules_sort_order_nonnegative
    CHECK (sort_order >= 0)
);

CREATE INDEX IF NOT EXISTS idx_trading_rules_user_active_order
  ON trading_rules(user_id, is_active, sort_order, created_at);
CREATE INDEX IF NOT EXISTS idx_trading_rules_user_scope_active
  ON trading_rules(user_id, scope, is_active);
CREATE INDEX IF NOT EXISTS idx_trading_rules_user_lower_name
  ON trading_rules(user_id, lower(name));

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_trigger
    WHERE tgname = 'trading_rules_updated_at'
      AND tgrelid = 'trading_rules'::regclass
  ) THEN
    CREATE TRIGGER trading_rules_updated_at
      BEFORE UPDATE ON trading_rules
      FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
  END IF;
END;
$$;

CREATE TABLE IF NOT EXISTS rule_checks (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id          UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  rule_id          UUID NOT NULL REFERENCES trading_rules(id) ON DELETE NO ACTION,
  check_date       DATE NOT NULL,
  outcome          VARCHAR(24) NOT NULL,
  notes            TEXT,
  trade_id         UUID REFERENCES trades(id) ON DELETE SET NULL,
  journal_entry_id UUID REFERENCES journal_entries(id) ON DELETE SET NULL,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT rule_checks_outcome_valid
    CHECK (outcome IN ('followed', 'broken', 'not_applicable')),
  CONSTRAINT rule_checks_notes_not_blank
    CHECK (notes IS NULL OR btrim(notes) <> '')
);

CREATE INDEX IF NOT EXISTS idx_rule_checks_user_date
  ON rule_checks(user_id, check_date DESC);
CREATE INDEX IF NOT EXISTS idx_rule_checks_user_rule_date
  ON rule_checks(user_id, rule_id, check_date DESC);
CREATE INDEX IF NOT EXISTS idx_rule_checks_user_outcome_date
  ON rule_checks(user_id, outcome, check_date DESC);
CREATE INDEX IF NOT EXISTS idx_rule_checks_user_trade
  ON rule_checks(user_id, trade_id) WHERE trade_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_rule_checks_user_journal_entry
  ON rule_checks(user_id, journal_entry_id) WHERE journal_entry_id IS NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_trigger
    WHERE tgname = 'rule_checks_updated_at'
      AND tgrelid = 'rule_checks'::regclass
  ) THEN
    CREATE TRIGGER rule_checks_updated_at
      BEFORE UPDATE ON rule_checks
      FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION validate_rule_check_ownership()
RETURNS TRIGGER AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM trading_rules r
    WHERE r.id = NEW.rule_id
      AND r.user_id = NEW.user_id
  ) THEN
    RAISE EXCEPTION USING
      ERRCODE = '23514',
      MESSAGE = 'Rule check ownership is inconsistent.',
      DETAIL = 'rule_id does not belong to user_id.',
      CONSTRAINT = 'rule_checks_rule_owner';
  END IF;

  IF NEW.trade_id IS NOT NULL AND NOT EXISTS (
    SELECT 1
    FROM trades t
    WHERE t.id = NEW.trade_id
      AND t.user_id = NEW.user_id
  ) THEN
    RAISE EXCEPTION USING
      ERRCODE = '23514',
      MESSAGE = 'Rule check trade ownership is inconsistent.',
      DETAIL = 'trade_id does not belong to user_id.',
      CONSTRAINT = 'rule_checks_trade_owner';
  END IF;

  IF NEW.journal_entry_id IS NOT NULL AND NOT EXISTS (
    SELECT 1
    FROM journal_entries je
    WHERE je.id = NEW.journal_entry_id
      AND je.user_id = NEW.user_id
  ) THEN
    RAISE EXCEPTION USING
      ERRCODE = '23514',
      MESSAGE = 'Rule check Journal ownership is inconsistent.',
      DETAIL = 'journal_entry_id does not belong to user_id.',
      CONSTRAINT = 'rule_checks_journal_entry_owner';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_trigger
    WHERE tgname = 'rule_checks_validate_ownership'
      AND tgrelid = 'rule_checks'::regclass
  ) THEN
    CREATE TRIGGER rule_checks_validate_ownership
      BEFORE INSERT OR UPDATE ON rule_checks
      FOR EACH ROW EXECUTE FUNCTION validate_rule_check_ownership();
  END IF;
END;
$$;

COMMIT;
