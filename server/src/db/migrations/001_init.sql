-- Enable UUID generation
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ============================================================
-- USERS
-- ============================================================
CREATE TABLE IF NOT EXISTS users (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email             VARCHAR(255) UNIQUE NOT NULL,
  password_hash     TEXT NOT NULL,
  display_name      VARCHAR(100),
  default_market    VARCHAR(20),
  default_timeframe VARCHAR(10),
  created_at        TIMESTAMPTZ DEFAULT NOW(),
  updated_at        TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);

-- ============================================================
-- REFRESH TOKENS
-- ============================================================
CREATE TABLE IF NOT EXISTS refresh_tokens (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash  TEXT NOT NULL,
  expires_at  TIMESTAMPTZ NOT NULL,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_refresh_tokens_user_id ON refresh_tokens(user_id);
CREATE INDEX IF NOT EXISTS idx_refresh_tokens_hash    ON refresh_tokens(token_hash);

-- ============================================================
-- TRADES
-- ============================================================
CREATE TABLE IF NOT EXISTS trades (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id           UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,

  -- Core fields
  symbol            VARCHAR(20) NOT NULL,
  market            VARCHAR(20) NOT NULL CHECK (market IN ('stocks','crypto','futures','forex')),
  direction         VARCHAR(5)  NOT NULL CHECK (direction IN ('long','short')),
  entry_datetime    TIMESTAMPTZ NOT NULL,
  exit_datetime     TIMESTAMPTZ,
  entry_price       NUMERIC(18,8) NOT NULL,
  exit_price        NUMERIC(18,8),
  quantity          NUMERIC(18,8) NOT NULL,
  fees              NUMERIC(18,4) NOT NULL DEFAULT 0,

  -- Trading context
  strategy          VARCHAR(100),
  setup             VARCHAR(100),
  timeframe         VARCHAR(10),
  risk_amount       NUMERIC(18,4),
  stop_loss         NUMERIC(18,8),
  take_profit       NUMERIC(18,8),
  notes             TEXT,
  emotions          JSONB,
  screenshot_links  TEXT[],

  -- Server-computed fields (stored for query/sort performance)
  status            VARCHAR(10) NOT NULL DEFAULT 'open' CHECK (status IN ('open','closed')),
  pnl_gross         NUMERIC(18,4),
  pnl_net           NUMERIC(18,4),
  r_multiple        NUMERIC(10,4),
  duration_minutes  INTEGER,

  created_at        TIMESTAMPTZ DEFAULT NOW(),
  updated_at        TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_trades_user_id  ON trades(user_id);
CREATE INDEX IF NOT EXISTS idx_trades_entry_dt ON trades(user_id, entry_datetime DESC);
CREATE INDEX IF NOT EXISTS idx_trades_symbol   ON trades(user_id, symbol);
CREATE INDEX IF NOT EXISTS idx_trades_status   ON trades(user_id, status);
CREATE INDEX IF NOT EXISTS idx_trades_strategy ON trades(user_id, strategy);

-- ============================================================
-- AUTO-UPDATE updated_at
-- ============================================================
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS users_updated_at  ON users;
DROP TRIGGER IF EXISTS trades_updated_at ON trades;

CREATE TRIGGER users_updated_at
  BEFORE UPDATE ON users
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER trades_updated_at
  BEFORE UPDATE ON trades
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
