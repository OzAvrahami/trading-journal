-- Migration 010: Daily Review structured subtype.
-- Keeps Journal entries canonical while adding one owned detail row per review date.

BEGIN;

CREATE TABLE IF NOT EXISTS daily_review_details (
  journal_entry_id  UUID PRIMARY KEY REFERENCES journal_entries(id) ON DELETE CASCADE,
  user_id           UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  review_date       DATE NOT NULL,
  went_well         TEXT,
  improve           TEXT,
  next_session_plan TEXT,
  emotions          TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  mistakes          TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT daily_review_details_user_date_unique UNIQUE (user_id, review_date),
  CONSTRAINT daily_review_details_went_well_not_blank
    CHECK (went_well IS NULL OR btrim(went_well) <> ''),
  CONSTRAINT daily_review_details_improve_not_blank
    CHECK (improve IS NULL OR btrim(improve) <> ''),
  CONSTRAINT daily_review_details_next_session_plan_not_blank
    CHECK (next_session_plan IS NULL OR btrim(next_session_plan) <> ''),
  CONSTRAINT daily_review_details_emotions_max_10
    CHECK (cardinality(emotions) <= 10),
  CONSTRAINT daily_review_details_mistakes_max_10
    CHECK (cardinality(mistakes) <= 10)
);

CREATE OR REPLACE FUNCTION validate_daily_review_details_context()
RETURNS TRIGGER AS $$
DECLARE
  linked_entry journal_entries%ROWTYPE;
BEGIN
  SELECT * INTO linked_entry
  FROM journal_entries
  WHERE id = NEW.journal_entry_id
    AND user_id = NEW.user_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION USING
      ERRCODE = '23514',
      MESSAGE = 'Daily Review ownership is inconsistent.',
      CONSTRAINT = 'daily_review_details_journal_owner';
  END IF;

  IF linked_entry.entry_type <> 'daily_review' THEN
    RAISE EXCEPTION USING
      ERRCODE = '23514',
      MESSAGE = 'Daily Review details require a daily_review Journal entry.',
      CONSTRAINT = 'daily_review_details_journal_type';
  END IF;

  IF linked_entry.entry_date <> NEW.review_date THEN
    RAISE EXCEPTION USING
      ERRCODE = '23514',
      MESSAGE = 'Daily Review date must match its Journal entry.',
      CONSTRAINT = 'daily_review_details_review_date_match';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger
    WHERE tgname = 'daily_review_details_validate_context'
      AND tgrelid = 'daily_review_details'::regclass
  ) THEN
    CREATE TRIGGER daily_review_details_validate_context
      BEFORE INSERT OR UPDATE ON daily_review_details
      FOR EACH ROW EXECUTE FUNCTION validate_daily_review_details_context();
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger
    WHERE tgname = 'daily_review_details_updated_at'
      AND tgrelid = 'daily_review_details'::regclass
  ) THEN
    CREATE TRIGGER daily_review_details_updated_at
      BEFORE UPDATE ON daily_review_details
      FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
  END IF;
END;
$$;

COMMIT;
