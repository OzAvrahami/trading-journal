# Trading Journal GitHub Development Standard

This repository follows **Oz GitHub Development Standard v1**, adapted from
[ProjectDeck's canonical standard](https://github.com/OzAvrahami/ProjectDeck/blob/9f0bbb27ce015c13c76dd7c7db1f162751d2bc60/docs/github-development-standard.md).
The source revision is `9f0bbb27ce015c13c76dd7c7db1f162751d2bc60`, retrieved on
2026-09-10. The four Issue Forms, blank-issue configuration, and release-note
configuration were retrieved from that same revision. Other repositories'
adaptations are not canonical requirements.

## Repository and ownership

- Repository: [OzAvrahami/trading-journal](https://github.com/OzAvrahami/trading-journal).
- Development Project: [Trading Journal Development, #12](https://github.com/users/OzAvrahami/projects/12).
  It is owned by OzAvrahami, private, and linked to this repository. Current
  planned work is recorded in [the migration backlog](neon-migration-backlog.md).
- Homepage: [Trading Journal](https://trading-journal-client-production.up.railway.app).
  Railway's client service domain and HTTP response were checked on 2026-09-10.
- OzAvrahami owns prioritization, acceptance, version selection, and publication.
  An issue assignee owns implementation and supplies verification evidence.
  The owner or designated reviewer decides when acceptance is satisfied.
- The owner performs all staging, commits,
  pushes, merges, tagging, publication, and deployment decisions. Automation and
  coding agents must not interpret a prepared release as permission to publish.

## Workflow and priority

Project Status is the source of truth:

```text
Backlog → Ready → In Progress → Verify → Done
```

| Status | Meaning |
| --- | --- |
| Backlog | Captured work, not planned for active implementation |
| Ready | Defined, prioritized, and ready to start |
| In Progress | Being implemented |
| Verify | Implementation complete, awaiting verification |
| Done | Completed and verified |

New repository issues must be added to the Project and enter Backlog. Closing an
issue moves it to Done; reopening moves it to Ready. Ready through Verify are
deliberate manual transitions. Close completed issues only after acceptance is
verified. Record a reason when closing duplicate, invalid, or wontfix work;
that disposition is not a claim that a feature was delivered.

Priority is a native single-select field in this order:

| Priority | Meaning |
| --- | --- |
| P0 — Critical | Immediate intervention: outage or data-loss/corruption risk |
| P1 — High | Important work to address among the next items |
| P2 — Medium | Normal planned work; default chosen during triage |
| P3 — Low | Nice to have or can reasonably wait |

P2 is a triage convention, not a verified automatic default. Neither Status nor
Priority is represented by labels.

## Labels and Issue Forms

Use **at most one** primary type label per issue: `bug`, `feature`, `enhancement`,
`chore`, or `documentation`. A feature introduces a capability; an enhancement
improves existing behavior. Meta labels are `duplicate`, `invalid`, and `wontfix`.

Multiple durable scopes may apply:

| Scope | Surface |
| --- | --- |
| frontend | React client, UI, accessibility, and English/Hebrew localization |
| backend | Express API, authentication, and server services |
| database | PostgreSQL schema, migrations, and database access controls |
| shared | Shared Zod schemas, constants, and calculation utilities |
| github | Repository governance, Issues, Projects, and Releases |
| railway | Hosting and runtime configuration for the client and API services |

Existing `good first issue`, `help wanted`, and `question` labels are retained as
auxiliary metadata. They are not primary types, statuses, or priorities. No
ambiguous labels were deleted or merged.

Bug, Feature, Enhancement, and Chore forms apply their matching type labels.
Blank issues are disabled. Documentation work may use the Chore form and have
`chore` replaced with `documentation` during triage; do not leave both primary
types. Reporters must remove secrets and personal or financial data from evidence.
Apply a matching primary type to future pull requests as well, so generated
release notes can categorize them.

## Views: configured and read back

- [Development](https://github.com/users/OzAvrahami/projects/12/views/2): board,
  Status as columns, with Title, Priority, Labels, and Assignees visible.
- [All work](https://github.com/users/OzAvrahami/projects/12/views/1): table with
  Title, Status, Priority, Labels, and Assignees visible; no filter or grouping.

The original empty table was reused. Only one board was added. No duplicate
Project, repository membership, fields, or issue items were created.

## Workflow configuration and verification

The owner confirmed completion of the GitHub Project workflow setup on
2026-09-10. **Configuration is owner-confirmed; automation behavior has not been
independently tested.** No repeat setup or confirmation is required for this
release. Fields, views, and repository linkage were independently read back
during the earlier alignment work; that evidence is separate from the owner's
workflow confirmation.

The confirmed setup follows these rules: new repository issues are added to
the Project and enter Backlog, closing issues moves them to Done, and transitions
through Ready, In Progress, and Verify remain deliberate manual decisions.
Automatic PR-link or merge transitions must not bypass Verify. The earlier
snapshot of enabled GitHub defaults predates the owner's completed setup and
must not be treated as the current configuration.

Reopened issues move to **Ready**. The owner did not separately confirm whether
a native reopened-to-Ready workflow exists. Use the agreed manual fallback
where necessary: the owner or assignee sets Status to Ready when reopening an
issue. Native reopening automation is neither claimed nor required to finalize
this release baseline. This preserves the canonical transition regardless of
which native capabilities are available.

Also avoid PR closing keywords such as `Fixes #…` before issue verification:
GitHub can close linked issues on merge independently of Project workflows.
Use a reference such as `Refs #…` while acceptance is pending.

No test issues, workflow experiments, custom GitHub Actions, tokens, or
replacement automation were created. Creating and triaging the legitimate
migration backlog does not prove closing or reopening automation. Workflow
setup remains owner-confirmed; no repeat setup investigation is required.

See GitHub's [native workflow guide](https://docs.github.com/en/issues/planning-and-tracking-with-projects/automating-your-project/using-the-built-in-automations)
and [auto-add guide](https://docs.github.com/en/issues/planning-and-tracking-with-projects/automating-your-project/adding-items-automatically).

## Release process

Published versions use `vMAJOR.MINOR.PATCH`, optionally `-alpha.N` or `-beta.N`.
A **published GitHub Release** is authoritative for the released version. Package
versions, tags, repository HEAD, and deployed commits are separate evidence.
Never call a tag alone a Release or move historical tags to fit new naming.

The first stable baseline is published:
[v1.0.0](https://github.com/OzAvrahami/trading-journal/releases/tag/v1.0.0),
`2026-09-10T18:53:07Z`, commit `9434cda9b8b225b6615e31bad379c3de63d4ea4e`.
It is stable, non-draft, and Latest at reconciliation. All manifests and
lockfiles remain `1.0.0`. See the [publication and preparation evidence](release-baseline.md),
[changelog](../CHANGELOG.md), and [reconciled local release notes](releases/v1.0.0.md).
Existing Releases and tags are not rewritten to reconcile local documentation.

For later releases, review the delivered changes, choose SemVer based on scope,
keep manifests and lockfiles consistent, update the changelog, and publish only
after the owner accepts the exact commit and verification evidence. Generated
notes group Features, Enhancements, Bug Fixes, Maintenance, and Documentation and
exclude duplicate, invalid, and wontfix items. The first baseline uses curated
notes because no GitHub issues or pull requests existed at baseline preparation.

## Activation and phase boundary

The Issue Forms, blank-issue setting, and `.github/release.yml` were committed
and pushed with the published baseline and are present on the default branch.
Local Markdown does not configure remote workflows. Remote metadata, labels,
fields, and views are already active. Workflow setup is owner-confirmed, with
the manual reopening fallback and untested behavior distinguished above.

The owner authorized planning for
[v1.1.0 — Neon Migration](https://github.com/OzAvrahami/trading-journal/milestone/1)
and explicitly accepted the technical plan/start of TJ-02 on 2026-09-12. It remains
a planned milestone, not a published Release, with no due date. In the six-issue
[migration backlog](neon-migration-backlog.md), TJ-01 is accepted/closed and Done;
TJ-02 is locally implemented and open in Verify. TJ-03 through TJ-06 remain Backlog.
The [plan](neon-migration-plan.md) and [initialization guide](neon-initialization.md)
separate local code/test evidence from later Neon, production and recovery gates.
This authorization permits TJ-02 code and disposable local tests; it does not
permit cloud provisioning, production configuration/deployment or Git operations.
Package versions stay at `1.0.0`; a deliberate bump belongs to
TJ-06 after implementation and verification are complete. Each later release
must verify its final reviewed pushed commit before owner-controlled tagging
and publication; never tag moving `main` or repurpose a historical tag.

The owner accepted a complete fresh start on 2026-09-10 because Supabase is
inactive and cannot be reactivated. The milestone now targets an empty Neon
database initialized from repository migrations; historical users, sessions and
business records are intentionally not imported. Source access/backups/transfer
and source comparisons are superseded requirements, not successful tests. No
repeat approval of this decision is needed. New-user onboarding, deterministic
financial verification, migration/security checks and Neon-only recovery remain
required. Newly created Neon data is protected; the historical reset does not
authorize another reset after launch. The 2026-09-10 scope revision authorized planning only; the separate 2026-09-12
TJ-02 approval authorizes the local implementation above, not provisioning or launch.
