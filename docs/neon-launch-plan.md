# TJ-05 production launch preparation — 2026-09-13

Prepared instructions only. **No production resource, database, configuration,
secret or deployment was changed.** TJ-04's technical/browser tests and owner
application review are accepted. Verification of the final reviewed/pushed fix
commit is still pending. Keep #4 open/Verify and #5/#6 Backlog until that gate is
met; then close #4/Done and move #5/Ready before separately authorized execution.

Use the [initialization guide](neon-initialization.md),
[TJ-04 handoff](validation/tj-04-handoff-2026-09-13.md) and existing
[TJ-05 issue](https://github.com/OzAvrahami/trading-journal/issues/5). The catalogue
[Feature #7](https://github.com/OzAvrahami/trading-journal/issues/7) has no assigned
release or blocking dependency and does not gate this launch.

## Read-only deployment evidence

Authenticated Railway CLI 5.41.2 queried the current API on 2026-09-13 at
18:07 UTC. Project `33467026-92c3-47f8-a74a-9603dee32671` has one environment,
`production` / `fe8779c6-1889-4a0a-8842-34bfb472dfe0`. All environment/trigger/
service pages were exhausted. Actual branch triggers are **main only**:

| Service | Service ID | Root / build / start |
| --- | --- | --- |
| trading-journal-client | `c4270688-1473-48cb-8f82-4260e4aded70` | `/client`; `npm install && npm run build`; `npm start` |
| trading-journal-api | `29cdfe74-c3c9-4180-8090-5b2611c5d9da` | `/server`; `npm install`; `npm start` |

Both triggers refer to `OzAvrahami/trading-journal`, `checkSuites=false`; watch
patterns are empty. `prDeploys`, `botPrEnvironments` and
`focusedPrEnvironments` are false, with no ephemeral environment. A push only to
`chore/tj-02-neon-preparation` does not match these deployment triggers. Pushing
or merging main can deploy both services and is outside the handoff. This is a
configuration observation, not an experimental push or a guarantee after settings
change. Recheck triggers if the publication is delayed or configuration changes.

Latest deployment metadata for both services still reports baseline
`9434cda9b8b225b6615e31bad379c3de63d4ea4e`, SUCCESS and one RUNNING instance.
Client deployment: `1fb07f0a-629e-4692-95bf-45f5a1d83ca5`; API deployment:
`99f68f14-4476-4ead-9866-e1b3c5d39ee9`. Their recorded deployment manifests specify
one replica in `us-west2`; current instance `region`/`numReplicas` overrides are
null, so the manifest is the placement evidence. No measured Railway-to-Neon
latency follows. Cron, pre-deploy command and healthcheck path are unset.

Allowlisted variable inspection found API `NODE_ENV=production`, the expected
HTTPS client origin, `JWT_SECRET` present, and `DATABASE_URL` still referencing
`aws-1-ap-southeast-1.pooler.supabase.com:5432/postgres`. Legacy Supabase settings
remain. `DATABASE_ROLE` and explicit SSL settings are absent; `FINNHUB_API_KEY`
is absent. Client `VITE_API_URL` points to the API HTTPS domain. No credentials
were printed or stored in this evidence. SUCCESS/RUNNING metadata is not a test
of the inactive database or authenticated production behavior.

## Proposed target and protected boundaries

Production must have a **separately initialized, fixture-free database**, created
from the final reviewed repository migrations. Proposed isolation is a dedicated
Neon project named `trading-journal-production`, with a production branch and
database `trading_journal`; these are proposed names, not existing resources.
Recheck organization allowance, region, PostgreSQL support, compute and retention
before provisioning. Oregon/PostgreSQL 18 are compatibility-backed candidates;
the actual project/branch/endpoint/database/role IDs and server version must be
recorded at the TJ-05 gate. Do not claim included allowance or pricing for an
uncreated production configuration.

Do not fork the fixture-bearing validation branch to create production. A Neon
branch fork copies all databases and roles at its point; an empty database inside
that copy does not remove the surrounding validation-data boundary. Use a clean
independent target and the bootstrap guide, not a restore of validation content.

Preserve project `delicate-fire-79141899`, validation branch `br-green-cake-arg1asaf`,
`trading_journal_validation`, `trading_journal_validation_repeat` and recovery child
`br-soft-mountain-aratb02z`. **The owner's newly registered user and accounts are
protected Neon records**, in addition to synthetic fixtures. Do not truncate,
reset, delete, move, or silently copy them into production. They are not disposable
because of the historical Supabase reset decision. No database write or cleanup
is authorized by this preparation. Fresh production onboarding is separate.

## Execution checkpoints for the later authorized operator

Proposed operator: owner OzAvrahami or an explicitly designated operator. Owner
approves launch timing, actual production target, recovery coverage and release
decision. Record the operator, reviewer, timestamp and expected/actual result at
every checkpoint; a failed gate stops progression.

1. **Exact revision and launch control.** Verify the published preparation commit
   matches the reviewed file/blob inventory and unchanged baseline files. Plan
   the eventual main update as a deployment action. Inventory API replicas,
   rollout overlap, operator shells/scripts, cron and integrations; current
   metadata has no cron/pre-deploy task but does not prove no external writers.
   Stop or isolate old API traffic/writers before a connection/signing transition.
   Do not rely on Railway health alone or auto-run migrations on every API start.
2. **Clean target, roles and schema.** Record exact non-validation identities and
   zero application rows before onboarding. Create `tj_owner` NOLOGIN and separate
   NOINHERIT backend/migrator logins with explicit SET membership, using the
   verified guide. Database ACL statements execute **as tj_owner**, then read
   back CONNECT/TEMP/USAGE/CREATE and negative access. Run reviewed migrations
   001–020 using the direct migrator connection; no seed/demo/backfill of users.
   Verify all filenames/checksums/actual times, 20 baseline tables, 19 empty
   business tables, pgcrypto, 13 application trigger functions, validated 018
   constraints and the 020 `(user_id, account_id, file_sha256)` successful-file
   index. Inspect actual 017/019 ownership/default grants/RLS and effective
   positive backend/negative untrusted access. Never edit historical migration
   records or weaken RLS to pass. Confirm the second run skips without ledger
   changes before accepting the initialization result.
3. **Connection/configuration readiness.** API uses its own production direct
   `DATABASE_URL`, `DATABASE_SSL_MODE=verify-full`, `DATABASE_ROLE=tj_owner`,
   `NODE_ENV=production`, exact `CLIENT_URL` and bounded pool/timeouts. Strip
   conflicting URL SSL/options parameters according to the reviewed parser.
   Keep `MIGRATION_DATABASE_URL`, `MIGRATION_DATABASE_ROLE=tj_owner` and
   `MIGRATION_DATABASE_SSL_MODE=verify-full` in operator-only configuration;
   do not give the API migrator credentials. Verify real backend startup role
   and authenticated SQL/API work, not merely a listener. The trusted backend
   intentionally assumes owner and has DDL rights; application ownership checks
   enforce user isolation. A bare non-owner table grant is incompatible with
   policy-free RLS. Qualify pooling separately before replacing direct runtime
   connections. Confirm budgets across all replicas and concurrent rollouts.
4. **Session and HTTPS behavior.** Generate a new production signing secret in
   the protected store during the authorized launch; coordinate all API replicas
   and stop old ones. No secret is rotated now. Do not import validation/old
   sessions. Configure exact HTTPS origins and the built client's API URL. Test
   actual cross-origin signup/login/refresh/logout with credentials, CORS origin
   and credential headers, Secure/HttpOnly/SameSite cookies, path/domain,
   reload, expiration and deletion; check actual browser cookie/site restrictions
   rather than assuming local HTTP proves production behavior. Confirm stale
   tokens fail and temporary transport/server errors preserve recoverable auth.
5. **Provider and operational verification.** Supply a server-only Finnhub key
   through the approved store if live quotes are enabled; never `VITE_*` or logs.
   Record one actual supported-symbol response and observation time, unavailable/
   stale/manual behavior and currency separation. Fixed-price arithmetic evidence
   remains separate. Until key/provider checks pass, live pricing is unverified;
   explicitly agree a manual-only launch scope or complete provider setup before
   claiming live valuation. Measure Railway-to-Neon warm/cold reconnects, import
   latency, connection budget, error rates and health/readiness configuration.
   Choose sizing and thresholds from observations, not workstation timings.
6. **Controlled owner onboarding and traffic.** Verify actual empty-state
   registration, first account/portfolio, authentication and two-user isolation
   at the reviewed deployed SHA. Do not import synthetic fixtures. Owner approval
   of the working production app is a new production checkpoint, distinct from
   the already accepted TJ-04 review. Record deployment IDs, initial emptiness,
   first acknowledged write and traffic-release time. All onboarding/verification
   records become protected immediately. Start the agreed observation window;
   retain recoverable data/security/session evidence before broader traffic.

## Neon recovery and compatible application rollback

Before the first production write, the owner/operator must approve backup and
recovery ownership, actual retained history/volume limits, secure backup access,
restore validation and proposed RPO/RTO. These commitments remain **undecided**;
the validation project's six-hour setting is not a production guarantee. Recheck
current plan allowances before any recovery branch or paid retention decision.

The existing TJ-04 exercise forked a **separate** recovery destination at a
recorded short historical point, verified pre-point presence/post-point absence,
application access, ledger and security. It did not prove the full configured
retention window, zero loss, subsecond timestamp alignment, post-point write
reconciliation or production outage RTO. Its workstation timing is not Railway
latency. Use the existing report as procedure evidence, not an SLA.

Before any new production writes, a verified compatible application build and
configuration can be rolled back without business-data divergence, after checking
schema and secret compatibility. Baseline Supabase code and the inactive Supabase
database are not recovery candidates. Preserve the verified Neon database even
when only application code is rolled back.

After writes begin, freeze relevant writers, retain the current branch and all
acknowledged records, select a still-retained timestamp/LSN, and restore/fork into
a separate restricted recovery target. Compare schema, all migration checksums,
owners/grants/defaults/RLS and application role behavior, including provider-created
defaults. Reconcile post-point inserts, updates, deletes, imports/deduplication and
financial effects before resuming writes. Preserve or explicitly invalidate
sessions so recovery cannot resurrect revoked access. Record and validate the
reconciliation mechanism before routing; switching connection strings alone is
insufficient. Never replace the original branch, discard new data or assume a
restore merges divergent timelines. If complete preservation cannot be established,
keep writes stopped and escalate the concrete recovery gap to the owner.

## Readiness boundary

Prepared now: owner acceptance record, reviewed pending fixes/evidence, verified
current deployment triggers and this executable sequence of checkpoints.
Outstanding: exact pushed-fix verification; production resources/IDs and bootstrap;
production credentials/signing/configuration; HTTPS/provider checks; Railway
measurements, writer inventory, sizing/retention/backup commitments; launch window
and production confirmation. All remain explicit gates, not successful tests.
