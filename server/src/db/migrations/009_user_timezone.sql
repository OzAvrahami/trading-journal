-- Date & Time Foundation: one IANA timezone identifier per user.
BEGIN;

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS timezone VARCHAR(64) NOT NULL DEFAULT 'Asia/Jerusalem';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'users_timezone_not_blank'
      AND conrelid = 'users'::regclass
  ) THEN
    ALTER TABLE users
      ADD CONSTRAINT users_timezone_not_blank
      CHECK (btrim(timezone) <> '');
  END IF;
END;
$$;

COMMIT;
