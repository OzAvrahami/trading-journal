BEGIN;

CREATE TABLE IF NOT EXISTS user_preferences (
  user_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  locale TEXT NULL,
  theme TEXT NULL,
  trade_form_mode TEXT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT user_preferences_locale_valid CHECK (locale IS NULL OR locale IN ('en', 'he')),
  CONSTRAINT user_preferences_theme_valid CHECK (theme IS NULL OR theme IN ('system', 'light', 'dark')),
  CONSTRAINT user_preferences_trade_form_mode_valid CHECK (trade_form_mode IS NULL OR trade_form_mode IN ('simple', 'advanced'))
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger
    WHERE tgname = 'update_user_preferences_updated_at'
      AND tgrelid = 'user_preferences'::regclass
      AND NOT tgisinternal
  ) THEN
    CREATE TRIGGER update_user_preferences_updated_at
      BEFORE UPDATE ON user_preferences
      FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
  END IF;
END;
$$;

COMMIT;
