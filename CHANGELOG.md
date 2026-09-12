# Changelog

This changelog starts with the first stable product baseline. Preparation on
2026-09-10 preceded publication; its validation limits are retained below.
Historical tags are preserved and do not establish publication dates.

## [Unreleased]

### Maintenance and security

- TJ-02: explicit verified-TLS PostgreSQL configuration, bounded connections and
  timeouts, intentional loopback development, and a separate direct migration
  connection with an explicit application owner role.
- Remove the unused Supabase wrapper/SDK and its exclusive dependencies; retain
  `pg` and application-owned JWT/refresh authentication.
- Serialize migration execution and record each file atomically with its schema
  changes. Preserve SQL 001–017 and existing ledger timestamps; add checksum
  checks, explicit bootstrap assumptions, forward validation of trade constraints
  and global/per-schema creator default-privilege hardening.
- Reject sessions for nonexistent users before protected work, expire invalid
  refresh cookies, and clear stale client authentication/query state without
  treating network/server failures as invalid credentials. Discard late responses
  across session changes and share concurrent refresh requests.
- Add secret-free configuration examples, fresh initialization/role instructions
  and focused local connection, migration, security and authentication tests.

These changes are prepared locally for review, not deployed or released. Neon
provisioning/initialization remains TJ-03; complete financial/workflow validation,
production launch and operational recovery gates remain downstream. All package
versions remain `1.0.0`. Historical Supabase data is intentionally not imported;
new Neon records must be preserved. The dated baseline evidence below is unchanged.

## [1.0.0] — 2026-09-10

Published [v1.0.0](https://github.com/OzAvrahami/trading-journal/releases/tag/v1.0.0)
at `2026-09-10T18:53:07Z`, stable, non-draft, and Latest at reconciliation.
Release commit: `9434cda9b8b225b6615e31bad379c3de63d4ea4e`. Product scope is
the code through `bebce992cc710df7407c551a8052bf7ad0e333c7`, plus the governance
and release documentation in that owner commit. No application code changed
between those commits.

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
- The Supabase-to-Neon migration is not included as completed work. At release
  preparation, its backlog had not been created. Subsequent planning is tracked
  in [v1.1.0 — Neon Migration](https://github.com/OzAvrahami/trading-journal/milestone/1)
  and [the migration backlog](docs/neon-migration-backlog.md). Implementation had
  not started at that planning snapshot; subsequent work is recorded under
  Unreleased above. Package versions remain `1.0.0`.

See [release evidence and publication steps](docs/release-baseline.md).
