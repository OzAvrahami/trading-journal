-- File identity follows the same user/account boundary as trade deduplication.
-- Historical imports and their row lineage remain unchanged. A deleted account
-- becomes NULL and must not prevent importing into another explicit account.
DROP INDEX public.import_runs_user_successful_file_uidx;
CREATE UNIQUE INDEX import_runs_user_account_successful_file_uidx
  ON public.import_runs(user_id, account_id, file_sha256)
  WHERE status IN ('completed', 'completed_with_errors');
