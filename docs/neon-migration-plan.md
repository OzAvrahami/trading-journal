# Neon fresh database initialization plan — TJ-01

Revised on 2026-09-10 for [TJ-01 / #1](https://github.com/OzAvrahami/trading-journal/issues/1).
Baseline: [v1.0.0](https://github.com/OzAvrahami/trading-journal/releases/tag/v1.0.0),
`9434cda9b8b225b6615e31bad379c3de63d4ea4e`. Target:
[v1.1.0 — Neon Migration](https://github.com/OzAvrahami/trading-journal/milestone/1).

## Accepted decision and scope

**Accepted owner decision:** Supabase is inactive and the owner cannot reactivate
it. Initialize Neon from an empty database. Discard all historical Supabase
application data, including users, sessions, accounts, trades, journals, reviews,
rules and investment records. Do not import old identities or sessions. This
decision requires no further confirmation and does not authorize deletion of
either provider's resources.

Source access, CA certificates, catalog inspection, source backups, transfer,
source/destination row-count comparisons and restoration of source migration
history are **superseded**, not failed acceptance gates to complete. Supabase is
not a recovery target. Earlier audit observations remain historical evidence in
the appendix; they do not establish present source availability.

The permission to discard old Supabase data does **not** extend to any new Neon
records, including owner verification records created before general launch.
Recovery must preserve those records. The application-owned JWT architecture,
financial semantics and access boundaries remain in scope.

The 2026-09-10 scope revision changed documentation and planning metadata only;
no application code, database, production or Git publication operations occurred
in that earlier pass. The separately authorized TJ-02 work below supersedes its
implementation boundary, while cloud and production remain unchanged. Packages/lockfiles remain `1.0.0`. Pending local release-document
changes are preserved. See [backlog](neon-migration-backlog.md) and
[development standard](github-development-standard.md).

## Owner technical acceptance and TJ-02 implementation - 2026-09-12

The owner explicitly accepted the technical plan and authorized TJ-02 connections,
unused dependency removal, fresh initialization/forward security improvements,
and stale-session handling. TJ-01 is completed and closed, Project Done. This
acceptance is separate from future resource sizing, retention, launch timing,
operator assignment and operational recovery commitments; those remain at the
TJ-03 through TJ-06 gates and do not block this authorized code work.

TJ-02 is prepared locally for review against base
`9434cda9b8b225b6615e31bad379c3de63d4ea4e`; its final implementation commit SHA is
pending owner review/commit. See the current [initialization operations guide](neon-initialization.md)
for the exact configuration/role contract, runner behavior, forward migrations,
launch signing-secret instructions and verification commands. Installed/locked
`pg` is 8.19.0. A renewed import/caller search found no direct or indirect callers
of the Supabase wrapper; it and the SDK/exclusive dependencies are removed.

Focused local PostgreSQL 18.6 tests exercised the complete 001-019 chain under
an explicit non-superuser owner with NOINHERIT operator/backend logins, independent
empty initialization, unchanged ledger timestamps on rerun, nullable legacy
checksums, concurrency rejection, interrupted rollback and lost-commit-acknowledgement
reconciliation. They verified 018 constraints, effective 017 RLS/access controls,
019 global defaults, trusted TLS and rejection of untrusted/wrong-host certificates,
and real signup/first-account/login/refresh/logout/nonexistent-user rejection.
The focused server run passed 29 tests; one optional standalone catalog test was
skipped because the disposable integration suite performs its own catalog checks.
Client session/refresh/cache race checks passed 11 tests across two files. The
client production build passed (Browserslist-age and bundle-size warnings).
UTF-8, whitespace and local links passed; SQL 001–017 and pending release baseline/
notes corrections were byte-for-byte unchanged. The server lockfile removed only
nine Supabase/exclusive packages, with no retained package upgrades.

Only synthetic data on an explicitly identified loopback Docker PostgreSQL was
used; no inherited production database URL selected a test target. Docker's WSL
engine exited during a follow-up run, causing a connection timeout before any
integration subtest. After restarting the local engine, the full focused run
passed. This is local compatibility evidence, not authenticated production or
Neon verification. The earlier governance/audit limits below remain historical.
No cloud resources, production settings, signing secrets or package versions were
changed. TJ-03 through TJ-06 remain Backlog; TJ-02 is open for review in Verify.

## Destination and connection design

Propose a dedicated Neon project **`trading-journal`** in existing organization
`org-lively-cherry-67205699` (Oz). Reuse the already authenticated Neon CLI OAuth;
do not create replacement credentials or reuse `projectdeck`/`cockpitpath`.
Names below are planned, not provisioned IDs:

| Setting | Selected proposal and remaining verification |
| --- | --- |
| Region | AWS Oregon, `aws-us-west-2`, based on the last Railway API placement `us-west2`. Recheck deployment placement and measure application-to-database latency before launch; provider region names alone do not prove physical colocation. Residency constraints, if any, remain an owner decision. |
| PostgreSQL | **18**, based on reviewed PostgreSQL/PLpgSQL migrations, node-postgres and supported `pgcrypto`, not the unavailable source version. Full initialization and application compatibility must pass in isolation before production. Record actual server minor version. |
| Production | Branch `production`, database `trading_journal`, created empty and initialized independently; never clone a fixture-bearing validation branch into production. |
| Validation | Branch `validation`, separate endpoint/credentials and restricted test API. Branch from an empty project parent before any data is written, then initialize independently; verify emptiness rather than assume branch creation means empty. A second empty validation database proves repeatability. |
| Roles | Proposed `tj_owner` (application object owner), `tj_migrator` (controlled operator login able to assume owner), `tj_backend` (server-only login explicitly assuming the owner role). Record real IDs, attributes, membership options and effective privileges later. |
| Runtime | Start with direct verified-TLS Neon connections and bounded `pg.Pool`; retain maximum 10 per API process pending measurements. Budget maximum replicas plus deployment overlap/operator headroom against the selected compute limits. |
| Migration connection | Separate direct operator connection, verified TLS, explicit database and owner/search path; never rely on pooled runtime session settings for DDL. |

Neon lists Oregon under `aws-us-west-2`; PostgreSQL 18 is generally available,
and Neon documents `pgcrypto` support on 18. These support the proposal, not a
claim of application compatibility on Neon; local PG18 tests are recorded above.
[Regions](https://neon.com/docs/introduction/regions),
[PostgreSQL 18 availability](https://neon.com/docs/changelog/2026-05-01),
[extension support](https://neon.com/docs/changelog/2025-10-31).

The prior audit found CLI `3.6.0` with existing local OAuth at
`C:\Users\ozavr\.config\neon\credentials.json`; do not display that file.
Local PostgreSQL tools are 18.6; only version checks were previously run. Use
them for later Neon recovery only after matching tool/server compatibility;
initialization uses the repository's Node migration runner, not `pg_restore`.
Compute size, backup retention, actual destination IDs and named operator/reviewer
remain to be recorded. None depends on accessing Supabase.

The baseline pool inferred TLS from a provider hostname and lacked statement/
idle-transaction limits. TJ-02 replaces it with [config.js](../server/src/db/config.js):
remote certificate/hostname verification, explicit loopback plaintext opt-in,
validated SSL URL interactions, bounded pool/timeouts, public search path and
explicit role selection. Migrations now use a separate direct connection. Current
settings and their local tests are in the [operations guide](neon-initialization.md).
Measure cold starts, import duration, concurrency and reconnect behavior on Neon.
Transaction pooling and its startup-role/session behavior remain unqualified;
start direct and retain direct migrations. No baseline LISTEN/NOTIFY or session
lock dependency was found; the new migration runner deliberately uses a direct
session advisory lock. [Neon pooling](https://neon.com/docs/connect/connection-pooling).

## Empty-database migration and bootstrap review

All 17 historical SQL files were statically reviewed on 2026-09-10 and were not
executed in that audit. The table retains those baseline findings. TJ-02 subsequently
executed the preserved files plus 018/019 on disposable local PostgreSQL 18.6;
actual Neon initialization/catalog verification remains TJ-03.

| Migration(s) | Empty-database finding / requirement |
| --- | --- |
| [Baseline runner](https://github.com/OzAvrahami/trading-journal/blob/9434cda9b8b225b6615e31bad379c3de63d4ea4e/server/src/db/migrate.js) | Creates `schema_migrations` before executing SQL alphabetically; records each successful file. Running just SQL 001–017 manually omits that bootstrap table and 017 will reference a missing relation. Use the reviewed runner or an explicitly equivalent ledger bootstrap. |
| [001](../server/src/db/migrations/001_init.sql):2,7–100 | Requires `pgcrypto`, public schema CREATE/USAGE, PL/pgSQL, UUID generation; creates users, refresh tokens, trades and the shared `update_updated_at_column()` trigger function. No seeded administrator/user or Supabase Auth schema dependency. Install/verify the supported extension through the operator role; do not assume backend credentials can install it. |
| [002](../server/src/db/migrations/002_add_dedup_key.sql), [003](../server/src/db/migrations/003_trading_accounts.sql):41–61, [004](../server/src/db/migrations/004_fix_dedup_scope.sql) | Dedup index evolves from user to account scope. 003 backfills accounts for users present **at migration time**; with no users it inserts nothing, then sets trade `account_id` NOT NULL. This is not ongoing default-account provisioning for later signup. |
| [005](../server/src/db/migrations/005_journal_entries.sql), [006](../server/src/db/migrations/006_rules_adherence.sql), [007](../server/src/db/migrations/007_goals.sql) | Journal, link, rule/check and goal tables depend on users/trades and the function from 001. Context/ownership trigger functions are ordinary PL/pgSQL; no external bootstrap rows required. |
| [008](../server/src/db/migrations/008_trading_integrity_gate.sql):42–79 | `trades_exit_fields_consistent` and `trades_exit_datetime_not_before_entry` are deliberately created NOT VALID. They enforce new writes but catalog validation remains false. TJ-02 must provide a reviewed forward validation step for the fresh schema; TJ-03 must observe both `convalidated=true`, not label file execution a validation test. |
| [009](../server/src/db/migrations/009_user_timezone.sql), [010](../server/src/db/migrations/010_daily_review_details.sql), [011](../server/src/db/migrations/011_strategies_setups.sql), [012](../server/src/db/migrations/012_accounts_expansion.sql) | Adds Jerusalem timezone default, daily-review details, strategies/setups and account metadata. Shared trigger functions and preceding tables must exist. Partial unique indexes constrain defaults/names; they do not create default data. |
| [013](../server/src/db/migrations/013_import_history.sql), [014](../server/src/db/migrations/014_user_preferences.sql) | Import run/row ownership and successful-file uniqueness; user preferences depend on users and updated-at function. No imported history or preference rows are required for initialization. |
| [015](../server/src/db/migrations/015_portfolio_foundation.sql), [016](../server/src/db/migrations/016_unified_accounts_investments.sql) | Create investment portfolios/instruments/transactions/prices and optional account links. 016 replaces a transaction-context function from 015; retain order and the final definition. No portfolio/instrument catalog seed is present or required by migrations. |
| [017](../server/src/db/migrations/017_secure_public_data_api.sql):7–26,80–123,178–235 | Requires all 20 application/ledger tables and all 13 named trigger functions. Enables RLS without FORCE, revokes PUBLIC/conditional API rights and adjusts defaults. `anon`, `authenticated`, `postgres` and `supabase_admin` are conditional references, not required Neon roles. Review creator-role and default-privilege issues below. |

Expected baseline: 20 tables including the ledger, 13 application trigger
functions, UUID IDs and no application sequences in this chain. Extension-owned
functions are separate. Build the final schema manifest from the reviewed chain
plus any new forward migrations; verify actual tables, columns/types, PK/FK/CHECK
constraints, valid indexes, enabled triggers, function signatures/definitions,
extensions and sequences in TJ-03. Initially all **19 business tables** must be
empty, with ledger rows reflecting the files actually applied; no fabricated
timestamps or restored history. Future portability migrations can make the ledger
count greater than 17, so compare against the exact approved file list.

The baseline runner skipped filenames without checksums/serialization and recorded
SQL separately from the ledger. TJ-02 replaces that behavior with a direct session
lock, explicit effective owner/search path, ledger bootstrap and atomic per-file
DDL/ledger transactions. Historical outer transaction wrappers are parsed rather
than nested. Checksums protect new records; legacy timestamps/history remain
unchanged and unavailable old checksums are reported honestly. Actual local
interruption, concurrency, rerun and independent-initialization tests passed.
TJ-03 must repeat the relevant checks on Neon. Never delete ledger entries to
manufacture success or replay raw SQL after an uncertain commit; inspect the
ledger first. After launch, only reviewed forward repair may affect new data.

Preserve historical migration files. Put corrections in new forward migrations
or a versioned bootstrap/runner step in TJ-02, with focused tests. No historical
Supabase migration ledger will be read, imported or rewritten. API startup
([index.js](../server/index.js)) does not run migrations. The `seed` script points
to a missing file; `seed:demo` is a separate data/reset tool. Neither belongs in
fresh production initialization.

## Security bootstrap and explicit verification

017's comments establish a trusted backend-owner/BYPASSRLS boundary. It enables
RLS without FORCE or end-user policies; API JWT checks, user-scoped queries and
ownership triggers supply tenant isolation. An ordinary non-owner with grants
alone may be denied by RLS. Preserve this boundary deliberately; do not disable
RLS or add permissive policies to make the application work.

Implement `tj_owner` as the intended dedicated NOLOGIN application owner;
`tj_migrator` assumes it for DDL/ledger creation and `tj_backend` explicitly
assumes it via connection startup options. Use NOINHERIT logins with SET membership.
The roles themselves are not provisioned on Neon by TJ-02. This intentionally grants strong rights over this application's objects,
not a claim of database-enforced per-user isolation or minimal DDL privilege.
Locally tested SET ROLE works with NOINHERIT logins; verify the same on Neon. Do not substitute
`neon_superuser` or blanket BYPASSRLS merely for convenience. Inspect actual
Neon-created role attributes and memberships. Restrict database CONNECT and public
schema CREATE to approved roles; use an explicit `public` search path for the
many unqualified SQL names and prevent untrusted object creation there.

Execute the ledger bootstrap and migrations as the **same effective creator**;
inheriting a role does not apply that role's default privileges at object creation.
The operator must confirm `session_user`, `current_user`, ownership and schema
privileges before running. Do not create Supabase provider roles just to satisfy
conditional revocations. The existing `pgcrypto` extension must remain usable,
while protected application trigger functions must not acquire public execution.

Implemented TJ-02 security work (bootstrap plus new 019): 017's `IN SCHEMA public REVOKE EXECUTE` does not
cancel PostgreSQL's global default PUBLIC EXECUTE. Set an explicit global default
revoke for dedicated object creators, remove per-schema grants that reintroduce
it, and verify current functions separately. Apply this as a reviewed bootstrap
policy and/or new forward migration, not an edit to 017. Avoid changing shared
provider roles' global defaults. [PostgreSQL default privileges](https://www.postgresql.org/docs/18/sql-alterdefaultprivileges.html).

TJ-03 must record, independently of the ledger:

- Owners and role attributes/memberships; required CONNECT/USAGE/object rights;
  schema CREATE restrictions and no accidental broad administrative runtime role.
- RLS enabled on all 20 baseline tables, FORCE flags and policies consistent with
  the approved boundary; no unintended PUBLIC/low-privilege table or sequence
  access; all 13 protected functions checked for effective EXECUTE privileges.
- Both global and per-schema defaults for every allowed creator. Create
  disposable objects in the isolated environment as each creator and prove
  negative access; remove only those validation objects under that later task.
- Positive backend operations and negative low-privilege operations, plus two-user
  API ownership tests in TJ-04. Reuse [securityCatalog.js](../server/src/db/securityCatalog.js)
  as a starting point, extending checks for global defaults, creator roles and
  constraints as required; a ledger row or checker subset is insufficient.

These controls were tested on disposable local PostgreSQL in TJ-02; none of the
Neon catalog/security/initialization behavior above is verified yet. The old
`--no-owner` / `--no-acl` transfer concern is superseded for initialization because
there is no restore. Retain ownership/ACL manifests for **future Neon recovery**;
any later restore that omits them must re-establish and verify security explicitly.

## Authentication, onboarding and deterministic validation

[authService.js](../server/src/services/authService.js):10–33,68–146 uses bcrypt,
application JWTs and hashed refresh sessions in public tables. Signup inserts only
the user and refresh session in a transaction. Keep this architecture; no Neon
Auth or Supabase Auth import. First use must register a new user and create the
first account through the application; test zero-account/zero-portfolio states,
required account selection, empty reports and null/zero metrics without errors.
No old user IDs, password hashes, sessions, asset URLs or financial rows are loaded.

The baseline middleware verified JWT signatures without checking whether the user
still existed. TJ-02 now checks the signed subject and database user before any
protected handler. Invalid tokens/nonexistent users and invalid refresh sessions
expire the refresh cookie. Expired access tokens retain the refresh path; network,
database and 5xx failures do not prove invalid authentication. The client clears
user/token/query state on definitive failure, cancels queries/refresh and rejects
old-generation responses so prior users cannot repopulate state. Focused server
HTTP and client race tests passed locally. Comprehensive browser/Neon workflows
remain TJ-04.

Plan an owner-controlled **JWT signing-secret rotation at launch** following the
[operations guide](neon-initialization.md). Keep the application JWT mechanism and
do not import old users/sessions. No production secret is generated or changed by
TJ-02. After launch, preserve the new signing configuration through compatible
recovery unless deliberate incident response requires rotation. Restored revoked
refresh sessions must never silently become valid.

TJ-04 uses deterministic fixtures with independently specified expected outputs,
fixed IDs/dates/prices where appropriate and two separate test users. Examples:

| Fixture | Expected result / gate |
| --- | --- |
| Long trade: entry 100, exit 110, quantity 2, fee 1, risk 10; timestamps 60 minutes apart | Gross 20, net 19, R 1.9, duration 60; short 110 to 100 produces the same values. Open trade has null closed PnL, not an invented zero. [Calculation contract](../shared/utils/calculations.js). |
| Account opening balance 1000 and the closed trade above | Tracked trade balance 1019 under the account calculation contract; no inclusion of another user's/account's records. Separate currencies. |
| USD investment deposit 1000, buy 2 at 100 without fees, manual price 110 | Cash 800, quantity 2, cost basis 200, market value 220, unrealized gain 20, total value 1020. Extend with ordered sell/dividend/fee/withdrawal fixtures and independently reviewed expectations. |
| Empty database and new signup | Only expected registration rows; zero accounts/trades/investment records until explicit user action. Preferences, dashboards and empty analytics render coherently. |

These are planned assertions, not test results. Cover trading CRUD/exports,
supported importers and partial fills, duplicate file/trade protection,
transaction rollback, journal/review/rule links, goals/strategies/setups,
investment chronological replay and invalid ownership/currency cases. Validate
DATE strings, TIMESTAMPTZ instants and NUMERIC precision; Jerusalem and another
timezone, DST/midnight/week/month/year boundaries, English/Hebrew and RTL.
Keep quote time and prices fixed for expected financial checks. Exercise manual,
missing, stale and live-quote eligibility/failure paths separately. Actual changing
market prices cannot serve as an oracle; provider availability is separate from
database correctness. Record expected/actual outputs, tolerances at stored/display
precision, branch, role, code SHA and actual failures. This fixture matrix remains a TJ-04 gate; TJ-02 runs focused changed-behavior tests only.

## Execution sequence and launch gates

| Issue | Work and handoff |
| --- | --- |
| [TJ-01 / #1](https://github.com/OzAvrahami/trading-journal/issues/1) | Retain dependency audit, record accepted reset and static bootstrap review; resolve only destination/role/operational implementation choices. Owner technically accepted on 2026-09-12; closed and Done. No repeat approval of historical data loss. |
| [TJ-02 / #2](https://github.com/OzAvrahami/trading-journal/issues/2) | Adapt connections/TLS and direct migration role selection, remove SDK only after renewed caller proof, implement necessary forward portability/default-privilege/008 validation steps, runner safeguards and stale-session handling. Focused tests and secret-free examples; no production switch. |
| [TJ-03 / #3](https://github.com/OzAvrahami/trading-journal/issues/3) | In a later authorized task, provision the explicit isolated destination, initialize from empty with reviewed migrations, inspect schema/ledger/security, and prove repeatability on another empty validation database plus ledger-preserving rerun. No source archive/history and no production fixtures. |
| [TJ-04 / #4](https://github.com/OzAvrahami/trading-journal/issues/4) | Exercise deterministic fixtures, empty/new-user states, stale sessions, negative isolation, financial/date/UI behavior; record actual results. Blocking failures must be resolved before launch. |
| [TJ-05 / #5](https://github.com/OzAvrahami/trading-journal/issues/5) | Independently initialize and verify fresh production using the same reviewed revision, with all 19 business tables empty before owner onboarding. No clone/restore of fixture data. Owner performs reviewed configuration/deployment and verifies the working application. |
| [TJ-06 / #6](https://github.com/OzAvrahami/trading-journal/issues/6) | Stabilize, verify Neon backup/recovery, reconcile obsolete configuration without automatic deletion, prepare changelog/release notes and only then deliberate version bump and owner publication. |

At production launch, verify branch/database/roles, actual server/extension
versions, ledger and security again; a validation pass is not production evidence.
Quiesce old API replicas, deployment triggers, import commits and local/admin
processes so they cannot restart with old configuration or write to the wrong
Neon environment. Recheck the historical one-replica/no-cron observation. Inventory
the writers being enabled for Neon: API auth/CRUD/imports, operator scripts,
future jobs and integrations. There is no source-write freeze or source-service
discovery prerequisite; unknown old integrations must not receive Neon credentials.
Disable demo-seed execution for production; memory-only quote/parse cleanup is not
a database job. Confirm direct API access is controlled, not only the frontend.

The operator records the exact reviewed code SHA, production IDs, migration and
security results, verified TLS and Railway deployment IDs. Start under restricted
traffic, rotate JWT configuration as reviewed, and verify genuine new-user
registration, account setup and database-backed reads. `/health` alone is not
database validation. Production begins fixture-free; owner-created verification
records thereafter are new protected data. Record first-write and public-traffic
release times; obtain owner application acceptance before general launch.

Before enabling writes, assign backup/recovery responsibility, select actual Neon
retention and demonstrate a recovery exercise with validation fixtures. Launch
no-go: schema/security failure, stale-session or isolation defect, unexplained
financial assertion failure, production fixtures, incompatible code/schema,
uncontrolled enabled writers, missing recovery coverage or unresolved high-severity
failure. Missing Supabase evidence is not a no-go condition.

## Recovery entirely within Neon

Supabase cannot be used for fallback, reverse transfer or recovery. Before any
new records exist, a failed launch can remain in maintenance while the operator
repairs/reinitializes only an explicitly verified empty Neon target under separate
execution authorization. Do not claim the old Supabase-configured deployment is
a working fallback.

After the first new write, never reset/reinitialize production, switch to an empty
branch, or restore an older snapshot in place without preserving intervening data.
Prefer application rollback to a **verified Neon-compatible** build using the same
database and compatible schema/JWT configuration. Baseline v1.0.0's connection
configuration is not automatically such a build. If none is compatible, remain
in maintenance and roll forward rather than point back to Supabase.

For database recovery, stop all Neon writers, preserve current state and logs,
and restore a Neon recovery point or logical archive into a separate identified
recovery branch/database. Inspect ownership/ACL/default privileges/RLS and use
compatible tools. Reconcile all acknowledged writes after the selected point,
including inserts, updates, deletes, financial ledgers, import dedup/history and
refresh rotation/revocation. `updated_at` alone is not a complete change log; no
complete replay/CDC capability has been established. Prefer recovery mechanisms
that retain the newest state; if deltas cannot be reconstructed, stop and escalate
without silently discarding new records. The historical reset acceptance grants
no exception. Keep the original Neon state available until recovery is accepted.

Proposed targets remain **unaccepted and untested**: maintenance/initial recovery
within 60 minutes, post-write recovery within four hours, 48-hour stabilization
observation, and a desired zero-acknowledged-write-loss recovery objective. Do not
promise zero RPO from periodic backups or assumed PITR retention. TJ-03/TJ-04 must
demonstrate available recovery coverage and TJ-05 must record agreed objectives
before launch; TJ-06 verifies ongoing operation. Retention, schedule, secure archive
storage, access and named backup owner remain specific decisions. Any inability
to preserve new acknowledged writes must be surfaced, not treated as permission
to repeat the historical reset.

## Remaining technical decisions and verification limits

The fresh-start decision is accepted. Remaining decisions are the dedicated
project's billing/compute/retention settings, final confirmation of the proposed
Oregon/PG18 deployment after isolated compatibility/latency evidence, operator
and reviewer assignments, live verification of the implemented trusted-backend role, launch window
and measurable recovery commitments. Real resource IDs will be recorded when
provisioning is separately authorized. No source access or historical-data
preservation work remains. TJ-01 is accepted, closed and Done. TJ-02 is implemented
locally and open in Verify; TJ-03 through TJ-06 remain Backlog.

Validation during the 2026-09-10 planning pass was static/documentation/metadata
review only. TJ-02 adds the local integration and client checks above. Live Neon
catalog/security, authenticated production functionality and operational
backup/recovery remain untested; local repeatability does not establish them.
Earlier release-preparation evidence and owner-confirmed Project workflows remain
unchanged, including the manual reopened-to-Ready fallback.

## Historical audit evidence — retained, not current prerequisites

The prior transfer plan was prepared on 2026-09-10 before the accepted reset.
Its backup/transfer/source-comparison/source-recovery gates were superseded by
this revision; none is being marked as a successful test. Source SQL inspection
failed with `SELF_SIGNED_CERT_IN_CHAIN` at `2026-09-10T19:16:39.624Z`, before any
queries. Certificate verification was not disabled; no source catalog or business
rows were collected. That observation is historical, no longer an access blocker.

At audit start, `main` was the baseline SHA, with an empty index and pending
changes to CHANGELOG, development standard, release baseline/notes and an untracked
backlog. No applicable AGENTS.md was found in the repository/ancestry. Those
pending documents, plus the prior untracked migration plan, were preserved by
this revision; only the plan/backlog/standard are revised here.

The prior source-code audit found one `pg.Pool` shared by services, scripts and
migrations; no callers of [baseline getSupabaseClient](https://github.com/OzAvrahami/trading-journal/blob/9434cda9b8b225b6615e31bad379c3de63d4ea4e/server/src/db/supabase.js); memory
uploads/parse sessions rather than Supabase Storage; no application Supabase
Realtime, RPC, Edge Functions, provider-auth or session-lock dependency. The SDK
was still declared at that audit snapshot; TJ-02 renewed the caller check and
removed the unused wrapper and dependency. SQL ownership/context triggers
and application JWT authentication remain relevant. Provider-side capabilities
were unknown; the unavailable old database no longer needs cataloging.

Railway observations were collected on 2026-09-10 beginning at `19:13:11Z` through
existing CLI access with explicit selectors and redacted, allowlisted metadata.
No connection strings, credential dumps or financial records were published.
The following table is retained from that earlier observation and is not a fresh
claim of working production or an active Supabase database:

| Object | Observed identity / finding |
| --- | --- |
| Railway project | `trading-journal`, `33467026-92c3-47f8-a74a-9603dee32671` |
| Environment | `production`, `fe8779c6-1889-4a0a-8842-34bfb472dfe0` |
| API service | `trading-journal-api`, `29cdfe74-c3c9-4180-8090-5b2611c5d9da` |
| Client service | `trading-journal-client`, `c4270688-1473-48cb-8f82-4260e4aded70` |
| Source database endpoint | `aws-1-ap-southeast-1.pooler.supabase.com`, port `5432`, database `postgres` |
| Source project reference | `zckrwmfyezgqbhpewbfw`, inferred from the configured pooler login `postgres.zckrwmfyezgqbhpewbfw`; Dashboard project display name not verified |
| Source SQL role | Configured login above; effective `current_user`, ownership and privileges unknown until SQL verification succeeds |
| API deployment | `99f68f14-4476-4ead-9866-e1b3c5d39ee9`, SUCCESS, one RUNNING instance |
| Client deployment | `1fb07f0a-629e-4692-95bf-45f5a1d83ca5`, SUCCESS, one RUNNING instance |
| Deployed commits | Both report `9434cda9b8b225b6615e31bad379c3de63d4ea4e`; this is fresher metadata than the historical release-preparation snapshot |
| Deployment settings | `/server` and `/client`, `npm start`, one replica each, `us-west2`; no configured cron schedule or pre-deploy command reported |
| API configuration | `DATABASE_URL`, `JWT_SECRET`, `CLIENT_URL`, `NODE_ENV=production`; legacy `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` entries exist; values not published |
| Client configuration | `VITE_API_URL` points to the API service domain; no database or Supabase credential variable names reported |
| Quote provider | No `FINNHUB_API_KEY` entry was returned for the deployed API; successful live quotes are not established |


Existing `neonctl` version `3.6.0` uses local OAuth authentication in
`C:\Users\ozavr\.config\neon\credentials.json`; file contents are not evidence
to publish. No Neon MCP was exposed in the available tool catalog. Authenticated
`neonctl orgs list` found organization `Oz` / `org-lively-cherry-67205699`.
An explicit organization avoids the CLI's interactive selector. At
`2026-09-10T19:22:03Z`, `neonctl projects list --org-id org-lively-cherry-67205699`
returned:

| Visible project | ID | Region | PostgreSQL |
| --- | --- | --- | --- |
| projectdeck | `cool-flower-73804689` | `aws-eu-central-1` | 18 |
| cockpitpath | `blue-pine-69800406` | `aws-eu-central-1` | 18 |

Neither is an authorized Trading Journal destination. No Trading Journal
destination was visible to this account; visibility does not prove none exists
elsewhere. Their databases were not inspected.


The new destination proposal above supersedes the former source-version-dependent
selection. Existing tools/authentication are retained; no resources were created.
