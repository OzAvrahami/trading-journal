# v1.1.0 — Neon Migration planning

## Current consolidated v1.1.0 review - 2026-09-14


The owner authorized the local proxy correction and one consolidated release review.
Eight new focused rate-limit/security tests and seven focused existing auth tests
pass. All four first-party packages and four lockfiles are **1.1.0** with unchanged
dependencies; migrations 001-020 bytes are unchanged. TJ-06 is **open/Verify** for
review, with live deployment verification and unmet operational requirements still
open. TJ-05 acceptance/Done and Feature #7 Backlog are unchanged. See
[release notes](releases/v1.1.0.md) and [launch/recovery gates](neon-launch-plan.md).
Earlier In Progress/version-deferral wording below is dated evidence superseded
by this checkpoint. The six-file documentation-only handoff must not be used.


Planning metadata began on 2026-09-10; dated evidence below is preserved.
Current September14 state: TJ-01 through TJ-05 are accepted/closed and Done.
TJ-04 publication is verified and TJ-05 owner production acceptance is received at
implementation `1bc4373ea367ade9d28de2bdbd3110afcc4718fe`.
TJ-06 is In Progress for stabilization/release preparation. Feature #7 remains
independently planned Backlog/P2, outside v1.1.0. No release is published yet.

## Baseline and target

- Published baseline: [v1.0.0](https://github.com/OzAvrahami/trading-journal/releases/tag/v1.0.0),
  commit `9434cda9b8b225b6615e31bad379c3de63d4ea4e`, published
  `2026-09-10T18:53:07Z`. Stable, non-draft, and Latest at planning readback.
- Target milestone: [v1.1.0 — Neon Migration](https://github.com/OzAvrahami/trading-journal/milestone/1).
  It is open, planned, and has no due date.
- Existing Project: [Trading Journal Development #12](https://github.com/users/OzAvrahami/projects/12).
- Outcome: Trading Journal launches on a freshly initialized Neon PostgreSQL
  database using repository migrations, application-owned JWT authentication,
  verified financial behavior/access controls, and Neon recovery for new records.
- Accepted owner decision (2026-09-10): inactive Supabase cannot be reactivated;
  all historical users, sessions and business records are intentionally discarded.
  No source access, backup, transfer or source comparison is required. This does
  not authorize provider-resource deletion or loss of records created on Neon.

Package versions remain `1.0.0`. The target version is a planning decision;
version changes and release preparation belong to TJ-06 after implementation
and verification. The owner controls commits, pushes, tags, and publication.

## Ordered backlog

The established TJ-01 through TJ-06 identifiers name this migration sequence,
independent of GitHub issue numbers. These six issues use primary type `chore`
and the indicated durable scope labels. Other Features use their Issue Form titles.
Status and Priority live in native Project fields.

| Identifier / issue | Scope | Status | Priority | Depends on |
| --- | --- | --- | --- | --- |
| [TJ-01 / #1 — Audit dependencies and define fresh initialization](https://github.com/OzAvrahami/trading-journal/issues/1) | backend, database, railway | Done | P1 — High | None |
| [TJ-02 / #2 — Adapt connections and migration portability](https://github.com/OzAvrahami/trading-journal/issues/2) | backend, database | Done | P1 — High | [TJ-01 / #1](https://github.com/OzAvrahami/trading-journal/issues/1) |
| [TJ-03 / #3 — Initialize isolated empty Neon and verify security](https://github.com/OzAvrahami/trading-journal/issues/3) | database | Done | P1 — High | [TJ-02 / #2](https://github.com/OzAvrahami/trading-journal/issues/2) |
| [TJ-04 / #4 — Verify workflows with deterministic fixtures](https://github.com/OzAvrahami/trading-journal/issues/4) | frontend, backend, database | Done | P1 — High | [TJ-03 / #3](https://github.com/OzAvrahami/trading-journal/issues/3) |
| [TJ-05 / #5 — Launch separately initialized fresh production](https://github.com/OzAvrahami/trading-journal/issues/5) | backend, database, railway | Done | P1 — High | [TJ-04 / #4](https://github.com/OzAvrahami/trading-journal/issues/4) |
| [TJ-06 / #6 — Stabilize operations and prepare v1.1.0](https://github.com/OzAvrahami/trading-journal/issues/6) | backend, database, github, railway | Done | P2 — Medium | [TJ-05 / #5](https://github.com/OzAvrahami/trading-journal/issues/5) |

Each issue contains the problem, scope, acceptance checklist, verification
requirements, baseline, and execution boundary. Dependencies are recorded both
as real issue links in the bodies and native GitHub blocked-by relationships.
The full acceptance criteria live in the linked issues.

## Fresh initialization gates

1. **TJ-01 technical review:** the [revised plan](neon-migration-plan.md) records
   the accepted fresh-start decision, retained audit evidence, static review of
   all 17 migrations, and destination/role/recovery choices. No repeat approval
   of historical data loss is needed. Technical acceptance was explicitly recorded
   on 2026-09-12; TJ-01 is closed and Done.
2. **TJ-02 connections and portability:** verified TLS/direct migration connection,
   proven-unused SDK removal, explicit owner/search path/ledger bootstrap,
   forward validation of migration 008 constraints and correct global defaults
   beyond 017; preserve JWT architecture and handle stale sessions safely.
3. **TJ-03 isolated initialization:** empty validation database, repository
   migrations and new ledger; verify actual schema, extensions, constraints,
   ownership/ACL/default privileges/RLS and repeatability on another empty target.
4. **TJ-04 deterministic verification:** new-user/empty-state/isolation workflows,
   imports and deduplication, journals/reviews/rules, investment ledgers and fixed
   financial expectations, prices/times and Hebrew/RTL/date behavior. No old-data
   comparisons or copied identities.
5. **TJ-05 fresh production launch:** independently initialize/verify production,
   never copy validation fixtures; control API/deployment writers, invalidate old
   sessions as reviewed, record deployment/database checks and owner onboarding.
   Supabase is not a fallback. Protect every new Neon record from its first write.
6. **TJ-06 operations/release:** verify Neon recovery and retention/ownership,
   stabilize, clean up only proven-unused settings without automatic resource
   deletion, and prepare release/version changes only after implementation and
   verification. Owner controls Git/deployment/publication.

Actual isolated destination: `trading-journal` / `delicate-fire-79141899`,
validation branch `br-green-cake-arg1asaf`, Oregon (`aws-us-west-2`), PostgreSQL
18.6, fixed 0.25 CU on the existing Free plan, six-hour history setting. Two
empty databases initialized independently with reviewed 001-019 and matching
normalized schema/security. See the [TJ-03 report](validation/tj-03-neon-2026-09-12.md).
Production remains unprovisioned. Application checks and the restricted recovery
exercise have passed with their documented limits; Railway/production operational
gates remain. All six migration issues retain their metadata and linear dependencies.
TJ-01 through TJ-03 are closed/Done; TJ-04 is owner-accepted and open/Verify pending
final pushed-fix verification; TJ-05/TJ-06 remain Backlog.

## Membership and triage evidence

Before creation, all-state issue and milestone queries and Project item reads
were empty. One milestone and six issues were created; existing labels, fields,
Project, and views were reused. Auto-add membership was still absent on repeated
reads during ordinary backlog work. Each missing issue was therefore added
manually, reusing any already-successful membership mutation and verifying one
membership per issue. No duplicate items or workflow test issues were created.

At backlog creation, all six issues entered Backlog before triage. Priority was
set in the Project; only TJ-01 was then deliberately moved to Ready. At that
snapshot, no issue was In Progress, Verify, Done, or closed. The Project
description was updated to reflect migration planning.

Workflow setup remains owner-confirmed and was not reconfigured or investigated.
Membership completion is not proof of auto-add behavior. Closing and reopening
behavior was not tested; reopened issues retain the agreed manual Ready fallback
where necessary.

## Backlog-creation verification and limits

Readback covers each title/body, milestone, canonical labels, native dependency,
body dependency link, unique Project membership, Status, and Priority. The
milestone has no due date. The published Release and historical tag commits
were rechecked and left unchanged. Local checks cover Markdown links, documented
metadata consistency, whitespace, unchanged package/lockfile versions, and a
documentation-only diff with no staged changes.

Earlier release preparation verified Railway-reported deployment metadata and
public HTTP responses only; its dated evidence remains in
[release-baseline.md](release-baseline.md). Authenticated functionality, live
database state, applied migrations, and provider behavior were not tested in
that governance work or this planning task. No broad application tests were run.

The backlog-creation task did not execute TJ-01, discover database credentials, implement a
migration, modify application/database code or data, change production settings,
deploy, stage, commit, push, tag, or publish another Release.

## TJ-01 audit handoff — 2026-09-10

The separately authorized read-only audit moved TJ-01 from Ready to In Progress
and then to Verify for owner review. At that dated snapshot, the issue remained open with P1 priority,
its original labels/milestone/dependencies, and a concrete
[Neon migration plan](neon-migration-plan.md). TJ-02 through TJ-06 remain Backlog.

Source evidence shows `pg` persistence, application-owned JWT/refresh sessions,
and no callers of the Supabase SDK wrapper. Railway identifies the production
Supabase pooler/project reference and reports both services deployed at the
v1.0.0 SHA. Existing Neon CLI OAuth was reused; the visible organization contains
two unrelated projects, neither adopted as the destination. Verified-TLS SQL
inspection failed before queries with `SELF_SIGNED_CERT_IN_CHAIN`; live catalog,
counts, grants, RLS and migration-history results are therefore unknown.

At that earlier snapshot, the plan covered writer classes, isolated transfer, explicit
migration-017 ownership/ACL/default-privilege restoration, financial validation
with identical prices/timestamps, final freeze and recovery before/after new
Neon writes. Destination identity, source CA/catalog evidence, external writers,
recovery targets and owner acceptance were follow-ups at that snapshot. The
source-transfer follow-ups are superseded by the accepted reset; only the revised
Neon technical/operational choices above remain. No authenticated
application tests, backups, restores, migrations, database writes, infrastructure
changes or deployment were performed. No broad tests or workflow experiments
were run; the existing owner-confirmed workflow and manual reopening fallback
remain unchanged. Earlier dated preparation evidence is preserved.

## Scope revision - accepted fresh start, 2026-09-10

Issues #1-#6 are revised in place. The milestone outcome now describes fresh
initialization; no Release or version changed. Source inspection, backups,
transfers and comparisons were retired as requirements, not checked off as tests.
Migration 017 security verification remains mandatory on Neon; the ledger is
created by the runner and records actual new execution. Migration 008 validation,
global default privileges, registration without accounts and stale-session
handling are concrete implementation/verification findings in the revised plan.

No application/database/infrastructure changes, migration execution, deployment,
staging, commits or pushes occurred. Local document checks include untracked
files; issue metadata is read back, preserving original memberships and dependencies.
The accepted historical reset does not permit discarding any new Neon records.

## TJ-02 local implementation snapshot - 2026-09-12

This dated pre-commit evidence is retained. Its pending-SHA and issue-state
statements are superseded by the accepted pushed handoff below.

Owner technical acceptance closes TJ-01 (Done). TJ-02 moved deliberately through
Ready and In Progress and is now open in Verify. Priorities, canonical labels,
milestone, unique memberships and the dependency order remain unchanged. No
workflow setup or test issue was created. TJ-03 through TJ-06 remain Backlog.

See [current connection/initialization operations](neon-initialization.md) and
[updated plan](neon-migration-plan.md). TJ-02 implements verified TLS/direct
migration connections, removal of the unused Supabase wrapper/SDK, serialized
atomic migration recording, preserved 001-017 plus forward 018/019, and stale
server/client session handling. Signup remains application-owned and the first
account is created explicitly through the application, not a historical backfill.

Local PostgreSQL 18.6 focused server run: 29 passed, zero failed, one optional
standalone catalog check skipped (equivalent catalog checks ran in the disposable
integration suite). Client session/cache/refresh checks: 11 passed. The client
production build passed with Browserslist-age and bundle-size warnings. UTF-8,
whitespace, local links, preserved historical migration bytes and all eight
manifest/lockfile versions were checked. The later
integration rerun passed after a local Docker WSL-engine exit caused a connection
timeout; no production connection was used. Full Neon, financial/UI, launch and
recovery verification remain their downstream gates, not claims of TJ-02 completion.
All test-created databases/roles were cleaned up, then the explicitly identified
disposable container was removed; unrelated containers/resources were retained.
Remote readback verified TJ-01 closed/Done, TJ-02 open/Verify, TJ-03–TJ-06
open/Backlog and unchanged labels, priorities, milestone, unique memberships and
native/body dependencies. TJ-02 has five implementation checklist items checked;
the final owner review and eventual committed/pushed SHA remains unchecked.

Base SHA is `9434cda9b8b225b6615e31bad379c3de63d4ea4e`; all implementation remains
uncommitted for owner review, and the final implementation SHA is pending. Existing
release corrections were preserved. Packages remain 1.0.0. No cloud provisioning,
production configuration/signing rotation, deployment or Git publication occurred.
The owner already accepted technical work; sizing, retention, launch timing and
operational recovery commitments are separately reviewed downstream.

## Accepted pushed handoff and TJ-03 verification - 2026-09-12

The owner accepted/pushed the 34 reviewed TJ-02 paths on
`chore/tj-02-neon-preparation` at `2821435dc609ad85d3447cd22f799fb17a508968`.
Local HEAD and remote branch matched; remote main remains the v1.0.0 SHA.
TJ-02's final acceptance was recorded, the issue closed as completed and its
existing Project item verified Done. This completes code/local verification,
not production launch. TJ-03 moved through Ready and In Progress to Verify and
remains open; TJ-04 through TJ-06 were not started. Workflow setup was not revisited.

The [live report](validation/tj-03-neon-2026-09-12.md) and
[redacted evidence](validation/tj-03-neon-2026-09-12.json) record two independently
initialized empty Neon databases using the unchanged reviewed runner, pgcrypto
1.4, 20 tables/19 empty business tables, 13 protected trigger functions, validated
018 constraints, effective 017/019 security and the explicit owner role model.
The bootstrap guide now requires database ACL statements as `tj_owner`: doing
so as the Neon admin had left PUBLIC grants unchanged. This was corrected and
negative access tests passed without weakening RLS or changing application code.

The independent normalized schema/security manifests match. Full-precision
ledger timestamps/checksums remain unchanged on 19-skip reruns. Live busy-runner,
SQL-failure rollback and targeted session interruption checks passed, with no
probe objects/records or synthetic migration ledger entries left behind.
Actual shared-pool role startup, TLS, DATE parsing and transaction rollback passed.
New role credentials are encrypted outside Git. No production system was connected.

TJ-04 receives the isolated validation database for comprehensive deterministic
application verification. A separate restricted recovery-branch exercise remains
planned; six-hour history configuration is not a tested recovery guarantee.
Railway latency, cold-start/load sizing, production initialization, launch and
operational commitments remain downstream. New Neon records must be preserved.
These documentation changes await owner commit; reviewed code SHA and all
package/lockfile versions are unchanged. No Git publication or deployment ran.

## TJ-03 acceptance and TJ-04 execution - 2026-09-12

The owner delegated review and acceptance of the completed isolated TJ-03 scope.
The agent inspected all six pending documentation files, verified the detailed
catalog/ledger evidence and the `tj_owner` database-ACL correction, and accepted
that scope without repeating its completed suite. This records agent review of
local artifacts, not a claim that the owner or this chat independently inspected
them. TJ-03 is closed/Done. Its two original evidence files remain unchanged as
dated snapshots; their former open/Verify state is superseded here.

TJ-04 proceeded through Ready and In Progress and is open in Verify. See the
[report](validation/tj-04-neon-2026-09-12.md),
[independent fixture expectations](validation/tj-04-fixtures-2026-09-12.md) and
[redacted execution evidence](validation/tj-04-neon-2026-09-12.json).
Authenticated APIs exercised two synthetic users, financial ledgers, both CSV
importers, ownership boundaries, dates/timezones and session failures. A dedicated
timestamp recovery child preserved the selected historical state and passed
application/security checks without changing the root. Uncommitted fixes address
the demonstrated cross-account file-import blocker (forward migration 020) and
stale provider/retained client quote handling. The original SHA is still HEAD;
there is no final implementation SHA for these fixes yet.

Interactive English/Hebrew/RTL, responsive flows and real-browser cache/session
acceptance remain open: the connected browser inventory was empty. API locale,
Unicode and date checks and focused jsdom component/session tests passed, but
they do not substitute for browser verification. TJ-04's combined UI and
launch-blocker checklist items remain unchecked. TJ-05/TJ-06 remain Backlog.
No production readiness, actual Finnhub connectivity, Railway latency, general
RPO/RTO, new version, Git publication or fixture promotion is claimed.

## TJ-04 actual-browser follow-up - 2026-09-13 (before owner acceptance)

The earlier browser-unavailable observation is a dated snapshot, superseded by the
[Chrome follow-up](validation/tj-04-browser-2026-09-13.md) and
[structured evidence](validation/tj-04-browser-2026-09-13.json). Installed Chrome
ran 21 passing scenarios: real signup/first account/login/reload/logout, two-user
switching and delayed-response isolation, expired/stale sessions, bounded transient
failures, English/Hebrew/RTL and narrow layouts, account-scoped CSV feedback and
controlled quote fallback. A demonstrated English-only pagination summary received
a narrow locale/direction fix; 15 focused existing tests and the browser rerun passed.

Issue #4 acceptance items 2 and 6 now have actual-browser plus prior API evidence.
Item 7 remains open pending owner visual acceptance and final review/publication
of uncommitted fixes. #4 stays open/Verify; #5/#6 stay Backlog with existing metadata.
The actual local app is left running with dedicated synthetic review users and
private local credentials. Old fixtures/ledger are preserved; repeat/recovery
resources are untouched. Local HTTP is not production cross-site HTTPS cookie
verification. No actual Finnhub connectivity, production launch, new SHA/version,
Git publication or owner visual acceptance is claimed.

## Current owner acceptance and final commit gate - 2026-09-13

The owner completed application review and accepted the TJ-04 tests. Earlier
pending-visual-acceptance statements above are historical and superseded. Completed
API, browser and recovery checks retain their actual limits. #4 remains open/Verify
only for the final reviewed/pushed commit verification and publication handoff;
#1-#3 remain closed/Done and #5/#6 Backlog with unchanged metadata/dependencies.
After that exact commit and the remaining #4 criteria are verified, close #4/Done
and move #5/Ready. See the [reviewed handoff](validation/tj-04-handoff-2026-09-13.md)
and [production launch checkpoints](neon-launch-plan.md). No production readiness
is inferred from accepted local review. All existing Neon records are protected.

[Feature #7](https://github.com/OzAvrahami/trading-journal/issues/7) captures the
administrator-controlled catalogue including casing, remains Backlog/P2 without
a milestone or dependency, and is not a Neon release blocker. Its invented TJ-07
prefix was corrected to the Feature template convention. No catalogue code exists
in this reviewed changeset. Cross-project memberships were corrected without
changing Finance Tracker's legitimate Project #1 fields or the Neon issue sequence.

## Production acceptance and TJ-06 stabilization - 2026-09-14

Owner production acceptance is recorded; #5 is completed/Done. #6 moved through
Ready to In Progress. [Launch/stabilization evidence](neon-launch-plan.md) records
16h04m13s of bounded retrospective metrics, no sampled 5xx, current backend/TLS and
new owner records, a refreshed protected archive and limited temporary-table
reconciliation. Existing archive restores remain verified separately.

A newly reproduced Railway proxy/rate-limiter configuration defect blocks release.
Off-device backup custody/cadence, formally agreed observation scope and comprehensive
post-point recovery remain explicit unchecked requirements. Do not reinterpret them
as successful tests. Prepared [v1.1.0 notes](releases/v1.1.0.md) and changelog describe
completed work only. Version bump is deferred while that technical gate remains;
all versions are `1.0.0`. The future final release commit must be reviewed/pushed and
verified before owner-controlled main deployment, tagging and publication.
