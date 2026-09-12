# Published release baseline and preparation evidence

Evidence collected on **2026-09-10** using the authenticated local GitHub and
Railway CLIs, repository source, and unauthenticated HTTP reads. The baseline is
now published. This reconciliation preserves the earlier preparation evidence
and validation limits; it does not change the existing Release or tags.

## Published baseline

**[v1.0.0](https://github.com/OzAvrahami/trading-journal/releases/tag/v1.0.0)**,
titled **Trading Journal v1.0.0 — Trading and Investment Platform**, was published
at `2026-09-10T18:53:07Z`. It is stable, non-draft, and returned by GitHub's Latest
Release endpoint at reconciliation. Release ID: `386542082`.

The tag independently resolves to `9434cda9b8b225b6615e31bad379c3de63d4ea4e`,
also the clean local HEAD and remote main at the start of migration planning.
The Release API's `target_commitish` is `main`; the resolved tag commit, not
that moving branch name, establishes the exact release SHA. Root, client,
server, and shared manifests and lockfiles remain at `1.0.0`.

The accepted baseline scope is all delivered product source through
`bebce992cc710df7407c551a8052bf7ad0e333c7`, plus the governance and release files
in owner commit `9434cda9b8b225b6615e31bad379c3de63d4ea4e`. The commit adds the
ten preparation files and has no application/package differences from the
inspected product commit. The old handoff is complete; do not recreate or move
`v1.0.0`, `v0.2.0-redesign`, or `v1.0.0-platform`.

## Preparation inventory before publication (2026-09-10)

This table preserves what was observed before the owner committed and published.
It is not the current release, issue, or milestone inventory.

| Evidence kind | Observed value |
| --- | --- |
| Local branch | `main` |
| Local HEAD | `bebce992cc710df7407c551a8052bf7ad0e333c7` |
| Remote `main`, read directly from GitHub | `bebce992cc710df7407c551a8052bf7ad0e333c7` |
| Working tree before preparation | Clean; no staged or tracked modifications |
| Root manifest and lockfile | `1.0.0` in `package.json`, lockfile top-level version, and `packages[""].version` |
| Client manifest and lockfile | `1.0.0` in all three locations |
| Server manifest and lockfile | `1.0.0` in all three locations |
| Shared manifest and lockfile | `1.0.0` in all three locations |
| Tag `v0.2.0-redesign` | Resolves to `509d4d7cb077f30ddf88dc33c5674c5e29702cd3` |
| Tag `v1.0.0-platform` | Resolves to `663def5a7b2ee00e4317f8234681ccd4cbfb8c15` |
| Stable tag `v1.0.0` | Absent |
| Published GitHub Releases (including prereleases) | None; Releases API returned an empty list |
| Existing GitHub issues, pull requests, milestones | None, including closed items |
| Existing changelog/release documents | None before this preparation |

The root/package metadata is not evidence of a published Release. Both tags
remain unchanged. There are 11 commits (including merge commits) after the
platform tag through the inspected HEAD. Source review included the client
routes, server route registry, importers, authentication service, investment
valuation and quote code, README, migrations/catalog, and Git history.

## Deployment evidence from preparation (2026-09-10)

Railway project `33467026-92c3-47f8-a74a-9603dee32671`, environment
`fe8779c6-1889-4a0a-8842-34bfb472dfe0` (`production`), is linked to this repository.
The service records at preparation time reported:

| Service | Active deployment | Commit | State |
| --- | --- | --- | --- |
| trading-journal-client | `006f70bf-a6ba-4b65-81ef-2f48a162569e` | `bebce992cc710df7407c551a8052bf7ad0e333c7` | SUCCESS; instance RUNNING |
| trading-journal-api | `28a1ede1-4283-4fc3-ad78-44f081fe715e` | `bebce992cc710df7407c551a8052bf7ad0e333c7` | SUCCESS; instance RUNNING |

Both deployment records were created on 2026-08-11. That is a deployment date,
not a release date. GitHub deployment `5858311310` also reports success for the
same SHA, and both Railway commit-status contexts report success. GitHub calls
the environment `trading-journal / production` but its `production_environment`
flag is false; Railway's own environment and active service records provide the
stronger current deployment evidence.

- [Client homepage](https://trading-journal-client-production.up.railway.app):
  HTTP 200 and HTML titled Trading Journal.
- [API health](https://trading-journal-api-production-5863.up.railway.app/api/health):
  HTTP 200 with `status: ok`.
- [Railway project](https://railway.com/project/33467026-92c3-47f8-a74a-9603dee32671?environmentId=fe8779c6-1889-4a0a-8842-34bfb472dfe0).

Thus the deployed **commit** is provider-verified at inspection time; an
independent application-reported version/SHA is unavailable. The health route
returns status and timestamp only and does not test database connectivity.
No login, user data, production database state, applied-migration state, or
Finnhub request was inspected. Existing migration 017 is part of source scope;
this task did not execute or prove its production application.

## GitHub alignment evidence from preparation

Canonical source: ProjectDeck revision
`9f0bbb27ce015c13c76dd7c7db1f162751d2bc60`. No applicable `AGENTS.md` was found in
the workspace ancestry or repository directories inspected. The existing
README's security and date/time conventions were reviewed.

Read back after mutation:

- Description: “Trading journal and investment portfolio tracker with
  account-scoped analytics, trade imports, reviews, and English/Hebrew support.”
- Homepage: the verified Railway client URL above.
- Topics: `express`, `nodejs`, `personal-finance`, `portfolio-tracker`,
  `postgresql`, `railway`, `react`, `trading-journal`, `vite`.
- Added missing `feature`, `chore`, `frontend`, `backend`, `database`, `shared`,
  `github`, and `railway` labels; clarified `enhancement` as improving existing
  behavior. Reused other canonical labels and preserved auxiliary labels.
- Created and linked [Trading Journal Development #12](https://github.com/users/OzAvrahami/projects/12),
  node ID `PVT_kwHOAgE74M4BjGps`. Owner-wide Projects and repository links were
  inspected before creation; there was no existing Trading Journal Project.
- Status: Backlog, Ready, In Progress, Verify, Done. Priority: P0 — Critical,
  P1 — High, P2 — Medium, P3 — Low. Exact option text and order read back.
- Reused the initial table as All work, created Development as a board with
  Status columns, and verified the requested visible fields. Project items: 0.

Repository visibility is public; Issues and Projects are enabled. Wiki and
Discussions are disabled. The default branch is main, it is unprotected, and
the repository has no rulesets. Repository auto-merge and delete-branch-on-merge
are off; merge, squash, and rebase methods are enabled. These settings were
inspected and preserved. GitHub Actions has no workflows or runs. No branch
policy or unrelated security setting was changed.

The owner confirmed completion of Project workflow setup on 2026-09-10. See
[configuration and verification](github-development-standard.md#workflow-configuration-and-verification).
This is owner-confirmed configuration, not independently tested automation.
The earlier enabled-defaults snapshot predates that confirmation and is not a
current setup checklist. No repeat setup or owner confirmation is needed.

Reopened issues must move to Ready. Native reopened-to-Ready availability was
not separately confirmed; the owner or assignee uses the agreed manual fallback
where necessary. No native reopening behavior is claimed. This distinction is
not a release blocker. No test issues or workflow experiments were performed.

## Preparation files and historical validation

The preparation commit added these ten files:

```text
.github/ISSUE_TEMPLATE/bug.yml
.github/ISSUE_TEMPLATE/feature.yml
.github/ISSUE_TEMPLATE/enhancement.yml
.github/ISSUE_TEMPLATE/chore.yml
.github/ISSUE_TEMPLATE/config.yml
.github/release.yml
docs/github-development-standard.md
docs/release-baseline.md
docs/releases/v1.0.0.md
CHANGELOG.md
```

The six YAML files were adapted from the pinned canonical revision; the Bug
environment guidance was tailored to Trading Journal. Preparation validation checked
YAML parsing/duplicate keys, Issue Form structure and unique IDs, required
fields, existing remote form labels, one primary type per form, disabled blank
issues, release categories/exclusions, and agreement of all manifest/lockfile
versions. Scope checks confirmed no tracked application file or index change
during preparation. No application build, broad test suite, migration, or data
operation was run for those governance files. GitHub-hosted rendering had not
been checked before the owner push. Native workflow behavior was not tested;
no test issues were created.

Validation passed on 2026-09-10: six YAML files parsed with duplicate-key
rejection, all four forms passed structure/label checks, canonical categories
and exclusions matched, and parsed content matched the pinned source except
for the documented Bug environment guidance. All four manifests and four
lockfiles agreed at `1.0.0`; relative Markdown file links resolved. The final
scope check found exactly the ten files above, no tracked application changes,
and no staged changes. YAML tooling was installed only in an operating-system
temporary directory; no application dependencies or lockfiles changed.

Before publication, finalization rechecked all ten then-untracked files, including YAML
structure, live read-only form-label lookup, Markdown file links and anchors,
UTF-8 content, trailing whitespace, and the accepted release title. The full
changelog and release body were compared with source and commit history.
Owner-confirmed configuration, untested automation behavior, and the manual
reopening fallback were consistent across the four Markdown files. All
preparation checks passed; tracked files and the Git index were unchanged at
that point, before the owner committed and published.

## Publication reconciliation and next phase

The published Release, Latest endpoint, and tag resolution were read back on
2026-09-10. The original release body still contains preparation-time wording
and appends the verified release SHA; the remote body was left unchanged as
instructed. This local document, the local release notes, and CHANGELOG now
record the actual publication URL, timestamp, and commit.

The dated production observations above remain preparation evidence. No fresh
claim is made about the currently deployed commit, authenticated application
behavior, live database contents, applied migrations, or Finnhub availability.
Release publication alone does not establish those facts.

At publication reconciliation on 2026-09-10, the owner had authorized planning for
[v1.1.0 — Neon Migration](https://github.com/OzAvrahami/trading-journal/milestone/1).
See [the six-issue migration backlog](neon-migration-backlog.md). This milestone
is not a Release and has no due date. At that snapshot, TJ-01 was the next task:
read-only dependency audit and migration planning; TJ-02 through TJ-06 remained
in Backlog. Creating the backlog did not execute TJ-01 or any migration work.
Current implementation and acceptance states are recorded in the linked backlog;
this paragraph preserves the earlier publication-reconciliation evidence.

For v1.1.0, complete and verify implementation before a deliberate version bump
and release preparation in TJ-06. The owner controls staging, commits, pushes,
tags, and publication. Before tagging, verify the exact reviewed pushed commit
and its files, package/lockfile versions, changelog, and recorded validation;
resolve the new tag back to that SHA. Never bind a release to moving main or
reuse an existing historical tag. Production deployment and database verification
remain separate evidence. No commit, push, tag, Release, production configuration,
database, or deployment mutation was performed during this planning task.
