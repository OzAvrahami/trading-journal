# Feature branch changed-file inventory

This lists the complete uncommitted source-aware feature, including retained preview-milestone files. No collector files changed during the persistence milestone. Generated reports, screenshots and test data are ignored under `test-results/`.

## server/src/db

- `server/src/db/migrationRunner.test.js`
- `server/src/db/migrations/021_capture_persistence.sql`

## server/src/services

- `server/src/services/accountService.js`
- `server/src/services/analyticsService.js`
- `server/src/services/analyticsService.test.js`
- `server/src/services/capturePersistence.js`
- `server/src/services/captureService.js`
- `server/src/services/captureService.test.js`
- `server/src/services/goalsService.js`
- `server/src/services/importHistoryService.js`
- `server/src/services/importService.js`
- `server/src/services/strategiesService.js`
- `server/src/services/strategiesService.test.js`
- `server/src/services/tradeService.js`

## server/src/routes

- `server/src/routes/captureRoutes.test.js`
- `server/src/routes/importRoutes.js`

## server/src/importers

- `server/src/importers/tradovateImporter.js`

## server/src/utils

- `server/src/utils/captureIdentity.js`
- `server/src/utils/sourceTimestamp.js`

## server/test

- `server/test/capturePersistence.integration.test.js`
- `server/test/helpers/captureFixture.js`
- `server/test/helpers/localCaptureDb.js`

## server/scripts

- `server/scripts/capture-persistence-sandbox.js`
- `server/scripts/capture-preview-sandbox.js`
- `server/scripts/check-capture-browser.mjs`
- `server/scripts/check-capture.js`

## client/src

- `client/src/api/imports.js`
- `client/src/components/analytics/AnalyticsBreakdown.jsx`
- `client/src/components/analytics/BreakdownChart.jsx`
- `client/src/components/analytics/EquityCurve.jsx`
- `client/src/components/analytics/PnLHistogram.jsx`
- `client/src/components/analytics/RDistribution.jsx`
- `client/src/components/analytics/SummaryCards.jsx`
- `client/src/components/analytics/TradingCalendar.jsx`
- `client/src/components/goals/goalTypes.js`
- `client/src/components/imports/CaptureSummary.jsx`
- `client/src/components/trades/FinancialCoverage.jsx`
- `client/src/components/trades/FinancialCoverage.test.jsx`
- `client/src/components/trades/TradeForm.jsx`
- `client/src/components/trades/TradeTable.jsx`
- `client/src/components/trades/tradeFormModel.js`
- `client/src/components/trades/tradeFormModel.test.js`
- `client/src/i18n/locales/en.js`
- `client/src/i18n/locales/he.js`
- `client/src/pages/AccountDetail.jsx`
- `client/src/pages/Accounts.jsx`
- `client/src/pages/Analytics.jsx`
- `client/src/pages/DailyReview.jsx`
- `client/src/pages/Dashboard.jsx`
- `client/src/pages/Import.jsx`
- `client/src/pages/Import.test.jsx`
- `client/src/pages/ImportRunDetail.jsx`
- `client/src/pages/Strategies.jsx`
- `client/src/pages/TradeDetail.jsx`

## docs

- `docs/capture-persistence-files.md`
- `docs/owner-capture-commits.md`
- `docs/source-aware-capture-import.md`
- `docs/source-aware-import-preview.md`
