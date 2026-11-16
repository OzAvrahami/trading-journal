import { createHash } from 'node:crypto';
import { z } from 'zod';
import { parse } from 'csv-parse/sync';
import { sourceTimestamp } from '../utils/sourceTimestamp.js';
import { createError } from '../middleware/errorHandler.js';
import { parseImport } from './importService.js';

const text = z.string().min(1).max(255);
const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const offset = z.number().int().min(-840).max(840);
const metadata = z.object({
  provider: z.literal('tradovate'), environment: z.enum(['demo', 'live']),
  account: z.object({ id: z.string().regex(/^\d+$/).max(40), name: text }).strict(),
  capturedAt: z.string().datetime(), requestedTimezone: text, verifiedOffsetMinutes: offset,
  requestedRange: z.object({ from: date, to: date, inclusive: z.literal(true) }).strict(),
  request: z.object({ name: z.enum(['Performance', 'Cash History']), representationType: z.enum(['csv', 'html']),
    template: z.literal('Flex.html').optional(), timezone: offset,
    params: z.array(z.object({ name: z.enum(['account', 'startDate', 'endDate', 'startTime', 'endTime']), value: text }).strict()).min(3).max(5),
  }).strict(),
}).strict();
const artifact = z.object({ encoding: z.literal('base64'), sha256: z.string().regex(/^[a-f0-9]{64}$/),
  content: z.string().min(1).max(4 * 1024 * 1024), metadata }).strict();
const schema = z.object({ format: z.literal('tradovate-capture'), version: z.literal(1), performance: artifact,
  timestampEvidence: z.object({ method: z.literal('controlled-offset-comparison'), comparison: artifact }).strict(),
  financialEvidence: z.object({ performanceSha256: z.string().regex(/^[a-f0-9]{64}$/),
    coverage: z.literal('report-calendar-interval'), feeAllocation: z.literal('unallocated'),
    performanceSummary: artifact, cashHistory: artifact }).strict().nullable(),
}).strict();
const failure = (code, message) => { throw createError(code, message, 400); };
const requireValue = (condition, code, message) => { if (!condition) failure(code, message); };
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
const calendar = value => {
  const [y, m, d] = value.split('-');
  return `${m}/${d}/${y}`;
};
const addDay = value => new Date(Date.parse(sourceTimestamp(`${calendar(value)} 00:00:00`, 0)) + 86400000).toISOString().slice(0, 10);

function decode(item, reportName, representation) {
  const m = item.metadata;
  const request = m.request;
  requireValue(request.name === reportName && request.representationType === representation,
    'CAPTURE_METADATA_CONFLICT', 'Capture report type does not match its evidence role.');
  requireValue(m.verifiedOffsetMinutes === request.timezone,
    'CAPTURE_OFFSET_CONFLICT', 'Verified offset conflicts with the outgoing report offset.');
  try { new Intl.DateTimeFormat('en', { timeZone: m.requestedTimezone }); }
  catch { failure('CAPTURE_METADATA_INVALID', 'Requested IANA timezone is invalid.'); }
  const params = Object.fromEntries(request.params.map(p => [p.name, p.value]));
  requireValue(Object.keys(params).length === request.params.length && params.account === m.account.name
    && params.startDate === calendar(m.requestedRange.from) && params.endDate === calendar(addDay(m.requestedRange.to))
    && m.requestedRange.from <= m.requestedRange.to
    && (!params.startTime || params.startTime === '00:00:00') && (!params.endTime || params.endTime === '00:00:00'),
  'CAPTURE_METADATA_CONFLICT', 'Capture account or calendar report interval contradicts its outgoing request.');
  const bytes = Buffer.from(item.content, 'base64');
  requireValue(bytes.toString('base64') === item.content && hash(bytes) === item.sha256,
    'CAPTURE_HASH_MISMATCH', 'Capture evidence bytes do not match their SHA-256.');
  requireValue(Buffer.from(bytes.toString('utf8'), 'utf8').equals(bytes), 'CAPTURE_METADATA_INVALID', 'Capture must contain valid UTF-8.');
  return bytes;
}

const performanceHeaders = 'symbol,_priceFormat,_priceFormatType,_tickSize,buyFillId,sellFillId,qty,buyPrice,sellPrice,pnl,boughtTimestamp,soldTimestamp,duration'.split(',');
const cashHeaders = 'Account,Transaction ID,Timestamp,Date,Delta,Amount,Cash Change Type,Currency,Contract'.split(',');
function csv(bytes, expected) {
  try {
    const table = parse(bytes, { skip_empty_lines: true, trim: true });
    requireValue(table.length > 1 && JSON.stringify(table[0]) === JSON.stringify(expected), 'CAPTURE_CSV_INVALID', 'Capture CSV columns are not supported.');
    return table.slice(1).map(values => Object.fromEntries(expected.map((key, i) => [key, values[i]])));
  } catch (error) {
    if (error.statusCode) throw error;
    failure('CAPTURE_CSV_INVALID', 'Capture CSV is malformed.');
  }
}
function number(value) {
  requireValue(typeof value === 'string' && /^\$?(?:-?(?:\d+|\d{1,3}(?:,\d{3})+)(?:\.\d+)?|\((?:\d+|\d{1,3}(?:,\d{3})+)(?:\.\d+)?\))$/.test(value.trim()),
    'CAPTURE_FINANCIAL_INVALID', 'A required source number is missing or malformed.');
  const result = Number(value.replace(/[$,()]/g, '')) * (value.includes('(') ? -1 : 1);
  requireValue(Number.isFinite(result), 'CAPTURE_FINANCIAL_INVALID', 'Source number is outside the supported range.');
  return result;
}
const cents = value => {
  const scaled = number(value) * 100;
  requireValue(Number.isSafeInteger(Math.round(scaled)) && Math.abs(scaled - Math.round(scaled)) < 0.000001,
    'CAPTURE_FINANCIAL_INVALID', 'This capture format requires financial amounts in whole cents.');
  return Math.round(scaled);
};
const countBy = values => {
  const counts = new Map();
  for (const value of values) counts.set(value, (counts.get(value) || 0) + 1);
  return counts;
};
const equalCounts = (a, b) => a.size === b.size && [...a].every(([k, v]) => b.get(k) === v);
const pairKey = row => JSON.stringify([row.buyFillId, row.sellFillId]);
const scopeEqual = (a, b, sameOffset = true) => a.provider === b.provider && a.environment === b.environment
  && a.account.id === b.account.id && a.account.name === b.account.name
  && a.requestedRange.from === b.requestedRange.from && a.requestedRange.to === b.requestedRange.to
  && (!sameOffset || a.verifiedOffsetMinutes === b.verifiedOffsetMinutes);

function validateRows(rows, m) {
  for (const row of rows) {
    requireValue(row.symbol && row.buyFillId && row.sellFillId && number(row.qty) > 0,
      'CAPTURE_CSV_INVALID', 'Capture rows require symbol, fill identities and positive quantity.');
    for (const key of ['buyPrice', 'sellPrice', 'pnl']) number(row[key]);
    for (const key of ['boughtTimestamp', 'soldTimestamp']) sourceTimestamp(row[key], m.verifiedOffsetMinutes);
  }
}

function verifyComparison(pkg, rows) {
  const reference = pkg.timestampEvidence.comparison;
  const bytes = decode(reference, 'Performance', 'csv');
  const source = pkg.performance.metadata;
  const other = reference.metadata;
  requireValue(scopeEqual(source, other, false) && source.verifiedOffsetMinutes !== other.verifiedOffsetMinutes,
    'CAPTURE_OFFSET_CONFLICT', 'Offset evidence needs the same account/date arguments and a different report offset.');
  const referenceRows = csv(bytes, performanceHeaders);
  validateRows(referenceRows, other);
  const byPair = new Map(referenceRows.map(r => [pairKey(r), r]));
  requireValue(byPair.size === referenceRows.length, 'CAPTURE_OFFSET_CONFLICT', 'Comparison fill pairs must be unambiguous.');
  let shared = 0;
  for (const row of rows) {
    const comparison = byPair.get(pairKey(row));
    if (!comparison) continue; // Date windows can shift at their edges; identical record sets are not required.
    shared++;
    requireValue(performanceHeaders.every(key => ['boughtTimestamp', 'soldTimestamp'].includes(key)
      ? sourceTimestamp(row[key], source.verifiedOffsetMinutes) === sourceTimestamp(comparison[key], other.verifiedOffsetMinutes)
      : row[key] === comparison[key]), 'CAPTURE_OFFSET_CONFLICT', 'Shared fill-pair timestamps or economics contradict the verified offset.');
  }
  requireValue(shared > 0, 'CAPTURE_OFFSET_REQUIRED', 'No shared fill pairs establish timestamp semantics.');
  return { method: pkg.timestampEvidence.method, sharedPairs: shared, sourceRows: rows.length,
    comparisonRows: referenceRows.length, comparisonOffsetMinutes: other.verifiedOffsetMinutes,
    comparisonCapturedAt: other.capturedAt, comparisonSha256: reference.sha256 };
}

// Read fixed source table labels as inert text. Never render uploaded HTML.
function summaryMetrics(bytes) {
  const result = {};
  const clean = value => value.replace(/<[^>]*>/g, '').replace(/&amp;/g, '&').replace(/&nbsp;/g, ' ').trim();
  for (const match of bytes.toString('utf8').matchAll(/<tr\b[^>]*>([\s\S]*?)<\/tr>/gi)) {
    const cells = [...match[1].matchAll(/<td\b[^>]*>([\s\S]*?)<\/td>/gi)].map(m => clean(m[1]));
    if (cells.length === 2 && ['Gross P/L', 'Trade Fees & Comm.', 'Total P/L', '# of Trades', '# of Contracts'].includes(cells[0])) {
      requireValue(!Object.hasOwn(result, cells[0]), 'CAPTURE_FINANCIAL_INVALID', 'Ambiguous Performance summary labels.');
      result[cells[0]] = cells[1];
    }
  }
  requireValue(Object.keys(result).length === 5, 'CAPTURE_FINANCIAL_INVALID', 'Required Performance summary fields are missing.');
  return result;
}

function reconcileFinancial(pkg, rows) {
  const evidence = pkg.financialEvidence;
  if (!evidence) return null;
  const source = pkg.performance.metadata;
  requireValue(evidence.performanceSha256 === pkg.performance.sha256
    && scopeEqual(source, evidence.performanceSummary.metadata) && scopeEqual(source, evidence.cashHistory.metadata),
  'CAPTURE_FINANCIAL_CONFLICT', 'Financial evidence must cover this exact CSV, external account, environment, interval and offset.');
  const metrics = summaryMetrics(decode(evidence.performanceSummary, 'Performance', 'html'));
  const cash = csv(decode(evidence.cashHistory, 'Cash History', 'csv'), cashHeaders);
  const currencies = new Set(cash.map(r => r.Currency));
  requireValue(currencies.size === 1 && /^[A-Z]{3}$/.test(cash[0].Currency), 'CAPTURE_FINANCIAL_CONFLICT', 'Cash History must explicitly identify one currency.');
  const start = sourceTimestamp(`${calendar(source.requestedRange.from)} 00:00:00`, source.verifiedOffsetMinutes);
  const end = sourceTimestamp(`${calendar(addDay(source.requestedRange.to))} 00:00:00`, source.verifiedOffsetMinutes);
  const fills = new Map();
  const paired = [];
  for (const row of rows) {
    const buy = sourceTimestamp(row.boughtTimestamp, source.verifiedOffsetMinutes);
    const sell = sourceTimestamp(row.soldTimestamp, source.verifiedOffsetMinutes);
    requireValue(buy >= start && buy < end && sell >= start && sell < end,
      'CAPTURE_FINANCIAL_COVERAGE', 'Executions cross the financial report boundary; exact coverage is not established.');
    for (const [id, time] of [[row.buyFillId, buy], [row.sellFillId, sell]]) {
      const key = JSON.stringify([row.symbol, time]);
      requireValue(!fills.has(id) || fills.get(id) === key, 'CAPTURE_FINANCIAL_COVERAGE', 'Fill identity has contradictory financial coverage.');
      fills.set(id, key);
    }
    paired.push(JSON.stringify([row.symbol, buy > sell ? buy : sell, cents(row.pnl)]));
  }
  requireValue(new Set(rows.map(pairKey)).size === rows.length, 'CAPTURE_FINANCIAL_COVERAGE', 'Repeated fill pairs make financial coverage ambiguous.');
  const feeTypes = ['Exchange Fee', 'Clearing Fee', 'Nfa Fee', 'Commission'];
  const feeEvents = Object.fromEntries(feeTypes.map(k => [k, []]));
  const feeTotals = Object.fromEntries(feeTypes.map(k => [k, 0]));
  const cashPairs = [];
  const adjustments = {};
  const transactionIds = new Set();
  for (const row of cash) {
    const time = sourceTimestamp(row.Timestamp, source.verifiedOffsetMinutes);
    requireValue(row.Account === source.account.name && time >= start && time < end
      && row['Transaction ID'] && !transactionIds.has(row['Transaction ID']),
    'CAPTURE_FINANCIAL_COVERAGE', 'Cash History account, interval or transaction identity is inconsistent.');
    transactionIds.add(row['Transaction ID']);
    const kind = row['Cash Change Type'];
    const delta = cents(row.Delta);
    if (feeTypes.includes(kind)) {
      requireValue(delta <= 0, 'CAPTURE_FINANCIAL_COVERAGE', 'Fee credits require additional coverage evidence.');
      feeEvents[kind].push(JSON.stringify([row.Contract, time])); feeTotals[kind] -= delta;
    } else if (kind === 'Trade Paired') cashPairs.push(JSON.stringify([row.Contract, time, delta]));
    else adjustments[kind] = (adjustments[kind] || 0) + delta;
  }
  requireValue(equalCounts(countBy(paired), countBy(cashPairs)) && feeTypes.every(k => equalCounts(countBy(fills.values()), countBy(feeEvents[k]))),
    'CAPTURE_FINANCIAL_COVERAGE', 'Fees and paired cash entries do not cover the same execution times/contracts and event counts.');
  const gross = rows.reduce((sum, r) => sum + cents(r.pnl), 0);
  const fees = Object.values(feeTotals).reduce((a, b) => a + b, 0);
  const quantity = rows.reduce((sum, r) => sum + number(r.qty), 0);
  requireValue(cents(metrics['Gross P/L']) === gross && cents(metrics['Trade Fees & Comm.']) === -fees
    && cents(metrics['Total P/L']) === gross - fees && number(metrics['# of Trades']) === rows.length
    && number(metrics['# of Contracts']) === quantity * 2,
  'CAPTURE_FINANCIAL_CONFLICT', 'Performance summary, CSV and Cash History totals or record counts do not reconcile.');
  return { currency: cash[0].Currency, gross: gross / 100, tradingFees: fees / 100, net: (gross - fees) / 100,
    feeBreakdown: Object.fromEntries(Object.entries(feeTotals).map(([k, v]) => [k, v / 100])),
    otherCashAdjustments: Object.fromEntries(Object.entries(adjustments).map(([k, v]) => [k, v / 100])),
    coverage: evidence.coverage, allocation: 'unallocated', sourceRows: rows.length, uniqueFillCount: fills.size,
    identityLinkage: 'timestamp-contract-multiplicity-only',
    summaryCapturedAt: evidence.performanceSummary.metadata.capturedAt, cashCapturedAt: evidence.cashHistory.metadata.capturedAt,
    summarySha256: evidence.performanceSummary.sha256, cashSha256: evidence.cashHistory.sha256 };
}

export async function parseCapturePackage(buffer) {
  let raw;
  try { raw = JSON.parse(buffer.toString('utf8')); }
  catch { failure('CAPTURE_METADATA_INVALID', 'Capture package is not valid JSON.'); }
  const checked = schema.safeParse(raw);
  requireValue(checked.success, 'CAPTURE_METADATA_INVALID', 'Capture version, offset, provenance or financial metadata is missing or invalid.');
  const pkg = checked.data;
  const bytes = decode(pkg.performance, 'Performance', 'csv');
  const rows = csv(bytes, performanceHeaders);
  const source = pkg.performance.metadata;
  validateRows(rows, source);
  const timestampEvidence = verifyComparison(pkg, rows);
  const financial = reconcileFinancial(pkg, rows);
  const result = await parseImport('tradovate', bytes, { sourceOffsetMinutes: source.verifiedOffsetMinutes, sourceIdentity: source });
  // Canonical execution evidence for later union/reparse through the SAME importer.
  // Store explicit UTC wall fields; never parse these with a host-local Date.
  const utcWall = value => { const iso = sourceTimestamp(value, source.verifiedOffsetMinutes); return `${iso.slice(5,7)}/${iso.slice(8,10)}/${iso.slice(0,4)} ${iso.slice(11,19)}`; };
  const executions = rows.map(row => ({ ...row, boughtTimestamp: utcWall(row.boughtTimestamp), soldTimestamp: utcWall(row.soldTimestamp) }));
  return { ...result, previewOnly: true,
    executions,
    stats: { ...result.stats, candidateCount: result.stats.uniqueInFile, tradesToImport: 0 },
    source: { ...source, performanceSha256: pkg.performance.sha256, timestampEvidence, financial,
      warnings: [...(!financial ? ['financial-unavailable'] : ['fees-unallocated']),
        ...(timestampEvidence.sharedPairs < rows.length ? ['partial-timezone-comparison'] : [])] } };
}
