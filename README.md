# Trading Journal

A production-grade Day Trading Journal web application.

## Stack

- **Frontend:** React + Vite + TailwindCSS + TanStack Query + Recharts
- **Backend:** Node.js + Express + PostgreSQL
- **Auth:** JWT (access token + httpOnly refresh cookie)

## Project Structure

```
trading-journal/
  client/   → React + Vite (JavaScript)
  server/   → Node.js + Express (JavaScript)
  shared/   → Zod schemas, constants, calculation utils
```

## Quick Start

### Prerequisites

- Node.js 20+
- PostgreSQL (intentional local development, or a separately verified Neon database)

### 1. Clone and install

```bash
git clone <repo>
cd trading-journal

# Install all dependencies
npm run install:all
```

### 2. Configure environment

**Server:**
```bash
cp server/.env.example server/.env
# Edit server/.env: runtime/direct migration URLs, explicit roles/TLS and JWT_SECRET
```

**Client:**
```bash
cp client/.env.example client/.env
# VITE_API_URL is already set to http://localhost:3001 for dev
```

### 3. Run migrations

Create the intended empty database and roles following the
[connection and initialization guide](docs/neon-initialization.md), then:

```bash
npm run migrate
```

### 4. Start development servers

Open two terminals:

```bash
# Terminal 1 — API server (port 3001)
npm run dev:server

# Terminal 2 — Vite dev server (port 5173)
npm run dev:client
```

Open http://localhost:5173

## API Endpoints

| Method | Route | Auth | Description |
|--------|-------|------|-------------|
| POST | `/api/auth/signup` | Public | Register |
| POST | `/api/auth/login` | Public | Login |
| POST | `/api/auth/refresh` | Cookie | Rotate token |
| POST | `/api/auth/logout` | Bearer | Logout |
| GET | `/api/me` | Bearer | Get profile |
| PATCH | `/api/me` | Bearer | Update profile |
| GET | `/api/trades` | Bearer | List trades |
| POST | `/api/trades` | Bearer | Create trade |
| GET | `/api/trades/export` | Bearer | Download CSV |
| GET | `/api/trades/:id` | Bearer | Get trade |
| PATCH | `/api/trades/:id` | Bearer | Update trade |
| DELETE | `/api/trades/:id` | Bearer | Delete trade |
| GET | `/api/analytics/summary` | Bearer | Stats |
| GET | `/api/analytics/equity-curve` | Bearer | Cumulative PnL |
| GET | `/api/analytics/distribution` | Bearer | PnL histogram |
| GET | `/api/analytics/breakdown` | Bearer | Group by dimension |

## Features

- **Authentication** — Signup / Login / Logout with JWT + refresh tokens
- **Trades CRUD** — Full trade management optimized for day trading
- **Dashboard** — Today/WTD/MTD PnL, equity curve, PnL distribution, performance breakdown
- **Filters** — Date presets, symbol, market, direction, strategy, outcome
- **CSV Export** — Download all filtered trades as CSV
- **Security** — Helmet, CORS, rate limiting, Zod validation, parameterized SQL

## Database security boundary

Application data follows one trusted path:

```text
Browser -> Express API -> trusted PostgreSQL connection -> PostgreSQL
```

The browser must not access application tables through a provider Data API. Public application tables use policy-free Row Level Security; Express enforces the authenticated user boundary and explicitly assumes the dedicated application owner role. This trusted backend has strong rights over its own objects. A non-owner with table grants alone is not compatible with this RLS model. See the [role and verification contract](docs/neon-initialization.md).

`DATABASE_URL`, operator-only `MIGRATION_DATABASE_URL`, JWT secrets, and provider API keys are server-only credentials. Never give a secret a `VITE_` prefix because Vite exposes `VITE_*` values to browser bundles. Only non-secret client configuration such as `VITE_API_URL` may use that prefix. Remote database connections verify certificates and hostnames; plaintext is restricted to explicit loopback development. No Supabase SDK or Supabase URL/key is required by the application.

## Computed Fields

Server calculates these automatically on every create/update:

| Field | Formula |
|-------|---------|
| `pnlGross` | `(exitPrice - entryPrice) × quantity` (long) |
| `pnlNet` | `pnlGross - fees` |
| `rMultiple` | `pnlNet / riskAmount` |
| `durationMinutes` | `(exitTime - entryTime) / 60` |
| `status` | `'open'` if no exit, `'closed'` otherwise |

## Date and Time Convention

- Each user has one IANA timezone. Existing and new users default to `Asia/Jerusalem`.
- A product calendar day runs from 00:00 in that timezone to the start of the next local day. Inclusive `from`/`to` date filters are implemented as a half-open timestamp interval: `>=` local midnight on `from` and `<` local midnight on the day after `to`.
- Week-to-date starts on Monday. Calendar grids may remain Sunday-first.
- Trade analytics, trade lists, exports, and trade-backed Goals continue to attribute timestamps by `entry_datetime` for backward compatibility. They do not claim exchange-local or New York-session semantics.
- `journal_entries.entry_date`, `rule_checks.check_date`, Goal start/end dates, and other PostgreSQL `DATE` values remain date-only calendar values; they are not converted through UTC timestamps.
- Per-account timezones, exchange timezones, market-session dates, and exit-date attribution are deferred.

Stored timestamps and historical records are not rewritten. Timezone-aware filtering and grouping can move previously displayed results near midnight to a different calendar day while leaving the source record unchanged.

## Demo data reset and seed

`npm run seed:demo` is a development-only, destructive reset for one explicitly selected user's domain data. It is forbidden when `NODE_ENV=production`, never runs automatically, and creates a local JSON backup before opening the reset transaction.

Required environment variables:

```powershell
$env:DEMO_USER_EMAIL="user@example.com"
$env:DEMO_RESET_CONFIRM="RESET_MY_DEMO_DATA"
```

Optional deterministic anchor date:

```powershell
$env:DEMO_ANCHOR_DATE="2026-08-04"
```

Optional demo-content locale (defaults to English):

```powershell
$env:DEMO_LOCALE="he" # supported: en, he
```

`DEMO_LOCALE` changes only human-readable fixture content such as account names, trade notes, Journal entries, Daily Review details, Rules, Goals, Portfolio names, Instrument names, and investment notes. It does not read or change the user's application language preference. IDs, relationships, symbols, company names, enum keys, dates, timestamps, numeric values, Account groups and participation, Account-to-investment links, and Analytics/Goals KPI contracts remain identical. Every demo Account uses USD, has a deterministic opening balance, exactly one active Account is the default, and an archived Account retains historical Trades and its linked investment history. Unsupported or blank locale values fail before backup, transaction start, deletion, or insertion.

Without `DEMO_ANCHOR_DATE`, the command uses the current calendar date in the target user's IANA timezone. For a given user and anchor date, rerunning recreates the same logical fixtures.

The command backs up and resets only owned rows in `investment_prices`, `investment_transactions`, `investment_instruments`, `investment_portfolios`, `import_run_rows`, `import_runs`, `goals`, `rule_checks`, `trading_rules`, `journal_entry_trades`, `daily_review_details`, `journal_entries`, `trades`, `setups`, `strategies`, and `trading_accounts`. Investment prices and Transactions are removed before their Instruments and Portfolios; Import history is removed before its referenced Trades and Accounts; Trades are removed before managed classifications; and every delete remains explicitly scoped by `user_id`. It preserves `users`, `user_preferences`, `refresh_tokens`, `schema_migrations`, login credentials, profile fields, timezone, application language, theme, Trade Editor mode, and sessions. Preferences are neither included as resettable backup data nor seeded. The resulting fixture contains 8 accounts, 5 managed Strategies, 10 managed Setups, 53 closed trades, 4 open trades across 22 dates, 3 Import Runs with 8 bounded row results, 14 Journal entries with 4 structured Daily Reviews, 8 rules with 44 checks, 7 Goals, 3 investment Portfolios, 6 Instruments, 17 investment Transactions, and 13 manual prices across multiple historical dates. Import rows link to existing seeded Trades and create no extra Trade. A deterministic subset of Trades remains intentionally unlinked to demonstrate historical free-text values. Production Analytics is validated before commit against 31 winners, 20 losers, 2 breakevens, $7,486 net PnL, $346 fees, approximately $141.25 expectancy, and approximately 1.70 profit factor.

Backups are written beneath ignored `server/.local/demo-seed-backups/`. To restore, review the JSON, map its sections back to the same tables, and restore in foreign-key order inside a manually reviewed transaction. No automatic restore or general database-wipe command is provided.

Import History stores no uploaded file and no complete raw CSV row. It retains only bounded operational metadata: file identity and SHA-256, safe mapping choices, source row number, normalized symbol/source identifier, stable result/error codes, bounded diagnostics, and nullable links to imported Trades.

Accounts are the visible real-world scope for both Trading and Investments. Account groups organize Personal Investments, Active Trading, and Prop Firm Accounts, while independent participation flags control Investment Value, Personal Net Worth metadata, and cross-account Trading Analytics. An investment-enabled Account links one-to-one to the existing internal investment Portfolio ledger; historical Portfolios may remain unlinked until the user deliberately connects one, and no name matching is performed.

The investment ledger remains a separate long-term domain and never writes to or reads from day-trading `trades`. Holdings, moving weighted-average cost, cash, realized and unrealized PnL, dividends, and valuation are replayed from investment Transactions and manual prices and are not persisted as snapshots. Prices are explicitly manual and are not live market data. Each investment Account has one base currency, and no FX conversion or cross-currency total is performed. These calculations are application tracking conventions, not tax accounting; tax lots, executions, broker synchronization, corporate actions, portfolio imports, and market-data caches are not implemented.

The Investments workspace presents Overview, Holdings, Transactions, Dividends, Performance, and Allocation over owned investment-enabled Accounts. A shared `accountId` query scope selects one linked Account; omitting it uses active included Accounts and groups all monetary results by currency. Historical performance is reconstructed from exact investment Transaction dates and the latest manually recorded price on or before each point date. Missing prices make valuation and allocation unavailable rather than being treated as zero. Recorded dividends are historical payments only; the workspace does not calculate forecasts, benchmarks, TWR, XIRR, FX conversions, sector allocation, or live values.
