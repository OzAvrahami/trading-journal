# TJ-05 production execution and verification - 2026-09-13 / 2026-09-14

## Current consolidated review checkpoint - 2026-09-14

TJ-05 is accepted/closed/Done. TJ-06 is open/Verify for the consolidated local
rate-limit correction, tests, version 1.1.0 and release documentation. No new commit
or deployment exists yet. The production implementation remains
`1bc4373ea367ade9d28de2bdbd3110afcc4718fe`. The owner need not commit the earlier
six-file documentation-only draft. Its manifest remains historical evidence and
its executable handoff has been disabled in favor of the consolidated handoff.
Earlier version-deferral/technical-blocker text below records discovery history;
the local correction now passes, while live and operational gates remain open.


The owner authorized execution on the **existing Neon Free plan**, preserving
live Finnhub valuation and manual-price fallback. The earlier paid Launch package,
seven-day paid retention/snapshot recommendation and manual-only launch proposal
were **not accepted** and are superseded. No billing change, service downgrade,
source import or repeat TJ-04 acceptance is required.

TJ-04 is accepted and closed/Done at
[`1bc4373ea367ade9d28de2bdbd3110afcc4718fe`](https://github.com/OzAvrahami/trading-journal/commit/1bc4373ea367ade9d28de2bdbd3110afcc4718fe).
Its 30 paths/blobs and 12 source hashes were verified against the pinned manifest;
see [the closure record](https://github.com/OzAvrahami/trading-journal/issues/4#issuecomment-5655315756).
Those accepted tests were not rerun. TJ-05 is **accepted/closed and Done**; TJ-06 is **In Progress** and independent
[Feature #7](https://github.com/OzAvrahami/trading-journal/issues/7) remain Backlog.
Owner TJ-04 acceptance remains complete. Owner **production** acceptance was explicitly received on 2026-09-14.

Use the [initialization guide](neon-initialization.md),
[TJ-04 evidence](validation/tj-04-neon-2026-09-12.md),
[browser evidence](validation/tj-04-browser-2026-09-13.md) and
[issue #5](https://github.com/OzAvrahami/trading-journal/issues/5).

## Historical starting state and completed production preparation (September 13, before cutover)

At that preparation checkpoint, local and remote `chore/tj-02-neon-preparation` were at the accepted SHA above;
main was `9434cda9b8b225b6615e31bad379c3de63d4ea4e`. The index was empty and
only this launch plan was modified on entry. Its earlier read-only evidence is
reconciled below. Application code, package versions (1.0.0) and historical
migrations remain unchanged. No Git publication or Railway mutation occurred.

Existing authenticated Neon CLI 3.6.0 and Railway CLI connections were reused.
Before creation, Oz was confirmed Free with three projects, no production-name
match, and AWS Oregon available. The earlier project listing was paginated through
the final empty page. API version support and TJ-03 PG18 compatibility supported
the choice; creation itself confirmed availability. No unrelated project was adopted.

| Production resource | Actual identity / setting |
| --- | --- |
| Organization | `Oz` / `org-lively-cherry-67205699`; **Free**, unchanged after provisioning |
| New project | `trading-journal-production` / `steep-poetry-37072993` |
| Root/default branch | `production` / `br-autumn-tooth-akqd8l9n`; no parent or cloned validation data |
| Endpoint | `ep-delicate-firefly-akbom07o` |
| Direct host | `ep-delicate-firefly-akbom07o.c-3.us-west-2.aws.neon.tech` |
| Application database | `trading_journal` / database ID `2531361`, owner `tj_owner` |
| Operator database | `tj_production_admin` / database ID `2531349`, owner `tj_admin` |
| Placement / version | `aws-us-west-2`, PostgreSQL **18.6**, pgcrypto **1.4** in public owned by `tj_owner` |
| Compute | Fixed min/max **0.25 CU**; `suspend_timeout_seconds=0` selects the Free default of five-minute idle suspension |
| Recovery / storage | `history_retention_seconds=21600`; logical-size cap **536870912 bytes**; API later reported logical size 40960000 bytes |
| Creation | Project created `2026-09-13T19:14:00Z`; database created `19:16:11Z` |

Protected unchanged resources: project `delicate-fire-79141899`, validation root
`br-green-cake-arg1asaf`, `trading_journal_validation`,
`trading_journal_validation_repeat`, and recovery child `br-soft-mountain-aratb02z`.
No SQL or cleanup was executed against them. Every existing record, including the
owner's user and accounts, remains protected. Production is independently created
from template0; validation data and historical Supabase users/sessions were not copied.

## Initialization and security results

The dedicated operator first confirmed no existing production database or application
roles. Created `tj_owner` NOLOGIN and separate `tj_backend`/`tj_migrator` logins:
NOINHERIT, no superuser/CREATEDB/CREATEROLE/BYPASSRLS, explicit SET membership in
`tj_owner`. `tj_admin` is operator-only and retains provider administration privileges;
it is not the API login. An untrusted probe login has no production CONNECT access
and its random credential is protected, never distributed to the application.

Database ACL statements executed **as tj_owner**. Readback:
`{tj_owner=CTc/tj_owner,tj_backend=c/tj_owner,tj_migrator=c/tj_owner,tj_admin=c/tj_owner}`.
PUBLIC CONNECT/TEMP and schema CREATE were revoked. Public schema owner is
`pg_database_owner`. Credentials were generated and stored using current-user
Windows DPAPI outside the repository, with owner/SYSTEM/Administrators ACLs.

Before execution, **all 20 migration Git blobs matched the accepted commit**.
The accepted `loadMigrations`/`runMigrations` implementation ran through the separate
direct migrator connection with verified certificate/hostname TLS and owner role.
No historical SQL or ledger was edited; no seed or demo command ran.

- Initial public table count: **0**.
- Migration run: `2026-09-13T19:16:30.012Z` to `19:17:25.320Z`.
- Ledger: **20** ordered filenames and matching normalized SHA-256 checksums.
  First actual application time `2026-09-13 19:16:33.17252+00`; last
  `2026-09-13 19:17:23.704312+00`. Microsecond timestamps were read as PostgreSQL text.
- Verification at `19:17:58.935Z`: **20 tables, 213 columns, 298 constraints,
  81 valid/ready indexes, 13 application trigger functions, 168 triggers including
  internal constraint triggers, no sequences, no RLS policies**.
- Exact normalized schema/security comparison matched the **committed TJ-04 JSON
  final-inventory catalog**, including column/default/constraint/index/function/
  trigger definitions, ownership, grants, schemas/extensions and creator defaults.
  Internal trigger OIDs are normalized; business row counts are intentionally separate.
- Before onboarding, all **19 business tables had zero rows**, including users and refresh_tokens.
  No business fixtures or onboarding records were inserted during initialization.
- Both migration-008 checks are validated by 018. Migration 020's successful-file
  unique index is scoped by `(user_id, account_id, file_sha256)`.
- Migration 017 policy-free, non-FORCE RLS is enabled on every public table;
  019 global/per-schema defaults and actual effective permissions passed the
  accepted `assertPublicSchemaSecurity` checks and catalog comparison.
- The backend connected using the actual application `databaseConfig` contract:
  `session_user=tj_backend`, `current_user=tj_owner`, database `trading_journal`,
  search_path `public`, authorized TLS. Owner access worked; untrusted CONNECT
  failed with **42501**. The backend without owner selection also received 42501.
- A temporary SELECT grant inside a rolled-back transaction still produced an
  RLS **false** predicate for the non-owner; the grant was rolled back and verified
  absent. No business writes were needed. Table grants alone were not treated as
  sufficient to bypass policy-free RLS.
- Second migration invocation: **20 skips**, with every ledger timestamp/checksum
  unchanged. This is a production rerun check, not a new interruption/recovery claim.

The trusted backend intentionally assumes owner and has DDL rights over its
objects. Application authorization enforces tenant isolation; this is not a
read/write-only runtime role or per-user database RLS model.
Credential-free local catalog/ledger evidence is in ignored `.tmp/tj05-verify.json`,
SHA-256 `be442c9e081e049193f9cbb7aa8dd5fa0a098dc5ccfffd6da6305c2bceba0f69`.
The exact migration source and summary above remain in this plan for owner review.

## Free-plan recovery and actual initial backup

Read back six-hour retention and Free billing after creation. The
[current plan limits](https://neon.com/docs/introduction/plans) and
[history window](https://neon.com/docs/introduction/history-window), inspected
September 13, are $0, 100 projects, 10 branches/project, 100 CU-hours/project/month,
0.5 GB/project, 5 GB/project/month public transfer and a maximum of six hours or
1 GB of change history. No paid scheduled snapshots are configured. At 0.25 CU,
100 CU-hours covers 400 active endpoint-hours, including recovery endpoints; idle
suspension matters. Continuous monthly activity exceeds that allowance. Detailed
consumption-v2 and spending-limit APIs are unavailable on Free. Monitor the Neon
Console without frequent SQL polling that keeps compute awake. No upgrade is implicit.

A real initial custom-format backup was taken using the existing Docker
`postgres:18.6` image, `pg_dump` 18.6, direct endpoint, migrator login and
`--role=tj_owner`, with **verify-full TLS**. The image lacked a CA bundle; supplied
Node's trusted public roots through a read-only mount rather than disabling TLS.
The first encryption attempt exceeded SecureString's size limit; the successful
backup uses byte-oriented current-user DPAPI (`ProtectedData`) instead.

- Backup time: **2026-09-13T19:21:24.239Z**.
- Archive: **114494 bytes**, SHA-256
  `04141ce71cb07f4b5f9a6a0c627a30238cdd4ddbd1cdbe56f1196044ea87ce10`.
- Encrypted path: `C:\Users\ozavr\.config\neon\trading-journal-production-initial-backup.dpapi`.
- DPAPI decrypt/readback matched the archive bytes; `pg_restore --list` successfully
  read its catalog, including schema_migrations and users table data entries.
- Includes a captured schema/security catalog. It contains the empty initialized
  database, not future onboarding data. Disposable export containers were removed;
  no provider resource was deleted.
- **At this initial-backup checkpoint, a database restore had not been executed.** Later post-onboarding restores are recorded below. Archive readability alone does not prove restore
  success, a full six-hour recovery interval, zero loss, off-device durability or RTO.

Accessible operator procedure: use the same Windows identity/profile to decrypt
this byte-DPAPI JSON in memory; the `archive_base64` member contains the custom
archive. Never print it. The protected production credential bundle uses the
separate SecureString-DPAPI format. Existing ignored `.tmp/tj05-production.mjs`
records the exact export/encryption/readback procedure. For subsequent backups,
use a **new timestamped path**, retain earlier archives, and record SHA-256/time;
never overwrite the initial archive or store plaintext credentials/backups in Git.
The current-user local store is available now; off-device backup custody and an
unattended schedule are not established. Owner OzAvrahami is the current operator
and recovery decision owner; no unaccepted response-time promise is inferred.

Before risky changes and after onboarding, capture another consistent encrypted
backup and the role/database/default-ACL catalog. For incidents, first stop API and
operator writers, preserve the current production root and every acknowledged record,
then create a **separate restricted recovery child** at a still-available timestamp/LSN
or restore the archive into an independently empty recovery database. Use compatible
PG18 tools and re-establish owner/login membership and database ACLs explicitly.
If no-owner/no-acl options are used, restore the omitted privileges separately:
a restored 001-020 ledger causes the runner to skip security migrations, not repair ACLs.
Check actual schema/defaults/RLS, including provider-created defaults, and backend access.

A historical recovery copy lacks later writes. Reconcile post-point inserts,
updates, deletes, imports, balances and revoked sessions before routing; a connection
switch alone is not recovery. Keep writes stopped if preservation cannot be proved.
The prior TJ-04 child exercise proved a short historical fork, not production
restoration or a recovery SLA. The bounded production archive restore and compatible application restart demonstration
is now recorded below. Arbitrary incident reconciliation remains case-specific and must preserve later writes. Supabase and validation are never fallback targets.

## Historical live-price and secure configuration preparation (before cutover)

The project's existing **server/.env contains FINNHUB_API_KEY**. It was read only
in memory, preserved unchanged and copied to the protected production bundle.
The existing application `marketDataService.getQuote('AAPL')` succeeded from the
local operator at **2026-09-13T19:16:38.093Z**, returning **332.27** with provider
observation time **2026-09-11T20:00:00.000Z** (within the accepted freshness contract).
No key was printed, committed or included in issue evidence. This is a real provider
check, distinct from deterministic arithmetic tests and from future Railway egress.

**Live pricing remains in launch scope**, together with stale/unavailable handling
and manual-price fallback. The deployment gate still requires an actual Finnhub
request through the production API. No manual-only launch decision was made.

The current-user protected bundle is
`C:\Users\ozavr\.config\neon\trading-journal-production.dpapi`.
It contains separate login credentials, the verified key, a newly generated strong
production JWT secret and the complete server transition. The JWT is **prepared,
not applied**. Existing local and Railway secrets remain unchanged.

| Setting | Prepared production value / treatment |
| --- | --- |
| DATABASE_URL | Direct host above, `trading_journal`, login `tj_backend`; private value, no URL query overrides |
| DATABASE_ROLE / DATABASE_SSL_MODE | `tj_owner` / `verify-full` |
| DATABASE_POOL_MAX | `10`; one API replica |
| DATABASE_CONNECT_TIMEOUT_MS | `8000` |
| DATABASE_IDLE_TIMEOUT_MS / DATABASE_STATEMENT_TIMEOUT_MS / DATABASE_IDLE_TRANSACTION_TIMEOUT_MS | `30000` each |
| NODE_ENV | `production` |
| CLIENT_URL | `https://trading-journal-client-production.up.railway.app` |
| JWT_SECRET | New protected server-only secret, coordinated across all new replicas |
| FINNHUB_API_KEY | Existing project key, now verified locally and prepared securely |
| Client VITE_API_URL | Preserve `https://trading-journal-api-production-5863.up.railway.app` |
| MIGRATION_DATABASE_* | Operator-only direct migrator connection; never deployed to API/client |
| Legacy Supabase settings | Unused in accepted code; cleanup remains TJ-06, not a recovery route |

## Historical Railway deployment and writer inspection (before cutover)

Authenticated Railway readback during this execution confirms:

- Project `33467026-92c3-47f8-a74a-9603dee32671`, sole environment production /
  `fe8779c6-1889-4a0a-8842-34bfb472dfe0`.
- API `29cdfe74-c3c9-4180-8090-5b2611c5d9da`; client
  `c4270688-1473-48cb-8f82-4260e4aded70`. Both actual GitHub triggers are **main only**;
  no PR/ephemeral triggers. All inspected connections reached their final page.
- API deployment `99f68f14-4476-4ead-9866-e1b3c5d39ee9` is still SUCCESS, not stopped,
  with one RUNNING instance at the baseline SHA. Client deployment remains
  `1fb07f0a-629e-4692-95bf-45f5a1d83ca5` at that same baseline.
- Deployment manifests place one replica each in `us-west2`; no measured
  Railway-to-Neon latency follows. Cron, pre-deploy migration and healthcheck unset.
- API build `npm install`, start `npm start` -> `node index.js`; client build
  `npm install && npm run build`, start `npm start`. Startup parses configuration
  but neither runs migrations nor verifies a SQL connection.
- `/api/health` is not database-backed readiness. API variables still point to
  Supabase; **none of the prepared Neon/JWT/Finnhub values is applied yet**.

Potential writers: API mutations (including signup/refresh/logout/imports), clients
or integrations invoking those routes, migration/admin/seed scripts and manual SQL.
No additional Railway service, cron or GitHub Actions writer was found. The import
cleanup timer only expires an in-memory Map; quote fetching is request-driven.
External SQL tools cannot be exhaustively disproved, so new production credentials
are distributed only to the named operator and then the API. Never supply them to
`seed`, `seed:demo` or existing validation runners. The in-process import session
store is qualified for one API replica; scaling is a later verified decision.

At cutover, stop the **old API only**, confirm all its instances stopped, apply the
complete configuration using secret stdin and `--skip-deploys`, read it back in
memory, and only then let the owner publish the accepted SHA to main. Do not deploy
or restart the baseline with new variables. The old API remains running until the
owner actually executes this coordinated sequence, not while waiting for a reply.

Public registration has no invitation/maintenance gate. After deployment the API
is publicly reachable; hiding the client or CORS is not an access barrier. Every
visitor's record is protected from the first write. Verify immediately before
broader invitation; never delete unexpected registrations as test cleanup.

## Completed owner cutover and Windows PowerShell interruption

The owner published **1bc4373ea367ade9d28de2bdbd3110afcc4718fe** to main.
Local HEAD, the preparation branch and remote main were read back at that exact SHA
on September 14. The index remains empty; this plan is the only tracked edit.
The old API deployment is REMOVED. The owner applied the prepared configuration and
coordinated JWT invalidation before publication. No credentials were reapplied,
secrets rotated again, services stopped or Git publication repeated during resumption.

The cutover script reported `NativeCommandError` at native stderr redirection even
though Git's push succeeded. Windows PowerShell 5 represents native stderr as an
ErrorRecord; with `ErrorActionPreference=Stop`, progress output can interrupt the
wrapper before it checks the process exit code. This was an operator-wrapper failure,
not evidence of a failed push or deployment.

The ignored local `.tmp/tj05-cutover.ps1` helper now temporarily captures native
output with Continue, reads the actual global LASTEXITCODE immediately, restores the
caller's preference and throws a redacted failure for nonzero/missing exit codes.
Railway stdin invocations use the same helper. Only the helper was extracted through
the PowerShell AST for harmless tests: stderr plus exit 0 returned stdout successfully;
stderr plus exit 7 threw the expected redacted failure; Stop preference was restored.
The script parsed successfully. No production mutation was used to test it.

**Do not run the cutover script again.** Its old-main and protected-bundle guards
intentionally describe the historical handoff. The original reviewed script hash was
`20e3986f1c5fdf7c84357d1960c89103f24c9991adeb62925aaa83cadd66de7b`;
the corrected local script hash is `fdec70366ebcfc9bfa481ae68b6130832d063a699abeedd132488cacf8ba7a64`. The previous executable cutover
instructions are superseded by this completion record. Corrected helper:

```powershell
function Invoke-Checked {
    param([string]$Program, [string[]]$Arguments, [AllowNull()][string]$InputText)
    # Windows PowerShell represents redirected native stderr as ErrorRecord.
    # Do not let EAP=Stop interrupt a successful process before reading its exit code.
    $command = Get-Command $Program -CommandType Application -ErrorAction Stop
    $savedPreference = $ErrorActionPreference
    try {
        $ErrorActionPreference = 'Continue'
        $global:LASTEXITCODE = $null
        if ($PSBoundParameters.ContainsKey('InputText')) {
            $output = $InputText | & $command.Source @Arguments 2>&1
        } else {
            $output = & $command.Source @Arguments 2>&1
        }
        $exitCode = $global:LASTEXITCODE
    } finally {
        $ErrorActionPreference = $savedPreference
    }
    if ($null -eq $exitCode -or $exitCode -ne 0) {
        # Never include arguments, stdin or native stderr: they may contain secrets.
        throw "Native process failed (exit $exitCode); stopped. Inspect privately before retrying."
    }
    return (($output | Where-Object { $_ -isnot [System.Management.Automation.ErrorRecord] } | ForEach-Object { [string]$_ }) -join "`n")
}
```

## Actual deployments and database-backed readiness

Both services were created at **2026-09-13T19:31:55.983Z** from the reviewed SHA:

| Service | Deployment / running instance | Successful status time |
| --- | --- | --- |
| API | `3ef994c9-5798-459b-a725-2d2288dde3e5` / `7b04e9b6-66f0-4087-bc51-8caabdb5459a` | `2026-09-13T19:32:45.691Z` |
| Client | `ca34aa9a-eb98-44ae-ae83-230d13792add` / `37c75fee-6518-4569-85de-8c08bafb2f6f` | `2026-09-13T19:33:09.734Z` |

Both remain SUCCESS at the exact reviewed SHA on September 14. The old API
`99f68f14-4476-4ead-9866-e1b3c5d39ee9` and its instance are REMOVED. The existing
main-only triggers remain unchanged. There was no assistant deployment or restart.

- Public client: <https://trading-journal-client-production.up.railway.app>
- API: <https://trading-journal-api-production-5863.up.railway.app>
- Both client and `/api/health` returned 200 again on September 14.
- Actual running-container verification through `src/db/client.js`, at
  **2026-09-14T11:21:04.560Z**: database `trading_journal`, production direct host,
  session user `tj_backend`, effective user `tj_owner`, search_path `public`,
  certificate-authorized **TLSv1.3**, with configured `verify-full` contract.
- This database-backed check saw **2 users, 1 account and 20 migrations**.
  At **11:21:55.998Z**, all 20 production table counts and sorted-row fingerprints
  matched the refreshed backup and its independently restored copy, including sessions.
  No acknowledged record was removed or reset.
- Actual Railway-container pool acquisition measured **704.35 ms**; three bounded
  account-count reads measured **66.09 / 20.45 / 20.72 ms**. These are observed
  application-to-Neon timings, not an SLA. Cold suspended-compute startup and load
  were not forced or tested; healthy services were not stopped to manufacture a test.

Deployment success timestamps bound public exposure; no maintenance/invitation gate
exists. They are not exact first-traffic timestamps or an assertion of owner review.
At **2026-09-13T19:38:19.618Z**, the running API's database still had zero users.
The first observed registration request started at **19:40:55.425Z**, completed by
**19:40:57.240Z**, and the earliest user row carries PostgreSQL created_at
**19:40:56.578867+00**. That is a stored transaction-time value, not a fabricated WAL
commit time. The initial encrypted backup preceded those writes.

## Bounded production HTTPS and application verification

Actual **Chrome 152.0.7977.83**, with an isolated operator test profile, used the
public HTTPS client/API origins on September 13, 19:40-19:46 UTC. No TLS bypass,
local HTTP substitution, bulk fixtures or repetition of the accepted TJ-04 suite.

| Check | Observed result |
| --- | --- |
| Registration / empty state | Real signup form reached dashboard; account list initially empty; explicit first account and portfolio creation succeeded. |
| Login / reload / refresh / logout | Login succeeded; browser reload restored the same user and rotated the refresh cookie; sidebar logout returned to login and removed the cookie. |
| HTTPS cookie / CORS | Secure, HttpOnly, SameSite=None, path=/, API host cookie; exact client Allow-Origin and Allow-Credentials=true; browser credentialed requests succeeded. |
| Session invalidation | Invalid JWT returned 401; invalid refresh cookie returned 401 with cookie expiry. The owner-applied new signing context invalidates old tokens; no second rotation occurred. |
| User isolation / cache | User A logout followed by B login in the same browser context showed no A account/cache state. B's cross-user account GET/PATCH returned 404; B's own account list stayed empty. |
| Live provider | Production API returned AAPL **332.27**, Finnhub as-of **2026-09-11T20:00:00Z**, checked September 13 within the accepted freshness window. This proves actual Railway provider connectivity at that time, not continuous availability. |
| Unavailable provider / manual fallback | Unknown synthetic symbol returned 404. Stored manual price remained 100. A USD 100 deposit and one-unit purchase at 100, fee 0, yielded cash **0**, holdings **100**, total **100**, unrealized PnL **0**, exactly as expected. |
| Actual holdings UI | After explicit account/portfolio linking, showed manual value $100, unrealized $0 and the unavailable-live-quotes/manual-valuation message. No live valuation capability was removed. |

Two synthetic production users are retained, IDs
`bf7063b5-a101-4d4f-be4b-a9b6a8e37fe4` and
`a272c8e3-15cb-43b6-aac6-5ee6f2941c34`. Retained bounded data: one account,
one portfolio, one instrument/manual price, two investment transactions and four
refresh-ledger rows. No trades or bulk datasets were inserted. Credentials are only
in the protected current-user bundle; never in this document, GitHub or screenshots.
Account `475fe30b-bc8e-4511-8908-d4e4666f6bb6` and portfolio
`537435f9-9387-4428-aeca-84c6d48fba13` remain linked. All production and pre-existing
validation/repeat/recovery records remain protected.

Operator harness corrections were bounded: use nested portfolio/instrument response
objects instead of an undefined ID; wait for B's actual identity rather than a cached
A response; reuse existing users; explicitly link the account before testing the
holdings view. Failed probes did not justify application changes. No application
file or historical migration was modified. Production outage injection, rate-limit
saturation, cross-browser coverage and continuous provider monitoring were not run.

## Refreshed backups and demonstrated isolated restore

Both custom archives use pg_dump **18.6**, direct verify-full TLS and a single
exported REPEATABLE READ snapshot shared with schema/catalog and sorted-row
fingerprints. Encryption is byte-oriented current-user DPAPI outside Git. Earlier
archives remain intact.

| Backup snapshot (UTC) | Archive bytes / SHA-256 | Protected local filename |
| --- | --- | --- |
| `2026-09-13T19:46:19.965Z` | 116004 / `41f8ebc06443635307c97c8dcf73538d6bbd3a646965935a8b140ef94e4c17f2` | `trading-journal-production-onboarding-backup.dpapi` |
| `2026-09-13T19:50:22.022Z` | 116038 / `e8a1d0ba5474dff2d20b5853e49f8e8ee1a9b378a5e2c2a22ca8b33353ab9bc0` | `trading-journal-production-postverification-20260913.dpapi` |

Files are under `C:\Users\ozavr\.config\neon`. Each decrypted archive matched its
recorded bytes/hash. The later snapshot includes the final account/portfolio linkage;
the earlier snapshot does not. All 20 root table fingerprints still matched the later
archive on September 14, so no additional backup was needed for unchanged data.
Take a new timestamped archive after further onboarding or before risky changes.

Free plan and included branch capacity were rechecked. Created only a restricted
recovery child, **recovery-tj05-20260913 / br-steep-bonus-akdd1bfr**, parent
`br-autumn-tooth-akqd8l9n`, at **2026-09-13T19:47:27Z**. Direct endpoint
`ep-shiny-cloud-ak6xlw9e.c-3.us-west-2.aws.neon.tech`, fixed 0.25 CU, default idle
suspension. No provider resource was deleted and no production routing changed.
The child shares the project's Free compute/storage allowances; it is not free
additional unlimited capacity.

Two independently empty template0 databases, `trading_journal_restore_check` and
`trading_journal_latest_restore`, received the older and latest archives respectively.
Their database ACLs were applied **as tj_owner**; backend and untrusted logins are
NOLOGIN on this child, and backend CONNECT to the restored databases is denied.
Only protected operator access was used. Root role attributes/ACLs were not altered.

The first restore attempt failed because the helper had removed the empty public
schema but pg_dump expected that schema to exist. `--single-transaction` rolled
back the attempted restore. Restoring the normal empty public-schema bootstrap
(owner pg_database_owner; PUBLIC USAGE, no CREATE) resolved this operator procedure
error. Both pg_restore invocations then completed with `--single-transaction`,
`--exit-on-error`, `--role=tj_owner`, no --no-owner/--no-acl and no ledger edits.
Never rerun initialization or restore over these now-populated evidence databases.

Independent verification finished **2026-09-14T11:14:55.998Z** and
**11:19:35.523Z**:

- All **20** table counts and sorted-row fingerprints match the corresponding
  snapshot, including all 20 migration ledger checksums/timestamps and session rows.
- Columns, constraints, indexes, functions, triggers, sequences, extensions,
  schemas, creator defaults, ownership, effective grants and RLS match.
- pg_dump omits explicit default owner-only table ACLs: restored NULL relacl resolves
  to the identical `acldefault('r', owner)`. Effective privileges were compared.
- Twelve CHECK definitions print casts differently after restore. Recreating each
  original definition inside a rolled-back transaction produced exactly the restored
  pg_get_constraintdef output. No expected hash was replaced or control weakened.
- Starting the accepted application against the latest restricted copy using the
  operator migrator login and explicit owner role returned 200 for both users'
  `/api/me` and `/api/accounts`; A's account remained and B saw none. Short-lived
  synthetic JWTs were private; no recovery session or financial mutation was needed.
- The older and newer copies differ in account/portfolio linkage; the latest copy
  preserves the final update. Session fingerprints also match their backups. The
  older copy was never substituted for production.

This demonstrates archive restoration and restart of the **accepted Neon-compatible
build** against preserved data. It does not qualify the old Supabase build, prove
arbitrary incident reconciliation, test actual Railway rollback/routing or guarantee
zero loss/RTO. Restore execution durations were not captured reliably; verification
completion timestamps above are not restore-time commitments. The six-hour live
history cannot recover this previous-day point now; the retained archive can.
No production PITR exercise or full six-hour retention guarantee is claimed.

Recovery procedure: stop writers only during a real coordinated incident; retain a
current consistent archive and the original root; restore to a restricted empty
child/database; compare schema/security/ledger and records; reconcile every later
insert/update/delete/import/balance/session revocation before any routing change.
Prefer a fresh final snapshot with writers frozen where the current database remains
readable. If later acknowledged changes cannot be accounted for, keep writes stopped
and escalate; never silently route to an older snapshot. Keep the new DB/signing
context for compatible code-only rollback. An older application revision needs
separate compatibility qualification before use.

Current limits remain explicit: Free/$0, six hours or 1 GB history, local Windows
DPAPI custody only, no off-device copy or unattended backup schedule, no tested
machine-loss recovery, no accepted response-time/zero-loss guarantee. OzAvrahami is
the current operator and production reviewer. Backup custody/scheduling, monitoring
and longer operational observation belong to TJ-06; no billing change is implied.

## Historical evidence and owner production handoff (superseded by September 14 acceptance)

Local ignored evidence: `.tmp/tj05-browser-results.json`,
`.tmp/tj05-production-manual-fallback.png`, `.tmp/tj05-runtime-readback.json`,
`.tmp/tj05-runtime-final.json`, `.tmp/tj05-deployments-final.json`,
`.tmp/tj05-root-backup-readback.json`, `.tmp/tj05-backup-post.json`,
`.tmp/tj05-recovery-verified.json`, `.tmp/tj05-recovery-latest-verified.json`.
The backup metadata's original restore_executed=false records its capture-time
state; the separate later restore evidence above supersedes that state without
rewriting the historical capture. This document is the durable credential-free
summary; private operator scripts, archives and credentials remain excluded from Git.

TJ-05 stays **open in Verify** for owner production review. Technical bounded checks
are complete with the explicit operational limits above. Owner production acceptance
is pending; TJ-04 stays Done, TJ-06 and Feature #7 stay Backlog. Packages remain 1.0.0.

Next owner action: open the public client, register/sign in using the intended new
production identity, create/review the first account, reload then sign out/in, and
review investment/live-price/manual-price behavior. Report production acceptance or
specific problems. Existing validation credentials/data were deliberately not imported.
Every new record will be preserved. Do not rerun cutover, repeat the push or reinitialize.

Historical evidence: the 18:54-19:02 read-only preparation found three projects,
Free allowances and absent Railway Finnhub configuration, and proposed paid/manual
choices. That was a proposal only. The owner's later Free/full-capability instruction
supersedes it; the local key discovery and actual provisioning above are new evidence.
No historical Supabase records are required, and no new Neon record may be discarded.


## TJ-05 acceptance and TJ-06 stabilization - 2026-09-14

The owner explicitly confirmed that production review is complete and everything
works correctly. Issue #5's remaining owner checkbox is checked, the issue is closed
as completed and its existing Project item is Done. The rejected connector HTTP403
attempt made no change; the authenticated local CLI recorded the acceptance.
No repeat TJ-04/TJ-05 review is required. TJ-06 moved Backlog -> Ready -> In Progress.
The earlier pending-owner-review wording above is historical and superseded.

### Actual observation coverage

Requested Railway log/metric interval: **2026-09-13T19:31:55Z through
2026-09-14T11:36:08Z** (16h04m13s). This is a retrospective bounded sample, not an
agreed 24-hour window or continuous availability monitoring. Both deployments still
report SUCCESS at `1bc4373ea367ade9d28de2bdbd3110afcc4718fe`.

- API logs: 214 records, first 19:32:41.770465124Z, last September14
  11:35:55.174782061Z; client logs: 643 records, first 19:33:07.114744076Z,
  last September14 11:33:52.165219214Z. Neither reached the 5000-line request cap.
- Railway HTTP metrics: API 327 requests (279 2xx,29 3xx,19 4xx,**0 5xx**),
  p50/p90/p95/p99 **180/238/350/350ms**; client 318 requests (284 2xx,34 3xx,
  **0 4xx/5xx**), reported percentiles 25 ms. Metrics and application log counts
  differ because edge/preflight/cache observations are not identical to Morgan logs.
- Reported current CPU/memory: API 0.001594vCPU/108.46MB, client 0.000048vCPU/121.30MB.
  These are CLI summary samples, not interval peaks or load-capacity proof.
- September14 **11:40:43.675Z** runtime pool read: production trading_journal,
  tj_backend -> tj_owner, authorized TLS; **3 users,3 accounts,20 migrations**.
  pg_stat_activity exposed two connections with NULL state under this restricted
  login; that does not prove zero active/idle-in-transaction sessions.
- Main-only triggers and no PR environments were read back with complete pagination.
  No configured cron/pre-deploy migration or extra application writer was introduced;
  external manual access is not exhaustively observable. Existing one-replica and
  in-memory import/rate-limit limitations remain.

### Newly demonstrated release blocker: proxy-aware rate limiting

Two API log entries (September13 **19:33:32.327461933Z** and
**19:40:58.262783963Z**) report `ERR_ERL_UNEXPECTED_X_FORWARDED_FOR`.
`server/src/app.js` does not configure Express trust proxy before global/auth
rate limiters. A bounded loopback check against the actual unchanged application
used two different synthetic forwarded client IPs: both health requests returned 200,
but the shared remaining counter fell **299 -> 298**. This reproduces proxy-client
bucket sharing; it is not a production saturation or spoofing test.

Before release, implement and verify a narrowly trusted Railway client-IP strategy
for both limiters. Verify the actual ingress/header-overwrite contract, distinct
client buckets and spoof resistance; do not blindly enable trust proxy=true, silence
validation or weaken the limits. See [Express proxy guidance](https://expressjs.com/en/guide/behind-proxies/),
[rate-limit error semantics](https://express-rate-limit.mintlify.app/reference/error-codes)
and [Railway ingress headers](https://docs.railway.com/networking/public-networking/specs-and-limits).
The existing HTTPS-cookie/owner acceptance remains valid; this is a new stabilization
finding, not a reason to reopen #5. No application or production configuration was
changed in this preparation. It remains a **technical release blocker in #6**.

### Backup and focused recovery follow-up

Preserved all new owner records. A new consistent, verified-TLS pg_dump18.6 archive
was captured at **2026-09-14T11:40:43.789Z**, **131486 bytes**, SHA256
`12a2b033a81db840720cfe722d9c946c4bd89319306ce6c51e8656832fc3ba67`.
Protected filename: `trading-journal-production-owneraccepted-20260914.dpapi`
in the existing current-user Neon folder. Decrypt/readback bytes and archive catalog
passed. Snapshot includes 3 users,3 accounts,103 trades,2 import runs/155 import rows,
5 refresh rows and the preserved investment verification records. Raw records,
credentials and archive contents were not printed or put in Git. Earlier backups
remain intact. **This newest archive was not separately restored**; successful
restoration of the two previous archives remains the separate evidence above.

At **11:39:34.462Z**, a focused rollback-only drill in restricted child
`br-steep-bonus-akdd1bfr` / `trading_journal_latest_restore` created only temporary
source/point/recovered tables based on actual trades/import_runs/refresh_tokens
columns, CHECK constraints and indexes. Simulated post-point delete/insert/update,
successful import marker, deleted revoked refresh row and replacement session.
An older copy demonstrably retained the revoked row; final-snapshot reconciliation
removed it and the deleted trade, retained later rows/updates, and produced zero
EXCEPT ALL differences in all three tables. Same-account duplicate import failed 23505;
the same file in another account succeeded. Transaction rolled back, public catalog/
counts were unchanged, and no task temporary objects remained.

This proves the bounded final-snapshot reconciliation logic only. LIKE tables do
not reproduce foreign keys, triggers or RLS, and this drill did not call refresh API
or execute PITR/pg_restore; prior full archive/security/application checks are separate.
A destructive incident where the final source cannot be read still needs a durable
change trail or an explicitly reviewed reconciliation source. No general post-point
reconciliation, full-window PITR or zero-loss capability is claimed.

OzAvrahami remains the current backup/restore/incident operator. Local current-user
DPAPI access is verified. **Specific unresolved operational decision:** choose an
approved encrypted off-device destination with independently recoverable custody,
backup cadence/retention and failure-alert responsibility, or explicitly accept a
bounded manual/local-only release scope. Merely copying DPAPI ciphertext without
recoverable Windows-profile keys does not establish machine-loss recovery. No new
paid service, unattended scheduler or unapproved storage destination was configured.
The observation window and recovery objectives have not been formally agreed.

### Retained obsolete configuration and release boundary

Readback found API `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` still configured;
client has no Supabase variable. Accepted runtime source has no caller or SDK;
remaining source references are historical migration 017/provider-role checks and a
security test. Retain those historical SQL/test references. The two API settings are
cleanup candidates only: this task identifies them without deleting credentials,
changing Railway variables or provider resources. Existing local .env values/backups
are also retained. Finnhub and manual fallback are unchanged; Neon organization
remains Free. No reset, cutover, billing change or deployment was performed.

Release notes and changelog are prepared in [v1.1.0 notes](releases/v1.1.0.md).
**Version fields intentionally remain `1.0.0`** because the newly demonstrated proxy
verification gate is unresolved. Once corrected and verified, bump only the four
first-party manifests and their four lockfiles (top-level and packages[""] version),
without dependency upgrades; then re-review the complete release inventory.
TJ-06 remains open/In Progress with unchecked operational requirements. The final
release SHA is pending and must include those eventual version fields and reviewed
release files. Owner publication must not tag the earlier implementation SHA by default.


## Consolidated correction and release review - 2026-09-14

### Supported ingress boundary and local correction

Installed versions inspected: Express 4.22.2, express-rate-limit 7.5.1. No dependency
upgrade. Railway service/domain and complete project-service reads show only the
owner's API and static client in this project; API public exposure is the existing
HTTPS service domain, no custom domains, and explicit tcpProxies query returned [].
The provider documents X-Real-IP for client identity. A Railway employee clarifies
that the edge strips/overwrites client-supplied forwarding values and that hop
count can vary. Use that documented contract rather than an invented stable CIDR
or hop count: [Railway specifications](https://docs.railway.com/networking/public-networking/specs-and-limits),
[employee clarification](https://station.railway.com/questions/security-critical-questions-on-edge-prox-8fddd775).
The contradictory community reply on that thread is not the chosen authority.

`rateLimits.js` supplies both existing middleware limiters. Production Railway
mode requires NODE_ENV=production and all three Railway project/environment/service
metadata variables, supplied by deployment configuration, never by a request.
Only then is a single syntactically valid X-Real-IP used. Arbitrary XFF, Forwarded
and CF-Connecting-IP are never keys. Elsewhere all forwarded identity is ignored
and the socket peer is used. Missing/malformed/list/port/zone-bearing values fall
back to a bounded peer bucket. Express trust proxy stays false, and CORS/cookie
and authentication logic are unchanged. No new production variable is required.

Trust boundary: Railway public HTTP edge and operator-controlled private project
network. A direct private caller can supply headers, so it must be trusted under
this deployment contract. **Do not add raw TCP public ingress or untrusted private
callers without a separately verified authentication/network boundary.** Metadata
alone does not authenticate a private peer; the protection against public header
spoofing comes from Railway's documented edge overwrite. Actual inbound header
values were not exposed by the current app; live proof remains post-publication.

IPv4/mapped IPv4 normalize to the same key. IPv6 spellings normalize and share a
/64 bucket, preventing interface-address rotation inside that subnet. Distinct
/64 networks stay separate; users sharing a subnet/NAT share that budget. Installed
limiter 7 has no IPv6-subnet helper, so the implementation uses node:net validation
and WHATWG canonicalization without a new dependency. Limits remain global 300 and
auth 20 per 15 minutes, in-memory per replica. No validation option was disabled and
no limit was increased.

### Focused local results

`node --test server/src/middleware/rateLimits.test.js`: **8 passed**, including
original two-client bucket regression (299/299), global request 301 rejection,
auth request 21 rejection with B unaffected, forged alternate forwarding headers,
non-Railway header rejection, malformed values, IPv4 mapping, IPv6 /64 rotation,
and actual Express middleware preflight/CORS/Secure-HttpOnly-SameSite=None refresh
cookie clearing even with forged http protocol header.

`node --test server/src/middleware/auth.test.js server/src/services/authService.test.js`:
**7 passed**, covering nonexistent users, transient DB failure without destructive
logout, subject validation, atomic refresh rotation/rollback and registration.
Tests used local HTTP and existing mocks, not production writes or repeated broad
migration/financial/browser suites. Simulated edge overwrite is a unit/integration
assumption, not proof of Railway behavior. Source correction is uncommitted.

All eight first-party manifest/lockfile root version fields are deliberately 1.1.0
following these local checks. Full parsed lockfiles compared to HEAD with only
owned version fields normalized are identical; no dependency upgrade. Historical
migrations 001-020 and v1.0.0 release evidence are unchanged.

### Recovery acceptance matrix (no implicit waiver)

| Requirement | Actual evidence | Remaining condition / consequence |
| --- | --- | --- |
| Observation | Retrospective 16h04m13s metrics/logs, documented owner production review | Formal stabilization-window agreement and longer/continuous coverage not established; zero sampled 5xx is not an uptime guarantee. |
| Backup/incident owner | OzAvrahami is current named operator; DPAPI access works | Delegated coverage and failure-alert responsibility/cadence are not agreed. |
| Archives/restoration | Two earlier archives fully restored/security checked; latest owner-data archive byte/catalog readback | Latest archive not separately restored; no off-device/machine-loss proof or unattended schedule. |
| Post-point preservation | Earlier/later snapshots and rollback-only temporary-table insert/update/delete/revocation/import-dedup drill | No complete authenticated/PITR divergence exercise, no durable change trail for an unreadable final source. Original acceptance item remains incomplete. |
| Retention/PITR | Free 21600 seconds/1GB history limit read back; prior short isolated timestamp fork | Full-window production PITR and an RPO/RTO commitment are not proven. |
| Cleanup | Two unused Supabase variable names identified, no callers | Retained pending explicit removal decision; not claimed deleted. |

Concrete owner choice before release: **(A)** supply an approved existing encrypted
off-device destination, independent key-recovery custody and scheduling/alert owner,
then verify that setup and complete the required recovery exercise; or **(B)**
explicitly revise #6's release criteria to manual/local-only custody and the bounded
recovery/observation evidence already demonstrated. Option B has real machine-loss,
backup-age and post-point reconciliation limitations and is **not accepted** merely
because production works. Neither choice authorizes paid services automatically.
Do not ask for passwords, keys or tokens in chat. Until the decision and required
verification are recorded, these are release blockers, not accepted known limits.

### Publication sequence

1. Owner reviews/stages the consolidated pinned inventory, commits and pushes only
   chore/tj-02-neon-preparation. No separate documentation commit is required.
2. Read the exact remote commit back against original manifest blobs/modes/parent
   and absence of outside changes. Do not regenerate expectations from that commit.
3. Recheck main/triggers. Owner alone publishes the verified commit to main, which
   deploys both services. No credential, JWT, initialization or cutover rerun needed.
4. Verify both actual deployments at the final SHA and bounded production DB,
   authentication/HTTPS/cookie/CORS behavior. Use interleaved health requests from
   two real network sources and forged forwarding headers to prove independent
   buckets and edge overwrite; do not saturate production. Confirm no new proxy
   validation errors. Preserve records and existing Finnhub/manual behavior.
5. Resolve the operational matrix and #6 owner release acceptance before tagging.
   Tag/publish v1.1.0 only at that exact verified final release SHA, never moving main
   or the old implementation. If additional changes are needed, review/push/verify
   their new final commit first. Preserve all earlier tags/releases.

The local version bump is preparation, not publication or an operational waiver.
TJ-06 remains open/Verify; its unmet acceptance checkboxes remain unchecked.
