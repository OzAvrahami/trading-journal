# Source-aware capture persistence

Implemented on `feature/source-aware-import-preview`, without committing or
deploying. The v1 capture contract is unchanged; this milestone changes Trading
Journal only. Collector reports remain immutable. Initial database/browser
verification used synthetic data. The subsequent owner-authorized local
acceptance below persisted only the saved daily package in a separate database.

## Storage and migration

Apply **021_capture_persistence.sql** through the existing checksum/role-aware
migration runner, after migrations 001–020. Do not edit old migrations or bypass
the migration ledger. The migration:

- Makes `trades.fees` nullable and adds `source_managed` (false for existing rows).
  New capture trades explicitly store `fees = NULL`, `pnl_net = NULL` and no R
  result. A real zero remains zero. No historical timestamps, fees or keys change.
- Adds `capture_accounts` for the authenticated user's explicit internal/external
  mapping, scoped by provider, environment and external account ID. One external
  identity maps to one internal account per user; one provider identity maps to
  an internal account. Reassignment is a conflict, not an implicit move.
- Adds `source_captures` for package/CSV hashes, numeric verified offset, UTC
  capture time, report request/interval, requested IANA zone and evidence
  provenance. Financial observations retain their capture times even when an
  identical financial snapshot is reused.
- Adds `capture_trade_groups` and `capture_execution_pairs` for opening groups,
  complete buy/sell pair identities and canonical UTC execution evidence.
  Existing `import_run_rows` retains every physical row number and linked Trade.
  Deleted trades leave tombstones; re-import cannot silently recreate them.
- Adds `capture_financial_snapshots` for separately scoped currency, gross, actual
  aggregate fees, net, coverage, capture times and supporting hashes. Snapshots
  are immutable financial evidence, never summed by Analytics. Overlapping
  reports can coexist and are viewed individually in Import History.

New tables follow the server-owned, RLS-enabled/no-public-API-grants convention.
Reconciliation decisions stay in JavaScript. No raw HTML, credentials or session
secrets are stored. Normalized execution details are private financial data and
must be covered by the application's database access and backup controls. Hashes
prove integrity, not signed provider authenticity.

Deploying this code without migration 021 is unsupported. Migration was applied
only to a disposable loopback database during this work. Do not automatically
reverse the nullable-fee migration after storing unknown values; use a reviewed
restore/migration plan if rollback is needed.

## Reconciliation and confirmation

`/imports/parse` keeps authentication and active-account ownership checks. The
capture is validated by the completed v1 validator, then checked against the
selected account's mapping and existing source/legacy lineage. The UI shows new,
extended and unchanged groups and specific conflicts. Its candidate table shows
the resulting union of known and incoming members for the affected groups. The
financial card continues to describe the uploaded report's exact scope.

Confirmation stays in the existing `/imports/commit` flow. It binds the account
selected at preview and repeats the plan inside a transaction with a per-user
import advisory lock and a target-account row lock. Capture mapping, Import Run,
Trade updates, source pairs, provenance and financial snapshot references commit
together or roll back together. Legacy imports share the import lock and reject
overlap with source-managed execution IDs.

Pair identities use **both buyFillId and sellFillId**, inside the external mapping.
The existing Tradovate parser validates opening semantics and groups the union;
there is no second trade matcher. Known pairs with changed economics or instants
are conflicts. A new closing pair extends the same Trade with recomputed weighted
prices, quantity, gross and duration. Notes, risk, classification and other user
annotations are preserved. Source execution fields are read-only in normal Trade
editing; annotation-only updates do not recalculate gross or replace null fees.

Capture dedup keys are scoped source identities, independent of host timezone and
legacy timestamp keys. Distinct opening groups with identical prices/times remain
distinct. Exact repeat imports return the prior Run and add nothing. Repackaged
identical evidence can create a new provenance observation/Run while reusing the
same Trades and financial snapshot. Older/subset captures never shrink a group.

Legacy matching is deliberately conservative: a shared pair/fill in existing
lineage blocks automatic merge, because those records have unverified external
identity/offset and estimated fees. Existing trades in a relevant symbol without
reliable pair lineage also block. The conflict includes a Trade link where
available. There is no automatic legacy adoption, fee rewrite, timezone repair or
resolution wizard in this milestone. Review/correct the mapping or use a truly
separate account only when that reflects the intended ledger; do not duplicate
the same real history merely to bypass a conflict.

## Financial displays

Trade list/detail and CSV export distinguish unknown from zero; unknown CSV
fields are blank. Gross remains available. Summary, calendar, equity,
distributions, breakdowns, account/tracked balances, daily review, strategy/setup
metrics and goals report incomplete net coverage rather than treating a sum of
known net values as complete. Net-dependent rates and totals are unavailable when
the relevant closed-trade set includes unknown net. Complete breakdown groups
can still show their own net with an overall coverage notice.

The sourced financial card in each Import Run is the only place where a report's
aggregate net is shown. It is not injected into trade analytics, assigned to new
rows, distributed across trades or added to other snapshots. Calendar report
coverage remains distinct from a trading session. If source finance is absent,
source currency/fees/net remain unverified; choosing an internal account's base
currency does not add source evidence.

## Isolated verification commands

The database helper has a fixed loopback host/port/database/user, never reads
`.env`, and verifies its database identity before migration. Use only this named
disposable database for the integration commands:

```powershell
cd D:\code\trading-journal
# Create once; if already present, use: docker start journal-capture-local-20261116
docker run --name journal-capture-local-20261116 -e POSTGRES_USER=capture_test -e POSTGRES_PASSWORD=local-synthetic-only -e POSTGRES_DB=capture_test -p 127.0.0.1:55438:5432 -d postgres:17-alpine
$env:CAPTURE_DB_TEST='1'
node --test server/test/capturePersistence.integration.test.js
Remove-Item Env:\CAPTURE_DB_TEST
npm run build:client
node server/scripts/capture-persistence-sandbox.js
```

Open `http://127.0.0.1:4179/import`. Choose Tradovate → Saved collector capture,
select **Disposable capture test**, upload
`test-results/capture/synthetic.capture.json`, review, check the mapping
confirmation and confirm. The standalone harness runs the actual routes/auth/
services with a synthetic local user; its commit guard rejects private captures.
Each harness startup creates a fresh synthetic user. Stop the process with Ctrl+C.
In a second terminal, with the existing collector's Puppeteer installed:

```powershell
node server/scripts/check-capture-browser.mjs
```

Screenshots and aggregate check results stay in ignored `test-results/capture/`.
The database-free preview harness on port 4178 remains available; it always blocks
commit and has no database access. It is suitable for saved private previews.

Verification includes real PostgreSQL migrations/security, rollback after writes,
repeat/concurrent imports, overlapping and disjoint partial closes, legacy
conflicts, environment/user/target isolation, null versus zero, deleted-group
tombstones, annotation preservation, API export and browser confirmation.
Offline saved reports still verify 42 → 30 candidates and daily 15 → 13 with
927.50 gross − 188.00 sourced fees = 739.50 net USD. UTC and Asia/Jerusalem test
processes produce identical timestamps and scoped keys. These initial checks did
not persist real reports; the later local acceptance is recorded below.

The full server suite also exposes four unchanged `marketData.test.js` failures:
its token subject `market-data-test-user` is rejected by the existing UUID auth
validation. Those unrelated files were left unchanged. Dedicated legacy
database/security suites remain opt-in; this milestone's isolated integration
test independently runs the migration runner and catalog security verifier.
The targeted baseline comparison below substantiates the pre-existing failures.

Recorded results: 376 server tests passed with that unrelated file excluded
(three opt-in tests skipped); all 10 isolated PostgreSQL tests passed; all 297
client tests passed, with a final 23-test rerun covering the last UI changes.
The client build and English/Hebrew desktop/mobile browser checks passed. Build
warnings remain for the existing large bundle/stale Browserslist data and test
tooling deprecations. `git diff --check` passed. No commits or pushes were made.

## Local acceptance through the normal application (2026-11-16)

Completed between 13:28 and 13:34 UTC, using the existing saved daily package.
There was no new collection or production/shared database access. Only one new
dedicated local test user and one internal account were used, created through
the normal signup and Accounts UI. The external Simulation identity was reviewed
and explicitly confirmed in Import; it was not used as an internal account ID.

Isolation and startup:

- New Docker container `journal-capture-acceptance-20261116`, PostgreSQL 17.11,
  database/role `capture_acceptance`, published only at `127.0.0.1:55439` on its
  dedicated `journal-capture-acceptance-loopback` network. This is separate from
  the synthetic database on 55438. An initial internal-network setup did not
  publish the loopback port; it was corrected before any migrations or imports.
- Explicit connection settings were checked against `current_database()` and
  `current_user()`. The public schema was empty before the normal
  `server/src/db/migrate.js` runner applied all 21 migrations. The ledger has
  checksums through `021_capture_persistence.sql`; the security catalog verifier
  passed. No existing database was reused or rewritten.
- Normal `server/index.js` API on 3017 and normal Vite client on 5187, with
  `VITE_API_URL=http://127.0.0.1:3017` and matching `CLIENT_URL`. No synthetic
  harness, auto-login, mocked route or injected database pool was used. Child
  processes received allowlisted OS variables plus explicit local settings;
  repository `.env` files were not used for the API/migration connection.
- Random local credentials and JWT secret, browser evidence and read-only DB
  verification outputs live only under ignored `test-results/acceptance/`.
  The owner can read `review-login.txt` there locally. Do not commit that folder.

| Check | First import | After restarting API/client and identical UI import |
| --- | ---: | ---: |
| New trades | 13 | 0 |
| Updated trades | 0 | 0 |
| Persisted trades / opening groups | 13 / 13 | 13 / 13 |
| Execution pairs / linked source rows | 15 / 15 | 15 / 15 |
| External mappings / source captures | 1 / 1 | 1 / 1 |
| Financial snapshots / Import History runs | 1 / 1 | 1 / 1 |
| Trade fees and net | All 13 NULL | All 13 NULL |
| Separate report gross / sourced fees / net, USD | 927.50 / 188.00 / 739.50 | 927.50 / 188.00 / 739.50 |

Both attempts used normal authenticated UI upload, explicit target selection and
the mapping checkbox. Reloaded API/UI results and direct read-only DB checks
confirmed the mapping, all 15 source identifiers/Trade links, capture time,
package/CSV/evidence hashes, numeric +120 offset and exact calendar coverage.
Every stored entry/exit UTC instant and scoped key matched the existing parser.
Separate UTC and Asia/Jerusalem parser processes returned identical results.
The entire eight-table import state hash was identical before and after repeat;
only normal authentication/preferences activity was outside that comparison.
The source CSV/package remained unchanged. No per-trade fee allocation occurred.

The daily financial coverage is November 16 at the verified report offset:
`2026-11-15T22:00:00Z` through `2026-11-16T22:00:00Z`, exclusive end. This remains
a report calendar interval, not a claimed trading-session total. Capture times
and detailed execution evidence remain in the local saved artifacts/Import Run.

English and Hebrew/RTL Import History and unknown-net financial displays were
visually checked. One display defect was fixed: persisted evidence now has the
heading **Saved source capture**, rather than **Source-aware capture preview**,
with the equivalent Hebrew label. The repeat browser check passed with no page
errors. Focused Import, Import Run and i18n checks passed (19 tests); the client
build passed. The previously completed broader results above were reused. No
server business logic changed during this acceptance.

Review at `http://127.0.0.1:5187/import` while the local processes are running.
The private acceptance results contain the direct Import Run URL. To restart
the same explicitly configured local processes after stopping them, use
`node test-results/acceptance/local-runtime.mjs start`; check the ports first.
This ignored machine-local launcher starts the normal server/client, not a
preview harness. It is not a portable deployment command.

## Evidence that the four market-data failures predate this feature

The previous notes described the cause but did not include a baseline run.
On 2026-11-16, the committed baseline
`f6793c0177f2c3c8d9ad3c85f52d84624a7fd8dc`
(`docs: finalize v1.1.0 release preparation`) was extracted with `git archive`
under ignored `test-results/acceptance/baseline/`. It used the same installed
server dependencies through a local junction; no current source was copied over
the baseline. Both commands were run from the Journal root:

```powershell
node --test server/src/routes/marketData.test.js
node --test test-results/acceptance/baseline/server/src/routes/marketData.test.js
```

Each produced **5 tests: 1 pass, 4 fail**. Identical failures:

| Test | Expected | Baseline and feature |
| --- | ---: | ---: |
| Missing/empty symbols | 400 | 401 |
| Malformed symbol | 400 | 401 |
| Too many symbols | 400 | 401 |
| Parse/dispatch/normalized quotes | 200 | 401 |

The non-UUID subject `market-data-test-user` is rejected by the UUID check in
the unchanged authentication middleware, before quote dispatch. `git diff` is
empty for the route test, route, auth middleware and market-data service.
The baseline test mocks the quote fetch; these checks require no provider or
database access. Full logs are local in `market-data-baseline.log` and
`market-data-current.log` under the acceptance directory. No unrelated fix was
made. See [owner commit commands](owner-capture-commits.md) for file selection.

## Controlled first real import outside the acceptance database (not performed)

1. Prepare a separate **local or staging** Journal database, with a verified
   backup and an authenticated user/internal account. Use a reviewed local copy
   if testing compatibility with existing legacy records. Do not point the test
   harness or migrations at production. Inspect the database name and migration
   ledger first. Keep service connection settings private.
2. In a terminal at `D:\code\trading-journal`, explicitly set `DATABASE_URL` and
   `MIGRATION_DATABASE_URL` to that reviewed local database, set
   `DATABASE_ROLE`/`MIGRATION_DATABASE_ROLE` to its existing owner, and use
   `NODE_ENV=development`, `DATABASE_SSL_MODE=disable` and
   `MIGRATION_DATABASE_SSL_MODE=disable` for loopback only. Set `PORT=3001` and
   `CLIENT_URL=http://localhost:5173`; retain a private local `JWT_SECRET`.
   Run `npm run migrate` and confirm 021 is recorded. For non-loopback staging,
   use the existing verified TLS settings instead of disabling TLS.
3. Run `npm run dev:server` in that explicitly configured terminal. In a second
   terminal run `npm run dev:client`; sign in at `http://localhost:5173` normally.
   Do not use the synthetic auto-login harness for real evidence.
4. Open Import, choose Tradovate → Saved collector capture, and explicitly select
   the intended active internal account. Upload the validated saved daily
   package. Verify the intended external Simulation account ID/label, the report interval,
   +120-minute verified November offset, UTC capture time and USD 927.50 / 188.00
   / 739.50 summary. The original 42-row package must retain absent finance;
   never attach the refreshed 43-row summary to it.
5. Stop on any mapping, legacy, source correction, deleted-trade or currency
   conflict. Otherwise review new/extended/unchanged group counts, confirm the
   mapping checkbox and import once. Inspect the resulting Run, source rows,
   linked Trades and financial card; Trade fees/net should still be unknown.
6. Upload the same package again. Preview should show unchanged groups and
   confirmation must add no Trades or financial snapshot. Verify annotation
   preservation on a separately reviewed overlapping capture before expanding
   the range. Keep raw evidence and its hashes locally for later audit.

Remaining limitations: no automatic legacy adoption or account remapping; no
source correction/deletion resolution workflow; no per-trade fee allocation;
no combined aggregate net across reports; source integrity is not cryptographic
authenticity. Reconciliation currently loads the mapped account's execution
ledger into memory, so large ledgers need performance work before broad rollout.
The existing 5 MB upload, 20-row preview and in-process session/expiry limits remain.
The persistence milestone added no scheduling, delivery integration, production
migration or deployment. Subsequent CLI delivery reuses these unchanged routes;
see [Journal delivery acceptance](journal-delivery.md).
