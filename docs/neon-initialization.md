# PostgreSQL connection and initialization operations

TJ-02 implementation, 2026-09-12. This is a reviewed-operation guide, not
authorization to provision or launch. Cloud initialization belongs to TJ-03;
production configuration, signing-secret rotation and deployment belong to TJ-05.
The [migration plan](neon-migration-plan.md) retains the accepted fresh start,
destination proposal and Neon-only recovery requirements.

## Connection contract

Use [server/.env.example](../server/.env.example) for intentional loopback
development. The API, services and operator scripts retain `pg` and the shared
pool; installed/locked pg is 8.19.0. DATE OID 1082 remains a calendar string.
Transactions still use a checked-out client. Migrations use a separate direct
`pg.Client` and never fall back to runtime `DATABASE_URL`.

| Setting | Contract |
| --- | --- |
| `DATABASE_URL` | Explicit PostgreSQL host, user and database; remote password required, percent-encode reserved characters. Server-only. |
| `MIGRATION_DATABASE_URL` | Separate, explicit direct operator endpoint, never the Neon `-pooler` endpoint. No runtime fallback. |
| `DATABASE_SSL_MODE`, `MIGRATION_DATABASE_SSL_MODE` | Default `verify-full`: validate trusted certificate chain and the configured hostname; minimum TLS 1.2. `disable` is allowed only for localhost/127.0.0.1/::1 outside production. |
| `DATABASE_SSL_CA_FILE`, `MIGRATION_DATABASE_SSL_CA_FILE` | Optional trusted PEM bundle for a private CA. Omit for normal publicly trusted Neon certificates. Never disable validation to resolve trust failure. |
| URL query parameters | Only one optional `sslmode` is accepted, matching the explicit mode. Other parameters, including `sslrootcert`, `sslcert`, `ssl`, `options`, and `channel_binding`, fail validation. Copy provider URLs without query parameters and use the settings here. |
| `DATABASE_ROLE` | Optional explicit effective runtime role, passed as a PostgreSQL startup option on every connection. Set `tj_owner` for the intended Neon model. Omission uses the login role and requires separately verified compatibility. |
| `MIGRATION_DATABASE_ROLE` | Required effective owner, selected with `SET ROLE` before bootstrap/DDL. Lowercase PostgreSQL identifier, at most 63 characters. |
| Pool and timeouts | Per-process max 10 (configurable 1–50), idle 30s, connect 8s, runtime statement 30s, idle transaction 30s. Migration statement 120s (configurable up to one hour), lock wait 5s. All exposed timeout settings require positive bounded integers. |

Configuration is parsed once into explicit driver properties: `pg` never receives
a connection string whose SSL options could overwrite verification. Passwords do
not fall back to inherited `PGPASSWORD` or `.pgpass`. Driver channel binding is
enabled where the server supports it. Configuration errors name settings, not
their values; database failures report safe codes. API startup validates syntax,
but listening or `/health` alone does not prove database connectivity.

Start with direct runtime connections. TJ-03 must verify role startup options,
TLS, actual endpoint identity and session behavior on Neon. Transaction pooling
is not qualified by the local tests; do not switch to it without testing role,
search-path, transaction and session behavior. Budget pools across all API
replicas, rollout overlap and operators; measure timeouts against imports and
Neon cold starts before production.

The explicit handling follows [node-postgres SSL guidance](https://node-postgres.com/features/ssl).

## Role and empty-database bootstrap

Use a dedicated database and application owner. Proposed names are `tj_owner`
(NOLOGIN), `tj_migrator` and `tj_backend` (separate server/operator logins,
NOINHERIT). Both logins must be allowed to SET ROLE to `tj_owner`; only the
operator receives migration credentials. Inspect actual Neon role attributes
and memberships rather than assuming provider-created roles are least privilege.

The following is a bootstrap template for a separately authorized operator,
**not an automatic script**. Review existing objects and substitute the explicitly
identified database/roles. Set login passwords through a secure operator channel,
never in a committed SQL file or chat. `CREATE DATABASE` runs outside a transaction.

```sql
CREATE ROLE tj_owner NOLOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOBYPASSRLS;
CREATE ROLE tj_migrator LOGIN NOINHERIT NOSUPERUSER NOCREATEDB NOCREATEROLE NOBYPASSRLS;
CREATE ROLE tj_backend LOGIN NOINHERIT NOSUPERUSER NOCREATEDB NOCREATEROLE NOBYPASSRLS;
GRANT tj_owner TO tj_migrator, tj_backend WITH INHERIT FALSE, SET TRUE;
CREATE DATABASE trading_journal OWNER tj_owner;
REVOKE CONNECT, TEMPORARY ON DATABASE trading_journal FROM PUBLIC;
GRANT CONNECT ON DATABASE trading_journal TO tj_migrator, tj_backend;
-- Reconnect explicitly to trading_journal before schema operations:
SET ROLE tj_owner;
REVOKE CREATE ON SCHEMA public FROM PUBLIC;
SELECT session_user, current_user, current_database(), current_schema();
SELECT has_schema_privilege(current_user, 'public', 'USAGE'),
       has_schema_privilege(current_user, 'public', 'CREATE');
```

Provisioning privileges, database ownership/public schema ownership, supported
`pgcrypto` installation and exact membership syntax must be checked on Neon in
TJ-03. Do not automatically reassign existing objects or adopt an unrelated
project. Repository migration 001 creates `pgcrypto`; the selected owner needs
the trusted-extension/database privileges to do so, or an operator must install
the verified extension in the intended schema beforehand. Use explicit `public`
search path and the same effective owner for the ledger and every application
object. No provider `anon`/`authenticated` roles need to be created.

Migration 017 enables policy-free RLS without FORCE. The backend intentionally
assumes the application owner and bypasses owner RLS while Express user checks,
user-scoped queries and ownership triggers enforce tenant isolation. **This is a
trusted backend with DDL rights over its own objects, not database-enforced
per-user isolation or a read/write-only login.** Table grants alone do not make a
non-owner compatible: local tests grant SELECT to an untrusted role and observe
zero user rows. Do not disable RLS, add permissive policies, or grant blanket
BYPASSRLS to solve access failures. A future restricted runtime design requires
an explicit security design and tests of all application paths.

## Run and inspect migrations

1. Identify the exact reviewed code revision, endpoint, database, operator login
   and effective role. Verify the target is empty and disposable for validation;
   production must be independently empty and contain no rehearsal fixtures.
2. Set secret environment values through the operator's existing authenticated
   tooling. Copy the example locally if needed; do not print environment dumps.
   Run `npm run migrate` from the repository root. Never use `seed` or `seed:demo`
   as part of production initialization.
3. The runner takes a database-scoped session advisory lock and fails fast if
   another runner holds it. It verifies role/schema/extension assumptions and
   existing table ownership, creates `schema_migrations` before 017, and sets
   creator defaults. Existing application tables without meaningful history
   require inspection; they are not silently adopted.
4. Historical SQL 001–017 remains unchanged. A lexer preserves quoted text and
   PL/pgSQL bodies, removes only a single outer BEGIN/COMMIT pair, and rejects
   additional top-level transaction control. Each file's statements **and ledger
   insert** run in one runner-owned transaction. Unsupported nontransactional
   future DDL requires a separate reviewed mechanism; never bypass the runner.
5. New records contain a CRLF-normalized SHA-256 checksum. Applied filenames
   must be an ordered prefix with matching available checksums. Legacy ledger
   rows gain a nullable checksum column without changing filenames or timestamps;
   missing old checksums are reported, not fabricated proof of historical bytes.
   No source ledger is restored for the accepted fresh start.
6. On a failure, stop and inspect the safe error code, filename and ledger using
   an authenticated direct connection. Disconnection before commit rolls back
   that transaction and releases its lock. If commit acknowledgement is lost,
   outcome is uncertain until a new connection reads the ledger: atomic DDL and
   recording allow a rerun to skip a committed file. Never delete/edit history,
   replay raw files blindly, or claim success because the connection closed.
7. Migration 018 validates both migration-008 trade constraints. Migration 019
   removes PUBLIC and conditional provider-role grants from the effective
   creator's global and per-public-schema defaults. Global function EXECUTE is
   revoked before 001 as well; per-schema revocation alone cannot override a
   global grant. Existing function/table access is handled by 017 and verified
   separately; defaults do not retroactively secure existing objects.

Serialization uses [PostgreSQL advisory locking](https://www.postgresql.org/docs/18/explicit-locking.html).
Default privilege handling follows [PostgreSQL's additive global/schema rules](https://www.postgresql.org/docs/18/sql-alterdefaultprivileges.html).

Expected fresh result: 20 public tables including the ledger, 19 empty business
tables, 19 migration records with actual timestamps/checksums, `pgcrypto`, 13
protected application trigger functions, and both named trade constraints with
`convalidated=true`. Compare the exact file list rather than hard-code 19 forever.
Inspect constraints, indexes, trigger definitions, owners, RLS/FORCE/policies,
role memberships, schema/database privileges and effective default privileges.
Use `assertPublicSchemaSecurity` in [securityCatalog.js](../server/src/db/securityCatalog.js)
as one check, plus positive backend/negative untrusted-role probes. It checks
global and per-schema defaults for current/table-owning creators; separately
inventory any additional role allowed to create objects. Local checks do not
establish a live Neon catalog or future recovery capability.

## Authentication and launch signing configuration

Signup still creates a user and hashed refresh session atomically, without an
arbitrary account or demo data. The registered user explicitly creates the first
account. Migration 003's backfill is historical, not a signup hook. JWT signing,
bcrypt verification, refresh rotation and logout remain application-owned.

Protected requests verify the signed subject and current user existence before
entering a handler. Missing users and definitive invalid tokens/sessions return
401 and expire the refresh cookie. Expired access tokens can refresh once; normal
network/database/5xx failures do not invalidate sessions. The client shares one
refresh request, cancels it on session changes, clears token/user/query state on
definitive failure and rejects responses from previous session generations.
Query cancellation precedes cache clearing. Profile/startup/authentication results
also check their session generation before restoring a user.

For TJ-05 launch, the owner generates a new strong signing secret in the approved
secret store and changes server `JWT_SECRET` across all API replicas in the same
reviewed launch. Do not log the value or expose it as `VITE_*`. Stop old replicas
before accepting traffic; use the fresh database without imported sessions.
Verify new registration/login/refresh/logout and a synthetic old-token rejection.
No signing secret was rotated in TJ-02. Preserve the new signing configuration
for compatible application rollback; explicit incident rotation is a separate
decision. Recovery must not silently resurrect revoked refresh sessions or lose
new Neon records. Supabase remains unavailable as a fallback.

## Focused validation and downstream gates

The tests in [neon.integration.test.js](../server/src/db/neon.integration.test.js)
accept only a separately supplied loopback `TJ_TEST_DATABASE_URL` whose database
is `tj02_main`, plus `TJ_TEST_ALLOW_WRITE=tj02-disposable`. They never choose a
target from `DATABASE_URL`. The operator must create this disposable local admin
database explicitly; tests create uniquely named databases/roles and remove only
those objects. TLS tests additionally need `TJ_TEST_CA_FILE` and a local server
certificate valid for localhost, not its IP. Fixtures and signing keys are
synthetic. Never supply a cloud URL to these tests.

```powershell
# Set TJ_TEST_DATABASE_URL/TJ_TEST_CA_FILE to the explicitly created local test
# target and certificate first. Do not copy an inherited production URL.
$env:TJ_TEST_ALLOW_WRITE = 'tj02-disposable'
node --test server/src/db/config.test.js server/src/db/migrationRunner.test.js server/src/db/securityCatalog.test.js server/src/services/authService.test.js server/src/middleware/auth.test.js server/src/db/neon.integration.test.js
npm test --prefix client -- --run src/api/client.test.js src/context/AuthContext.test.jsx
```

Cloud provisioning is still TJ-03: verify Oregon/PG18 against current Railway
placement, actual Neon IDs/minor version/extension support, SET ROLE and direct
endpoint/TLS behavior, catalog security and independent fresh initialization.
TJ-04 covers comprehensive two-user workflows, deterministic financial fixtures,
imports, valuation fallback and Hebrew/date/time behavior. Retention, sizing,
launch timing and accepted operational recovery commitments belong to their
downstream gates. They do not undo the owner's accepted TJ-01 technical plan.
