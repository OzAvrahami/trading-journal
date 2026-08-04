-- Migration 007: measurable Goals MVP.
-- Adds user-owned goal definitions; progress remains derived from source records.

BEGIN;

CREATE TABLE IF NOT EXISTS goals (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name         VARCHAR(120) NOT NULL,
  description  TEXT,
  metric_key   VARCHAR(32) NOT NULL,
  comparison   VARCHAR(16) NOT NULL,
  target_value NUMERIC(18,4) NOT NULL,
  start_date   DATE NOT NULL,
  end_date     DATE NOT NULL,
  status       VARCHAR(16) NOT NULL DEFAULT 'active',
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT goals_name_not_blank
    CHECK (btrim(name) <> ''),
  CONSTRAINT goals_description_not_blank
    CHECK (description IS NULL OR btrim(description) <> ''),
  CONSTRAINT goals_metric_valid
    CHECK (metric_key IN (
      'net_pnl', 'closed_trades', 'win_rate', 'average_r',
      'rule_adherence', 'journal_entries', 'broken_rule_checks'
    )),
  CONSTRAINT goals_comparison_valid
    CHECK (comparison IN ('at_least', 'at_most')),
  CONSTRAINT goals_status_valid
    CHECK (status IN ('active', 'paused', 'archived')),
  CONSTRAINT goals_date_range_valid
    CHECK (end_date >= start_date),
  CONSTRAINT goals_metric_comparison_valid
    CHECK (
      (metric_key = 'broken_rule_checks' AND comparison = 'at_most')
      OR (metric_key <> 'broken_rule_checks' AND comparison = 'at_least')
    ),
  CONSTRAINT goals_target_value_safe
    CHECK (target_value BETWEEN -1000000000 AND 1000000000),
  CONSTRAINT goals_count_target_valid
    CHECK (
      metric_key NOT IN ('closed_trades', 'journal_entries', 'broken_rule_checks')
      OR (target_value >= 0 AND target_value <= 1000000000 AND target_value = trunc(target_value))
    ),
  CONSTRAINT goals_percentage_target_valid
    CHECK (
      metric_key NOT IN ('win_rate', 'rule_adherence')
      OR target_value BETWEEN 0 AND 100
    ),
  CONSTRAINT goals_average_r_target_valid
    CHECK (metric_key <> 'average_r' OR target_value BETWEEN -1000 AND 1000),
  CONSTRAINT goals_net_pnl_target_valid
    CHECK (metric_key <> 'net_pnl' OR target_value BETWEEN -1000000000 AND 1000000000)
);

CREATE INDEX IF NOT EXISTS idx_goals_user_status_end_date
  ON goals(user_id, status, end_date);
CREATE INDEX IF NOT EXISTS idx_goals_user_metric_dates
  ON goals(user_id, metric_key, start_date, end_date);
CREATE INDEX IF NOT EXISTS idx_goals_user_lower_name
  ON goals(user_id, lower(name));

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_trigger
    WHERE tgname = 'goals_updated_at'
      AND tgrelid = 'goals'::regclass
  ) THEN
    CREATE TRIGGER goals_updated_at
      BEFORE UPDATE ON goals
      FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
  END IF;
END;
$$;

COMMIT;
