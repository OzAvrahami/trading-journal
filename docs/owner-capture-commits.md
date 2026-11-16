# Owner commit preparation

Prepared after normal-application local acceptance on 2026-11-16. These commands
have **not** been executed. No files are staged and no commit was made.
Review the diff before running each commit command. File arrays are explicit;
there is no `git add .`, wildcard staging, data directory or environment secret.

## Trading Journal: one complete source-aware feature commit

The existing branch is `feature/source-aware-import-preview`, based on
`f6793c0177f2c3c8d9ad3c85f52d84624a7fd8dc`. The selected 58 files cover the
retained preview milestone, migration 021, persistence/reconciliation, unknown
financial coverage, tests/harnesses and acceptance documentation. No unrelated
tracked changes were found in this worktree. The acceptance-only code fix is
the persisted source-card title in English/Hebrew. Existing staged work, if any
appears before you run this, must be handled separately; this block stops on it.

```powershell
Set-Location D:\code\trading-journal
if ((git branch --show-current) -ne 'feature/source-aware-import-preview') {
    throw 'Expected the existing capture feature branch; do not switch automatically.'
}
git diff --cached --quiet
if ($LASTEXITCODE -ne 0) { throw 'Index is not empty; preserve and review existing staged work first.' }
$journalFiles = @(
    'client/src/api/imports.js'
    'client/src/components/analytics/AnalyticsBreakdown.jsx'
    'client/src/components/analytics/BreakdownChart.jsx'
    'client/src/components/analytics/EquityCurve.jsx'
    'client/src/components/analytics/PnLHistogram.jsx'
    'client/src/components/analytics/RDistribution.jsx'
    'client/src/components/analytics/SummaryCards.jsx'
    'client/src/components/analytics/TradingCalendar.jsx'
    'client/src/components/goals/goalTypes.js'
    'client/src/components/imports/CaptureSummary.jsx'
    'client/src/components/trades/FinancialCoverage.jsx'
    'client/src/components/trades/FinancialCoverage.test.jsx'
    'client/src/components/trades/TradeForm.jsx'
    'client/src/components/trades/TradeTable.jsx'
    'client/src/components/trades/tradeFormModel.js'
    'client/src/components/trades/tradeFormModel.test.js'
    'client/src/i18n/locales/en.js'
    'client/src/i18n/locales/he.js'
    'client/src/pages/AccountDetail.jsx'
    'client/src/pages/Accounts.jsx'
    'client/src/pages/Analytics.jsx'
    'client/src/pages/DailyReview.jsx'
    'client/src/pages/Dashboard.jsx'
    'client/src/pages/Import.jsx'
    'client/src/pages/Import.test.jsx'
    'client/src/pages/ImportRunDetail.jsx'
    'client/src/pages/Strategies.jsx'
    'client/src/pages/TradeDetail.jsx'
    'docs/capture-persistence-files.md'
    'docs/owner-capture-commits.md'
    'docs/source-aware-capture-import.md'
    'docs/source-aware-import-preview.md'
    'server/scripts/capture-persistence-sandbox.js'
    'server/scripts/capture-preview-sandbox.js'
    'server/scripts/check-capture-browser.mjs'
    'server/scripts/check-capture.js'
    'server/src/db/migrationRunner.test.js'
    'server/src/db/migrations/021_capture_persistence.sql'
    'server/src/importers/tradovateImporter.js'
    'server/src/routes/captureRoutes.test.js'
    'server/src/routes/importRoutes.js'
    'server/src/services/accountService.js'
    'server/src/services/analyticsService.js'
    'server/src/services/analyticsService.test.js'
    'server/src/services/capturePersistence.js'
    'server/src/services/captureService.js'
    'server/src/services/captureService.test.js'
    'server/src/services/goalsService.js'
    'server/src/services/importHistoryService.js'
    'server/src/services/importService.js'
    'server/src/services/strategiesService.js'
    'server/src/services/strategiesService.test.js'
    'server/src/services/tradeService.js'
    'server/src/utils/captureIdentity.js'
    'server/src/utils/sourceTimestamp.js'
    'server/test/capturePersistence.integration.test.js'
    'server/test/helpers/captureFixture.js'
    'server/test/helpers/localCaptureDb.js'
)
git add -- $journalFiles
if ($LASTEXITCODE -ne 0) { throw 'Staging failed.' }
git diff --cached --check
if ($LASTEXITCODE -ne 0) { throw 'Resolve staged diff errors before committing.' }
git diff --cached --stat
git diff --cached --name-only
git diff --cached
# After reviewing the exact staged diff:
git commit -m "feat(imports): persist source-aware captures with scoped reconciliation"
```

Migration 021 must accompany the code and follow 001-020 through the existing
runner. The command above neither migrates nor deploys anything. The normal
acceptance database is already migrated; production/shared databases were not.

## Trading Data Sync: Git prerequisite and initial source-only commit

This directory currently has **no .git directory and is not inside a Git
repository**. There is therefore no branch, baseline or feature diff to commit.
Do not pretend this is an incremental capture-only commit. The acceptance pass
changed only README.md and docs/capture-package-v1.md to describe confirmed
consumer persistence accurately; the collector/packager implementation is
unchanged. The feature-specific package files are src/capture-package.js,
scripts/package-capture.js, test/capture-package.test.js and the contract docs.

If this directory is intended to be a **new standalone repository**, the owner
can use the following explicit initial commit. This creates Git metadata only
when the owner runs it; no remote or push is configured. If an existing remote
history should be retained instead, restore that proper checkout first and
review its delta; do not run this initial-repository block over it.

The 29 selected files are source, manifests, blank environment example,
ignore rules, synthetic tests and documentation. docs/validation.json contains
sanitized historical check status, not raw account/financial responses. The
working website collection mechanism remains included and unchanged.

```powershell
Set-Location D:\code\trading-data-sync
if (Test-Path -LiteralPath .git) { throw 'Git metadata now exists; inspect its history before using initial-commit commands.' }
git rev-parse --show-toplevel 2>$null
if ($LASTEXITCODE -eq 0) { throw 'An enclosing repository now exists; inspect it before initialization.' }
git init -b main
if ($LASTEXITCODE -ne 0) { throw 'Repository initialization failed.' }
$collectorFiles = @(
    '.env.example'
    '.gitignore'
    'README.md'
    'docs/capture-package-v1.md'
    'docs/csv-format.md'
    'docs/validation.json'
    'docs/verification.md'
    'package-lock.json'
    'package.json'
    'scripts/live-check.js'
    'scripts/package-capture.js'
    'scripts/probe.js'
    'scripts/smoke.js'
    'scripts/verify-source.js'
    'src/browser.js'
    'src/capture-package.js'
    'src/cli.js'
    'src/command.js'
    'src/config.js'
    'src/errors.js'
    'src/storage.js'
    'src/tradovate/contract.js'
    'src/tradovate/navigation.js'
    'src/tradovate/provider.js'
    'src/tradovate/verification.js'
    'test/capture-package.test.js'
    'test/collector.test.js'
    'test/navigation.test.js'
    'test/verification.test.js'
)
git add -- $collectorFiles
if ($LASTEXITCODE -ne 0) { throw 'Staging failed.' }
git diff --cached --check
if ($LASTEXITCODE -ne 0) { throw 'Resolve staged diff errors before committing.' }
git diff --cached --stat
git diff --cached --name-only
git diff --cached
# After reviewing the exact staged diff:
git commit -m "feat: add Tradovate website collector and verified capture packages"
```

## Explicit exclusions and review limits

- Journal: `test-results/`, private acceptance settings/login, logs, screenshots,
  browser profiles, baseline extraction/junction, build/dependency output,
  `.env` files, imports/exports, database files/dumps and local Docker data.
- Collector: actual `.env`, `data/` (including all capture packages and raw reports),
  `.local/`, profiles/sessions, exports, logs and `node_modules/`.
- Synthetic fixture constants and the fixed disposable synthetic-DB password
  are test values, not user credentials. The separate real-capture acceptance
  uses generated private credentials and is not selected.
- No bank-data-sync files, new live collection, automatic delivery, scheduling,
  production/shared migrations, deployment or push is part of either commit.

The explicit selection was checked for private account identifiers, credentials,
tokens, raw capture content and accidental local artifacts. Generated evidence
and per-execution details remain local. This review cannot compare the collector
to an absent Git baseline; the initial-commit scope is stated explicitly above.
See [acceptance evidence and test results](source-aware-capture-import.md).
