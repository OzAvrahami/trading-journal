-- Forward validation; historical migration 008 remains unchanged.
BEGIN;
ALTER TABLE public.trades VALIDATE CONSTRAINT trades_exit_fields_consistent;
ALTER TABLE public.trades VALIDATE CONSTRAINT trades_exit_datetime_not_before_entry;
COMMIT;
