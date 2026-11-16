import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { parseCapturePackage } from '../src/services/captureService.js';

// Offline saved-evidence verification. No .env, app startup, network or database calls.
try {
  if (!process.argv[2]) throw new Error('CAPTURE_PATH_REQUIRED');
  const result = await parseCapturePackage(await readFile(process.argv[2]));
  const deterministic = result.rows.map(({ entry_datetime, exit_datetime, _dedupKey }) => ({ entry_datetime, exit_datetime, _dedupKey }));
  console.log(JSON.stringify({ sourceRows: result.stats.sourceRowCount, candidates: result.stats.candidateCount,
    previewOnly: result.previewOnly, tradeFeesAndNetUnknown: result.rows.every(r => r.fees === null && r.pnl_net === null),
    aggregate: result.source.financial ? { currency: result.source.financial.currency, gross: result.source.financial.gross,
      fees: result.source.financial.tradingFees, net: result.source.financial.net } : null,
    utcTimestampAndKeySha256: createHash('sha256').update(JSON.stringify(deterministic)).digest('hex'), warnings: result.source.warnings }));
} catch (error) { console.error(error.code || 'CAPTURE_CHECK_FAILED'); process.exitCode = 1; }
