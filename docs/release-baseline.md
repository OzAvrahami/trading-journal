# Current release baseline and owner handoff

Evidence collected on **2026-09-10** using the authenticated local GitHub and
Railway CLIs, repository source, and unauthenticated HTTP reads. This document
prepares a release; it does not publish one.

## Accepted baseline

Use **`v1.0.0`**, titled **`Trading Journal v1.0.0 — Trading and Investment Platform`**,
as the first stable GitHub Release, as accepted by the owner on 2026-09-10.
This version decision is complete; publication and the final commit remain
pending. Root, client, server, and shared manifests
and lockfiles already use `1.0.0`. The existing platform tag is a historical
checkpoint with a suffix, not a stable `v1.0.0` Release. The history supports
formalizing the current product without inventing a higher version solely
because Releases are absent. No version bump is required in this phase.

The accepted baseline scope is all delivered product source through
`bebce992cc710df7407c551a8052bf7ad0e333c7`, plus the governance and release files
prepared here. **The final release SHA is pending a new owner commit.** Neither
moving `main` nor the earlier platform tag is the proposed publication target.

## Version inventory

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

## Deployment evidence

Railway project `33467026-92c3-47f8-a74a-9603dee32671`, environment
`fe8779c6-1889-4a0a-8842-34bfb472dfe0` (`production`), is linked to this repository.
The current service records reported:

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

## GitHub alignment evidence

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

## Prepared local files and checks

The only new repository files are:

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

The six YAML files are adapted from the pinned canonical revision; the Bug
environment guidance is tailored to Trading Journal. Targeted validation checks
YAML parsing/duplicate keys, Issue Form structure and unique IDs, required
fields, existing remote form labels, one primary type per form, disabled blank
issues, release categories/exclusions, and agreement of all manifest/lockfile
versions. Scope checks confirm no tracked application file or index change.
No application build, broad test suite, migration, or data operation is needed
for these governance files. GitHub-hosted rendering remains pending the owner
push. Native workflow behavior remains untested because no test issues were
created.

Validation passed on 2026-09-10: six YAML files parsed with duplicate-key
rejection, all four forms passed structure/label checks, canonical categories
and exclusions matched, and parsed content matched the pinned source except
for the documented Bug environment guidance. All four manifests and four
lockfiles agreed at `1.0.0`; relative Markdown file links resolved. The final
scope check found exactly the ten files above, no tracked application changes,
and no staged changes. YAML tooling was installed only in an operating-system
temporary directory; no application dependencies or lockfiles changed.

Finalization rechecked all ten currently untracked files, including YAML
structure, live read-only form-label lookup, Markdown file links and anchors,
UTF-8 content, trailing whitespace, and the accepted release title. The full
changelog and release body were compared with source and commit history.
Owner-confirmed configuration, untested automation behavior, and the manual
reopening fallback are now consistent across the four Markdown files. All
checks passed; tracked files and the Git index remain unchanged.

## Exact owner handoff

1. Review the finalized ten files, [release body](releases/v1.0.0.md), and
   [CHANGELOG](../CHANGELOG.md), then stage only those files and review the
   staged diff before committing. The owner has already accepted `v1.0.0` and
   confirmed workflow setup; neither decision needs repeating. The preparation
   commit may retain the accurately marked unpublished changelog entry: no
   release date is invented and no final SHA is assigned in advance. Record
   the actual publication date when publication occurs, without changing the
   release tag to incorporate a later documentation update.
2. Check Railway's deployment trigger settings before pushing: both services
   have source branch `main`, and previous main updates triggered deployments.
   If this governance push must not deploy, the owner must pause the relevant
   automatic deployments first. This task changed no Railway settings.
3. Stage only the listed files, make the owner preparation commit, and push it
   to main using the owner's normal Git workflow. Suggested commit title:
   `chore: align GitHub workflow and prepare v1.0.0 release`.
   If other work has arrived, review/reconcile it before choosing a release
   commit; do not silently include a future migration or unrelated changes.
4. Capture the **full immutable SHA of that owner commit**, then verify it
   remotely and locally. The following read-only PowerShell checks illustrate
   the required gate; replace the placeholder with the actual SHA:

   ```powershell
   $releaseSha = 'REPLACE_WITH_FULL_OWNER_COMMIT_SHA'
   if ($releaseSha -notmatch '^[0-9a-f]{40}$') { throw 'Supply the reviewed full SHA' }
   git status --short
   git rev-parse HEAD
   gh api "repos/OzAvrahami/trading-journal/commits/$releaseSha" --jq .sha
   gh api repos/OzAvrahami/trading-journal/branches/main --jq .commit.sha
   git merge-base --is-ancestor bebce992cc710df7407c551a8052bf7ad0e333c7 $releaseSha
   git diff --name-status bebce992cc710df7407c551a8052bf7ad0e333c7 $releaseSha
   git diff --exit-code bebce992cc710df7407c551a8052bf7ad0e333c7 $releaseSha -- client server shared package.json package-lock.json
   git show "${releaseSha}:CHANGELOG.md"
   git show "${releaseSha}:docs/releases/v1.0.0.md"
   git ls-tree -r --name-only $releaseSha -- .github docs CHANGELOG.md
   gh api repos/OzAvrahami/trading-journal/tags
   gh api repos/OzAvrahami/trading-journal/releases
   ```

   Require successful commands, all ten intended files in the commit, no
   application/package difference from the inspected product baseline, and a
   reviewed changelog/release body. Verify remote main resolves to the intended
   SHA at this gate; if it moved, inspect the new commits and repeat review.
   Never replace `$releaseSha` with `main` as the tag target. Recheck all manifest
   and lockfile versions from that commit and the configuration checks after
   any owner edits. Confirm `v1.0.0` is still absent locally and remotely.
5. Only the owner then creates and pushes the new tag at that exact SHA:

   ```powershell
   git tag -a v1.0.0 $releaseSha -m 'Trading Journal v1.0.0'
   git rev-parse 'v1.0.0^{commit}'
   git push origin refs/tags/v1.0.0
   gh api repos/OzAvrahami/trading-journal/commits/v1.0.0 --jq .sha
   ```

   Both resolved commit reads must equal `$releaseSha`. Do not move, delete,
   or recreate either historical tag. Stop if a conflicting stable tag exists.
6. Publish a stable GitHub Release from the **existing verified tag** using the
   title above and the full body in `docs/releases/v1.0.0.md`. Append the verified
   full release SHA to the publication body, and retain the preparation-time
   verification limits. If using the CLI, pass a reviewed body file and
   `--verify-tag`; do not allow release creation to synthesize a tag from main.
   A draft or tag alone does not formalize a published version. Read back
   `tagName`, `isDraft`, `isPrerelease`, `publishedAt`, the body, and the tag's
   resolved SHA. Record the real publication URL/date. Compare Railway active
   deployment SHAs separately; publishing a Release does not itself prove a
   new deployment.

All commands that stage, commit, push, tag, or publish are **owner-only handoff
instructions**, not actions executed in this task. The next immediate owner
action is review of the finalized files and staged diff, followed by the
preparation commit. Workflow setup and baseline acceptance are already complete.
Future issues and the next target
version are a subsequent phase; no future milestone or backlog was created.
