# Changelog

This changelog starts with the current product baseline. GitHub has no published
Releases as of preparation on 2026-09-10. Historical tags are preserved; they do
not establish publication dates. The owner accepted `v1.0.0` as the first stable
baseline. The entry below is finalized for the preparation commit, not published.

## [1.0.0] — Accepted baseline, unpublished

Release date and final commit are pending owner publication. Product scope is
the repository through `bebce992cc710df7407c551a8052bf7ad0e333c7`, plus the
governance and release documentation in the pending owner commit.

### Features

- Account-based trade management with open/closed trades, fees, net PnL,
  R-multiples, filters, CSV export, and trade detail/editing workflows.
- Dashboard, trading calendar, equity curve, performance distributions and
  breakdowns, with user-timezone-aware dates and analytics.
- TopstepX and Tradovate CSV imports, account-scoped duplicate protection, and
  import history with bounded row diagnostics and links to imported trades.
- Journal entries, structured daily reviews, trading rules and adherence,
  goals, and managed strategies and setups.
- Trading and investment account groups with independent participation
  settings and explicit links to the internal investment portfolio ledger.
- Account-scoped Investments overview, holdings, transactions, dividends,
  performance, and allocation; ledger-based cash, cost basis, realized and
  unrealized PnL, and manual-price history grouped by currency.
- Finnhub quotes for eligible USD stocks and ETFs in current client-side
  investment valuation, with manual-price fallback and unavailable states.
- English/Hebrew interface, RTL support, responsive navigation, themes,
  preferences, and quick/full trade-entry modes.
- JWT authentication and refresh sessions, with server-side ownership checks.

### Enhancements and fixes

- Unified account and investment navigation and scoped investment views after
  the historical `v1.0.0-platform` checkpoint.
- Grouped Tradovate partial fills into logical trades and corrected empty
  account-filter handling when loading trades.
- Existing platform hardening includes transactional authentication changes,
  validation and upload error handling, client recovery states, and dependency
  updates. This is not a claim of a fresh security audit.
- Included the existing Supabase public-schema access-hardening migration and
  security catalog in source. Whether that migration is applied in production
  was not checked during this governance task.

### Maintenance and documentation

- Prepared canonical Issue Forms, disabled blank issues, and configured release
  note categories and exclusions.
- Aligned GitHub metadata, labels, Project fields, and development views with
  Oz GitHub Development Standard v1; recorded owner-confirmed workflow setup
  and the manual reopened-to-Ready fallback where necessary.
- Recorded version/deployment evidence and an owner-controlled release handoff.

### Scope and verification limits

- This is the accepted first stable GitHub Release baseline, not a claim that every
  feature was newly implemented during release preparation.
- Live quotes require server-side Finnhub configuration/provider availability.
  Historical performance remains based on transaction dates and recorded
  prices. No FX conversion, tax-lot accounting, broker synchronization, TWR,
  or XIRR is claimed.
- The deployed client and API were reported running at the product-scope SHA;
  homepage and health requests succeeded. Authenticated user journeys, database
  state, and quote-provider behavior were not tested in this phase.
- Only governance configuration was validated; no broad application suite was
  run. Project workflow configuration is owner-confirmed; automation behavior
  was not independently tested. Native reopened-to-Ready support was not
  separately confirmed; the manual fallback applies where necessary and is
  not a release blocker.
- The Supabase-to-Neon migration is not included as completed work. Future
  backlog creation and next-version planning have not started.

See [release evidence and publication steps](docs/release-baseline.md).
