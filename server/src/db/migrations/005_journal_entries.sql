-- Migration 005: Journal & Reviews MVP.
-- Adds user-owned journal entries and optional many-to-many trade links.

BEGIN;

CREATE TABLE IF NOT EXISTS journal_entries (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  entry_type  VARCHAR(32) NOT NULL
                CHECK (entry_type IN ('note', 'trade_review', 'daily_review', 'weekly_review')),
  entry_date  DATE NOT NULL,
  title       VARCHAR(160) NOT NULL,
  content     TEXT NOT NULL,
  tags        TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  is_complete BOOLEAN NOT NULL DEFAULT FALSE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT journal_entries_title_not_blank
    CHECK (btrim(title) <> ''),
  CONSTRAINT journal_entries_content_not_blank
    CHECK (btrim(content) <> ''),
  CONSTRAINT journal_entries_tags_max_10
    CHECK (cardinality(tags) <= 10)
);

CREATE INDEX IF NOT EXISTS idx_journal_entries_user_date
  ON journal_entries(user_id, entry_date DESC);
CREATE INDEX IF NOT EXISTS idx_journal_entries_user_type_date
  ON journal_entries(user_id, entry_type, entry_date DESC);
CREATE INDEX IF NOT EXISTS idx_journal_entries_user_complete_date
  ON journal_entries(user_id, is_complete, entry_date DESC);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_trigger
    WHERE tgname = 'journal_entries_updated_at'
      AND tgrelid = 'journal_entries'::regclass
  ) THEN
    CREATE TRIGGER journal_entries_updated_at
      BEFORE UPDATE ON journal_entries
      FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
  END IF;
END;
$$;

CREATE TABLE IF NOT EXISTS journal_entry_trades (
  journal_entry_id UUID NOT NULL REFERENCES journal_entries(id) ON DELETE CASCADE,
  trade_id         UUID NOT NULL REFERENCES trades(id) ON DELETE CASCADE,
  user_id          UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (journal_entry_id, trade_id)
);

CREATE INDEX IF NOT EXISTS idx_journal_entry_trades_user_trade
  ON journal_entry_trades(user_id, trade_id, journal_entry_id);
CREATE INDEX IF NOT EXISTS idx_journal_entry_trades_user_entry
  ON journal_entry_trades(user_id, journal_entry_id);

CREATE OR REPLACE FUNCTION validate_journal_entry_trade_ownership()
RETURNS TRIGGER AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM journal_entries je
    WHERE je.id = NEW.journal_entry_id
      AND je.user_id = NEW.user_id
  ) THEN
    RAISE EXCEPTION USING
      ERRCODE = '23514',
      MESSAGE = 'Journal entry link ownership is inconsistent.',
      DETAIL = 'journal_entry_id does not belong to user_id.',
      CONSTRAINT = 'journal_entry_trades_journal_entry_owner';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM trades t
    WHERE t.id = NEW.trade_id
      AND t.user_id = NEW.user_id
  ) THEN
    RAISE EXCEPTION USING
      ERRCODE = '23514',
      MESSAGE = 'Trade link ownership is inconsistent.',
      DETAIL = 'trade_id does not belong to user_id.',
      CONSTRAINT = 'journal_entry_trades_trade_owner';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_trigger
    WHERE tgname = 'journal_entry_trades_validate_ownership'
      AND tgrelid = 'journal_entry_trades'::regclass
  ) THEN
    CREATE TRIGGER journal_entry_trades_validate_ownership
      BEFORE INSERT OR UPDATE ON journal_entry_trades
      FOR EACH ROW EXECUTE FUNCTION validate_journal_entry_trade_ownership();
  END IF;
END;
$$;

COMMIT;
