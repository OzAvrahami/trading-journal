# Source-aware capture preview

The initial preview milestone extended the existing Tradovate route, grouping,
lineage and UI. Capture persistence is now implemented; see
[capture persistence](source-aware-capture-import.md) for the current flow,
migration requirements, conflict handling and controlled first-import steps.
The database-free harness below still blocks all commits. No existing imported
data is automatically reinterpreted.

## Local preview without a database

From `D:\code\trading-journal`:

```powershell
npm run build:client
node server/scripts/capture-preview-sandbox.js
```

Open `http://127.0.0.1:4178/import`. Choose **Tradovate**, then **Saved collector capture**,
select the **Local preview only — SYNTHETIC** target account,
and upload a saved `.capture.json` package. Use the regular English/Hebrew control
to inspect RTL. Start Over to inspect another capture. Stop with Ctrl+C.

The sandbox binds only to loopback, loads no `.env`, uses an ephemeral JWT and a
synthetic internal account, and denies all database connections and operations
except allowlisted preview/authentication/ownership reads answered from memory. It runs the
actual import router, authentication middleware, parser and built client. This
is a standalone developer harness, not a production authentication bypass. The
normal API retains its real authentication and active-account ownership checks.

To validate a saved package offline without any server:

```powershell
node server/scripts/check-capture.js <path-to-saved.capture.json>
```

The checker prints aggregate results and a digest of UTC timestamps/dedup keys,
not detailed trades. Capture files and screenshots stay local outside this repo.
The packaging CLI and full v1 contract live in trading-data-sync at
`scripts/package-capture.js` and `docs/capture-package-v1.md`.

## Behavior and limits

- Explicit `MM/DD/YYYY HH:mm:ss` source timestamps plus a verified numeric offset
  produce UTC instants before direction, grouping, duration and key generation.
  No host timezone, runtime global TZ setting, or blanket +02:00 assumption is
  used. The requested IANA timezone remains separate metadata.
- A different-offset report verifies shared fill pairs and economic values.
  Shifted date windows may have different record sets. Partial shared coverage
  is disclosed. The evidence does not establish offsets for other DST periods.
- Gross P&L is shown per candidate. Unallocated fees and net are explicitly
  unknown (`null`); the legacy 0.95 estimate is not used in this flow.
- Optional aggregate finances require matching CSV hash, external account,
  environment, calendar interval/offset, source summary totals/counts and Cash
  History execution coverage. Missing finances are a visible warning; malformed
  or contradictory finances/offsets block preview. No fee allocation is inferred.
- Aggregate coverage uses contract/time/event multiplicity, not a proven mapping
  between cash transaction IDs and fill IDs. Other cash adjustments are separate.
  The UI never calls calendar totals trading-session totals.
- The original 42-row CSV remains financially unknown. A refreshed 43-row
  summary cannot reconcile with it, even if someone rewrites the package's
  financial hash reference. Hashes detect corruption, not source impersonation.
- The database-free harness has no existing transactions for duplicate detection;
  the normal API now plans reconciliation against stored source lineage. Packages are limited by the existing 5 MB upload
  limit, and the UI retains the existing 20-candidate preview limit.

## Verification

```powershell
# Repository root: synthetic fixtures, no real database
node --test server/src/services/captureService.test.js server/src/routes/captureRoutes.test.js server/src/importers/tradovateImporter.test.js server/test/importUtils.test.js server/src/routes/importRoutes.test.js server/src/services/importHistoryService.test.js server/src/middleware/auth.test.js

# From client/
npm test -- --run src/pages/Import.test.jsx src/i18n/i18n.test.jsx
```

Tests exercise host UTC/Jerusalem subprocess equality, general numeric offsets,
grouping/lineage, unknown fees/net, invalid evidence, authentication/ownership,
commit rejection, legacy CSV behavior, English/Hebrew and explicit target choice.
UTC/Jerusalem are test-process environments only; application code never changes
the process timezone.

Private saved-evidence validation also confirmed 42 physical rows -> 30 candidates
and the daily 15 rows -> 13 candidates, with identical timestamp/key digests under
both host zones. The daily source reconciles gross 927.50 minus sourced fees
188.00 to net 739.50 USD. Neither original source CSV was rewritten. Real browser
checks of the actual local API/UI covered both packages, English, Hebrew RTL and
mobile, with unknown trade fees/net and the import action disabled.

## Files in this milestone

| Area | Files |
| --- | --- |
| Parsing | `server/src/utils/sourceTimestamp.js`, `server/src/services/captureService.js`, `server/src/importers/tradovateImporter.js`, `server/src/services/importService.js` |
| Authenticated API | `server/src/routes/importRoutes.js` |
| UI | `client/src/api/imports.js`, `client/src/pages/Import.jsx`, `client/src/components/imports/CaptureSummary.jsx`, `client/src/i18n/locales/en.js`, `client/src/i18n/locales/he.js` |
| Regression tests | `server/test/helpers/captureFixture.js`, `server/src/services/captureService.test.js`, `server/src/routes/captureRoutes.test.js`, `client/src/pages/Import.test.jsx` |
| Local tools/docs | `server/scripts/check-capture.js`, `server/scripts/capture-preview-sandbox.js`, this document |
| Collector additions | `src/capture-package.js`, `scripts/package-capture.js`, `test/capture-package.test.js`, `docs/capture-package-v1.md`, README link |

## Follow-up persistence milestone

Persistence and source reconciliation are now implemented in migration 021 and
the existing import confirmation flow. Per-trade fees/net remain unknown.
See [the current milestone](source-aware-capture-import.md) for verification and
remaining explicit conflict-resolution limitations. The old database-free
harness retains its commit block independently of the production route.
