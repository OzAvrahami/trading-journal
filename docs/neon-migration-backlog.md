# v1.1.0 — Neon Migration planning

Planning metadata created on 2026-09-10. This document records the authorized
backlog and subsequent dated progress. v1.1.0 is not a published Release;
TJ-02 now has local implementation evidence, while Neon remains unprovisioned.

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

The TJ identifiers are title prefixes, independent of GitHub's issue numbers.
All issues use one primary type, `chore`, and the indicated durable scope labels.
Status and Priority live in native Project fields.

| Identifier / issue | Scope | Status | Priority | Depends on |
| --- | --- | --- | --- | --- |
| [TJ-01 / #1 — Audit dependencies and define fresh initialization](https://github.com/OzAvrahami/trading-journal/issues/1) | backend, database, railway | Done | P1 — High | None |
| [TJ-02 / #2 — Adapt connections and migration portability](https://github.com/OzAvrahami/trading-journal/issues/2) | backend, database | Verify | P1 — High | [TJ-01 / #1](https://github.com/OzAvrahami/trading-journal/issues/1) |
| [TJ-03 / #3 — Initialize isolated empty Neon and verify security](https://github.com/OzAvrahami/trading-journal/issues/3) | database | Backlog | P1 — High | [TJ-02 / #2](https://github.com/OzAvrahami/trading-journal/issues/2) |
| [TJ-04 / #4 — Verify workflows with deterministic fixtures](https://github.com/OzAvrahami/trading-journal/issues/4) | frontend, backend, database | Backlog | P1 — High | [TJ-03 / #3](https://github.com/OzAvrahami/trading-journal/issues/3) |
| [TJ-05 / #5 — Launch separately initialized fresh production](https://github.com/OzAvrahami/trading-journal/issues/5) | backend, database, railway | Backlog | P1 — High | [TJ-04 / #4](https://github.com/OzAvrahami/trading-journal/issues/4) |
| [TJ-06 / #6 — Stabilize operations and prepare v1.1.0](https://github.com/OzAvrahami/trading-journal/issues/6) | backend, database, github, railway | Backlog | P2 — Medium | [TJ-05 / #5](https://github.com/OzAvrahami/trading-journal/issues/5) |

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

Proposed destination: dedicated `trading-journal`, Oregon (`aws-us-west-2`),
PostgreSQL 18, isolated validation plus separately initialized production.
Real IDs, compute/retention, measured compatibility/latency, operator assignments
and recovery commitments remain to be recorded. This pass provisions nothing.
The six original issues and their priorities/labels/milestone/memberships and
linear dependency order are retained. TJ-02 is open in Verify after local
implementation; TJ-03 through TJ-06 remain Backlog.

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

## TJ-02 implementation handoff - 2026-09-12

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
