# Collector delivery through the existing import API

The Trading Data Sync `feature/journal-delivery` branch (from `7250aee`) uses
this Journal branch at `7daa7e4` without API, auth, importer, migration, UI or
business-logic changes. The manual upload flow remains intact.

The client uses existing application login/rotating refresh sessions, verifies
the explicitly selected owned internal account, sends the exact capture package
to `POST /api/imports/parse`, and calls `POST /api/imports/commit` only with its
explicit `--commit` flag. Source account/environment identity remains separate
from the internal account UUID. Validation, source lineage, financial coverage,
mapping conflicts and transactional persistence remain in existing services.

After an uncertain confirmation, the client re-previews/confirms identical bytes.
The existing per-user lock, external mapping and package hash provide idempotency;
no delivery-specific database table, endpoint or idempotency bypass was added.
Tokens/cookies stay only in client memory. The collector has no Journal signing
secret, DB credentials or direct database writes. Receipts live in the collector's
ignored `data/deliveries/` and contain only allowlisted identity/outcome fields.

## Acceptance (2026-11-16)

A new isolated loopback database `journal_delivery` on port 55440, Docker container
`journal-delivery-local-20261116`, was verified empty before the normal migrations
001-021. The normal API runs on 3018 and Vite client on 5188. No production/shared
database or synthetic preview harness was used. Existing local acceptance
instances were left untouched. Test DB credentials/JWT signing secret exist only
under ignored Journal `test-results/delivery/`, never in the collector environment.

- Real CLI preview wrote no trades/captures/financial snapshots. First saved daily
  commit wrote 13 trades, 15 source-lineage rows, one mapping/capture/run/snapshot.
  Trade fees/net are NULL; report finance is 927.50 / 188.00 / 739.50 USD.
- Restarted normal server/client; same-package CLI repeat returned the same run
  with zero additions. Read-only DB checks found an identical eight-table import
  state hash, including timestamps, keys and evidence.
- A separate local user tested loss of the first successful 13-trade HTTP commit
  response. Retrying the identical bytes reconciled one run and no duplicate
  trades or financial snapshot. Negative tests covered missing authentication,
  wrong credentials, foreign account, incompatible owned mapping and bad evidence.
- Real access-token expiry/refresh rotation passed using short-lived local test
  tokens. Normal manual capture upload/explicit confirmation also passed after
  the CLI changes, including Hebrew RTL and persisted financial display.
- One complete Simulation collection -> packaging -> HTTP delivery command
  succeeded. CSV captured `2026-11-16T14:48:04.652Z`, same-day calendar scope;
  the new evidence independently reconciled 927.50 / 188.00 / 739.50 USD. All 15
  pairs matched the UTC comparison. These executions already existed, so the
  new observation created a second capture/run and reused the single financial
  snapshot, with no additional trades. It did not double aggregate totals.

Final primary-account state is 13 trades, 15 unique pairs, two source captures/
History runs, 30 observation-lineage rows and one financial snapshot. All trade
fees/net remain unknown. The new report was not forced to match an old total;
source activity happened to leave these figures unchanged.

The focused server regression command passed 10/10:

```powershell
node --test server/src/routes/captureRoutes.test.js server/src/services/captureService.test.js
```

Previous broader server/client/build results are reused because Journal runtime
code is unchanged. The four baseline market-data failures remain separately
documented in [capture acceptance](source-aware-capture-import.md); they were not
repaired or rerun for this delivery milestone. The collector tests and documented
limitations are in `D:\code\trading-data-sync\docs\journal-delivery.md`.

Review the normal local application at `http://127.0.0.1:5188/import`. Private
test login and exact run evidence remain local. For another instance, configure
separate Journal login credentials and deliberately select its internal account.
The consumer still requires migration 021; delivery introduces no new migration.
No deployment, scheduling, automatic commits or pushes were performed.
