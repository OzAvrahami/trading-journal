-- Deny direct Supabase Data API access to the server-owned application schema.
-- Express remains the only application data boundary and connects with the trusted
-- PostgreSQL owner/BYPASSRLS role. Intentionally do not add Data API policies or
-- FORCE ROW LEVEL SECURITY.
BEGIN;

ALTER TABLE public.daily_review_details ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.goals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.import_run_rows ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.import_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.investment_instruments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.investment_portfolios ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.investment_prices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.investment_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.journal_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.journal_entry_trades ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.refresh_tokens ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rule_checks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.schema_migrations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.setups ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.strategies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.trades ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.trading_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.trading_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_preferences ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;

-- PUBLIC always exists. Supabase API roles are handled conditionally below so the
-- migration remains usable by local PostgreSQL installations without those roles.
REVOKE ALL PRIVILEGES ON TABLE
  public.daily_review_details,
  public.goals,
  public.import_run_rows,
  public.import_runs,
  public.investment_instruments,
  public.investment_portfolios,
  public.investment_prices,
  public.investment_transactions,
  public.journal_entries,
  public.journal_entry_trades,
  public.refresh_tokens,
  public.rule_checks,
  public.schema_migrations,
  public.setups,
  public.strategies,
  public.trades,
  public.trading_accounts,
  public.trading_rules,
  public.user_preferences,
  public.users
FROM PUBLIC;

DO $revoke_api_table_privileges$
DECLARE
  api_role text;
  protected_tables CONSTANT text :=
    'public.daily_review_details, public.goals, public.import_run_rows, public.import_runs, '
    'public.investment_instruments, public.investment_portfolios, public.investment_prices, '
    'public.investment_transactions, public.journal_entries, public.journal_entry_trades, '
    'public.refresh_tokens, public.rule_checks, public.schema_migrations, public.setups, '
    'public.strategies, public.trades, public.trading_accounts, public.trading_rules, '
    'public.user_preferences, public.users';
BEGIN
  FOREACH api_role IN ARRAY ARRAY['anon', 'authenticated']
  LOOP
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = api_role) THEN
      EXECUTE format(
        'REVOKE ALL PRIVILEGES ON TABLE %s FROM %I',
        protected_tables,
        api_role
      );
    END IF;
  END LOOP;
END;
$revoke_api_table_privileges$;

-- These are application trigger functions, not Data API RPCs. Revoking EXECUTE
-- does not disable already-created triggers; trigger execution does not re-check
-- the invoking statement user's EXECUTE privilege on the trigger function.
DO $revoke_application_function_privileges$
DECLARE
  api_role text;
  function_name text;
  application_functions CONSTANT text[] := ARRAY[
    'enforce_import_run_ownership',
    'enforce_import_run_row_ownership',
    'update_updated_at_column',
    'validate_daily_review_details_context',
    'validate_investment_portfolio_account_context',
    'validate_investment_price_context',
    'validate_investment_transaction_context',
    'validate_journal_entry_trade_ownership',
    'validate_rule_check_ownership',
    'validate_setup_strategy_owner',
    'validate_trade_account_ownership',
    'validate_trade_managed_classification',
    'validate_trading_account_portfolio_context'
  ];
BEGIN
  FOREACH function_name IN ARRAY application_functions
  LOOP
    IF to_regprocedure(format('public.%I()', function_name)) IS NULL THEN
      RAISE EXCEPTION 'Expected application function public.%() is missing.', function_name;
    END IF;

    EXECUTE format(
      'REVOKE EXECUTE ON FUNCTION public.%I() FROM PUBLIC',
      function_name
    );

    FOREACH api_role IN ARRAY ARRAY['anon', 'authenticated']
    LOOP
      IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = api_role) THEN
        EXECUTE format(
          'REVOKE EXECUTE ON FUNCTION public.%I() FROM %I',
          function_name,
          api_role
        );
      END IF;
    END LOOP;
  END LOOP;
END;
$revoke_application_function_privileges$;

-- The audited schema currently has no application-owned sequences because UUIDs
-- are generated with gen_random_uuid(). Revoke any sequence that PostgreSQL does
-- associate with a protected table without touching unrelated public objects.
DO $revoke_application_sequence_privileges$
DECLARE
  api_role text;
  sequence_record record;
  protected_table_names CONSTANT text[] := ARRAY[
    'daily_review_details', 'goals', 'import_run_rows', 'import_runs',
    'investment_instruments', 'investment_portfolios', 'investment_prices',
    'investment_transactions', 'journal_entries', 'journal_entry_trades',
    'refresh_tokens', 'rule_checks', 'schema_migrations', 'setups', 'strategies',
    'trades', 'trading_accounts', 'trading_rules', 'user_preferences', 'users'
  ];
BEGIN
  FOR sequence_record IN
    SELECT DISTINCT sequence_namespace.nspname AS schema_name, sequence_class.relname AS sequence_name
    FROM pg_class sequence_class
    JOIN pg_namespace sequence_namespace ON sequence_namespace.oid = sequence_class.relnamespace
    JOIN pg_depend dependency
      ON dependency.classid = 'pg_class'::regclass
     AND dependency.objid = sequence_class.oid
    JOIN pg_class table_class ON table_class.oid = dependency.refobjid
    JOIN pg_namespace table_namespace ON table_namespace.oid = table_class.relnamespace
    WHERE sequence_class.relkind = 'S'
      AND sequence_namespace.nspname = 'public'
      AND table_namespace.nspname = 'public'
      AND table_class.relname = ANY (protected_table_names)
  LOOP
    EXECUTE format(
      'REVOKE ALL PRIVILEGES ON SEQUENCE %I.%I FROM PUBLIC',
      sequence_record.schema_name,
      sequence_record.sequence_name
    );

    FOREACH api_role IN ARRAY ARRAY['anon', 'authenticated']
    LOOP
      IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = api_role) THEN
        EXECUTE format(
          'REVOKE ALL PRIVILEGES ON SEQUENCE %I.%I FROM %I',
          sequence_record.schema_name,
          sequence_record.sequence_name,
          api_role
        );
      END IF;
    END LOOP;
  END LOOP;
END;
$revoke_application_sequence_privileges$;

-- Supabase installs permissive defaults for objects created by postgres and
-- supabase_admin. Harden every applicable creator role without making local
-- installations fail when a Supabase role is absent or cannot be assumed.
DO $harden_public_default_privileges$
DECLARE
  api_role text;
  creator_role text;
BEGIN
  FOR creator_role IN
    SELECT DISTINCT role_name
    FROM unnest(ARRAY[current_user::text, 'postgres', 'supabase_admin']) AS roles(role_name)
  LOOP
    IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = creator_role) THEN
      CONTINUE;
    END IF;

    IF creator_role <> current_user
      AND NOT pg_has_role(current_user, creator_role, 'MEMBER') THEN
      RAISE NOTICE
        'Skipping default-privilege hardening for role %: migration role % cannot assume it.',
        creator_role,
        current_user;
      CONTINUE;
    END IF;

    EXECUTE format(
      'ALTER DEFAULT PRIVILEGES FOR ROLE %I IN SCHEMA public REVOKE ALL PRIVILEGES ON TABLES FROM PUBLIC',
      creator_role
    );
    EXECUTE format(
      'ALTER DEFAULT PRIVILEGES FOR ROLE %I IN SCHEMA public REVOKE ALL PRIVILEGES ON SEQUENCES FROM PUBLIC',
      creator_role
    );
    EXECUTE format(
      'ALTER DEFAULT PRIVILEGES FOR ROLE %I IN SCHEMA public REVOKE EXECUTE ON FUNCTIONS FROM PUBLIC',
      creator_role
    );

    FOREACH api_role IN ARRAY ARRAY['anon', 'authenticated']
    LOOP
      IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = api_role) THEN
        EXECUTE format(
          'ALTER DEFAULT PRIVILEGES FOR ROLE %I IN SCHEMA public REVOKE ALL PRIVILEGES ON TABLES FROM %I',
          creator_role,
          api_role
        );
        EXECUTE format(
          'ALTER DEFAULT PRIVILEGES FOR ROLE %I IN SCHEMA public REVOKE ALL PRIVILEGES ON SEQUENCES FROM %I',
          creator_role,
          api_role
        );
        EXECUTE format(
          'ALTER DEFAULT PRIVILEGES FOR ROLE %I IN SCHEMA public REVOKE EXECUTE ON FUNCTIONS FROM %I',
          creator_role,
          api_role
        );
      END IF;
    END LOOP;
  END LOOP;
END;
$harden_public_default_privileges$;

COMMIT;
