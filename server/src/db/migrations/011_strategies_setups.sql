-- Migration 011: user-owned managed Strategies and Setups.
-- Historical trades retain their free-text strategy/setup snapshots; no IDs are backfilled.

BEGIN;

CREATE TABLE IF NOT EXISTS strategies (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name        TEXT NOT NULL,
  description TEXT,
  is_active   BOOLEAN NOT NULL DEFAULT TRUE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT strategies_name_length
    CHECK (char_length(btrim(name)) BETWEEN 1 AND 100),
  CONSTRAINT strategies_description_length
    CHECK (description IS NULL OR (btrim(description) <> '' AND char_length(description) <= 2000))
);

CREATE UNIQUE INDEX IF NOT EXISTS strategies_user_name_unique
  ON strategies (user_id, lower(btrim(name)));
CREATE INDEX IF NOT EXISTS strategies_user_active_name_idx
  ON strategies (user_id, is_active, lower(btrim(name)));

CREATE TABLE IF NOT EXISTS setups (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  strategy_id UUID NOT NULL REFERENCES strategies(id) ON DELETE CASCADE,
  name        TEXT NOT NULL,
  description TEXT,
  is_active   BOOLEAN NOT NULL DEFAULT TRUE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT setups_name_length
    CHECK (char_length(btrim(name)) BETWEEN 1 AND 100),
  CONSTRAINT setups_description_length
    CHECK (description IS NULL OR (btrim(description) <> '' AND char_length(description) <= 2000))
);

CREATE UNIQUE INDEX IF NOT EXISTS setups_user_strategy_name_unique
  ON setups (user_id, strategy_id, lower(btrim(name)));
CREATE INDEX IF NOT EXISTS setups_user_strategy_active_name_idx
  ON setups (user_id, strategy_id, is_active, lower(btrim(name)));

ALTER TABLE trades ADD COLUMN IF NOT EXISTS strategy_id UUID;
ALTER TABLE trades ADD COLUMN IF NOT EXISTS setup_id UUID;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'trades_strategy_id_fkey' AND conrelid = 'trades'::regclass) THEN
    ALTER TABLE trades ADD CONSTRAINT trades_strategy_id_fkey
      FOREIGN KEY (strategy_id) REFERENCES strategies(id) ON DELETE SET NULL;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'trades_setup_id_fkey' AND conrelid = 'trades'::regclass) THEN
    ALTER TABLE trades ADD CONSTRAINT trades_setup_id_fkey
      FOREIGN KEY (setup_id) REFERENCES setups(id) ON DELETE SET NULL;
  END IF;
END;
$$;

CREATE INDEX IF NOT EXISTS trades_user_strategy_id_idx ON trades (user_id, strategy_id);
CREATE INDEX IF NOT EXISTS trades_user_setup_id_idx ON trades (user_id, setup_id);

CREATE OR REPLACE FUNCTION validate_setup_strategy_owner()
RETURNS TRIGGER AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM strategies s
    WHERE s.id = NEW.strategy_id AND s.user_id = NEW.user_id
  ) THEN
    RAISE EXCEPTION USING
      ERRCODE = '23514',
      MESSAGE = 'Setup and Strategy ownership must match.',
      CONSTRAINT = 'setups_strategy_owner_match';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION validate_trade_managed_classification()
RETURNS TRIGGER AS $$
DECLARE
  linked_setup_strategy UUID;
BEGIN
  IF NEW.setup_id IS NOT NULL AND NEW.strategy_id IS NULL THEN
    RAISE EXCEPTION USING
      ERRCODE = '23514',
      MESSAGE = 'A managed Setup requires a managed Strategy.',
      CONSTRAINT = 'trades_setup_requires_strategy';
  END IF;

  IF NEW.strategy_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM strategies s
    WHERE s.id = NEW.strategy_id AND s.user_id = NEW.user_id
  ) THEN
    RAISE EXCEPTION USING
      ERRCODE = '23514',
      MESSAGE = 'Trade and Strategy ownership must match.',
      CONSTRAINT = 'trades_strategy_owner_match';
  END IF;

  IF NEW.setup_id IS NOT NULL THEN
    SELECT su.strategy_id INTO linked_setup_strategy
    FROM setups su
    WHERE su.id = NEW.setup_id AND su.user_id = NEW.user_id;

    IF NOT FOUND THEN
      RAISE EXCEPTION USING
        ERRCODE = '23514',
        MESSAGE = 'Trade and Setup ownership must match.',
        CONSTRAINT = 'trades_setup_owner_match';
    END IF;
    IF linked_setup_strategy <> NEW.strategy_id THEN
      RAISE EXCEPTION USING
        ERRCODE = '23514',
        MESSAGE = 'The managed Setup must belong to the selected Strategy.',
        CONSTRAINT = 'trades_setup_strategy_match';
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS setups_validate_strategy_owner ON setups;
CREATE TRIGGER setups_validate_strategy_owner
  BEFORE INSERT OR UPDATE OF user_id, strategy_id ON setups
  FOR EACH ROW EXECUTE FUNCTION validate_setup_strategy_owner();

DROP TRIGGER IF EXISTS trades_validate_managed_classification ON trades;
CREATE TRIGGER trades_validate_managed_classification
  BEFORE INSERT OR UPDATE OF user_id, strategy_id, setup_id ON trades
  FOR EACH ROW EXECUTE FUNCTION validate_trade_managed_classification();

DROP TRIGGER IF EXISTS strategies_updated_at ON strategies;
CREATE TRIGGER strategies_updated_at
  BEFORE UPDATE ON strategies
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS setups_updated_at ON setups;
CREATE TRIGGER setups_updated_at
  BEFORE UPDATE ON setups
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

COMMIT;
