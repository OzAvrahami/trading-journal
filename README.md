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
- PostgreSQL (local or Supabase)

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
cp .env.example server/.env
# Edit server/.env — set DATABASE_URL and JWT_SECRET
```

**Client:**
```bash
cp client/.env.example client/.env
# VITE_API_URL is already set to http://localhost:3001 for dev
```

### 3. Run migrations

Make sure your PostgreSQL database exists, then:

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

Without `DEMO_ANCHOR_DATE`, the command uses the current calendar date in the target user's IANA timezone. For a given user and anchor date, rerunning recreates the same logical fixtures.

The command backs up and resets only owned rows in `goals`, `rule_checks`, `trading_rules`, `journal_entry_trades`, `journal_entries`, `trades`, and `trading_accounts`. It preserves `users`, `refresh_tokens`, `schema_migrations`, login credentials, profile fields, timezone, and sessions. The resulting fixture contains 8 accounts, 53 closed trades, 4 open trades across 22 dates, 14 Journal entries, 8 rules with 44 checks, and 7 Goals. Production Analytics is validated before commit against 31 winners, 20 losers, 2 breakevens, $7,486 net PnL, $346 fees, approximately $141.25 expectancy, and approximately 1.70 profit factor.

Backups are written beneath ignored `server/.local/demo-seed-backups/`. To restore, review the JSON, map its sections back to the same tables, and restore in foreign-key order inside a manually reviewed transaction. No automatic restore or general database-wipe command is provided.

The design's positions, executions, portfolio transactions, holdings, lots, dividends, allocation, price/FX caches, notifications, import history, saved views, and portfolio-performance data are not seeded because those production domains do not exist.
