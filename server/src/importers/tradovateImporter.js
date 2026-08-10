import { parse } from 'csv-parse/sync';
import { createError } from '../middleware/errorHandler.js';
import { toNum, toISO, durationToMinutes } from '../utils/importUtils.js';

// Tradovate charges $0.95 per contract as shown in the UI (Fees & Comm / Contracts).
// IMPORTANT: CSV `qty` is per-side (one leg). A round-trip trade of 1 contract
// has qty=1 in the CSV but counts as 2 in the Tradovate UI "Contracts" total.
// Full fee per CSV row = qty * 2 * FEE_PER_CONTRACT.
const FEE_PER_CONTRACT = 0.95;

function asFillId(value) {
  return value == null ? '' : String(value).trim();
}

function round(value, decimals = 4) {
  return parseFloat(Number(value).toFixed(decimals));
}

function sourceMember(rowIndex, buyFillId, sellFillId, physicalDuplicate = false) {
  return {
    rowIndex,
    buyFillId,
    sellFillId,
    sourceIdentifier: [buyFillId, sellFillId].filter(Boolean).join(':').slice(0, 255) || null,
    physicalDuplicate,
  };
}

function sourceConflict(message, rowIndexes) {
  return createError('IMPORT_SOURCE_CONFLICT', message, 400, { rowIndexes });
}

function executionSignature(execution) {
  return JSON.stringify({
    symbol: execution.symbol,
    direction: execution.direction,
    buyPrice: execution.buyPrice,
    sellPrice: execution.sellPrice,
    quantity: execution.quantity,
    pnlGross: execution.pnlGross,
    boughtDatetime: execution.boughtDatetime,
    soldDatetime: execution.soldDatetime,
    durationMinutes: execution.durationMinutes,
  });
}

function openingSignature(execution) {
  return JSON.stringify({
    symbol: execution.symbol,
    direction: execution.direction,
    entryDatetime: execution.entryDatetime,
    entryPrice: execution.entryPrice,
  });
}

function aggregateExecutions(executions) {
  const first = executions[0];
  const quantity = round(executions.reduce((sum, execution) => sum + execution.quantity, 0), 8);
  const entryValue = executions.reduce((sum, execution) => sum + execution.entryPrice * execution.quantity, 0);
  const exitValue = executions.reduce((sum, execution) => sum + execution.exitPrice * execution.quantity, 0);
  const pnlGross = round(executions.reduce((sum, execution) => sum + execution.pnlGross, 0));
  const fees = round(executions.reduce((sum, execution) => sum + execution.fees, 0));
  const pnlNet = round(pnlGross - fees);
  const entryDatetime = executions.reduce(
    (earliest, execution) => execution.entryDatetime < earliest ? execution.entryDatetime : earliest,
    first.entryDatetime,
  );
  const exitDatetime = executions.reduce(
    (latest, execution) => execution.exitDatetime > latest ? execution.exitDatetime : latest,
    first.exitDatetime,
  );
  const durationMinutes = entryDatetime && exitDatetime
    ? Math.floor((new Date(exitDatetime) - new Date(entryDatetime)) / 60000)
    : null;
  const sourceMembers = executions.flatMap((execution) => execution.sourceMembers);

  return {
    _rowIndex: first.rowIndex,
    _sourceIdentifier: first.sourceMembers[0].sourceIdentifier,
    _sourceMembers: sourceMembers,
    symbol: first.symbol,
    market: 'futures',
    direction: first.direction,
    entry_datetime: entryDatetime,
    exit_datetime: exitDatetime,
    entry_price: quantity ? round(entryValue / quantity, 8) : first.entryPrice,
    exit_price: quantity ? round(exitValue / quantity, 8) : first.exitPrice,
    quantity,
    fees,
    pnl_gross: pnlGross,
    pnl_net: pnlNet,
    duration_minutes: durationMinutes,
    status: 'closed',
    notes: 'Imported from Tradovate',
    strategy: null,
    setup: null,
    timeframe: null,
    risk_amount: null,
    stop_loss: null,
    take_profit: null,
    r_multiple: null,
    emotions: null,
    screenshot_links: null,
  };
}

/**
 * Tradovate CSV importer.
 *
 * Expected columns:
 *   symbol, _priceFormat, _priceFormatType, _tickSize,
 *   buyFillId, sellFillId, qty, buyPrice, sellPrice,
 *   pnl, boughtTimestamp, soldTimestamp, duration
 *
 * Direction logic:
 *   soldTimestamp < boughtTimestamp  → short (sold first to open, bought to close)
 *   boughtTimestamp ≤ soldTimestamp  → long  (bought first to open, sold to close)
 *
 * Returns one normalized logical Trade candidate per validated opening fill.
 * Physical source-row lineage remains private in `_sourceMembers` for import history.
 */
export function parseTradovate(csvBuffer) {
  const records = parse(csvBuffer, {
    columns: true,
    skip_empty_lines: true,
    trim: true,
    relax_column_count: true,
  });

  const executions = [];
  const executionPairs = new Map();

  for (const [index, row] of records.entries()) {
    const rowIndex = index + 2;
    const buyFillId = asFillId(row.buyFillId);
    const sellFillId = asFillId(row.sellFillId);
    const buyPrice  = toNum(row.buyPrice);
    const sellPrice = toNum(row.sellPrice);
    const qty       = toNum(row.qty);
    const pnlGross  = toNum(row.pnl);
    const fees      = parseFloat((qty * 2 * FEE_PER_CONTRACT).toFixed(2));
    const pnlNet    = parseFloat((pnlGross - fees).toFixed(2));

    // Direction is determined by execution order: whichever leg happened first is the opening leg.
    const soldMs   = new Date(row.soldTimestamp).getTime();
    const boughtMs = new Date(row.boughtTimestamp).getTime();
    const direction = soldMs < boughtMs ? 'short' : 'long';

    // For shorts: SELL opened the position (entry) and BUY closed it (exit).
    // For longs:  BUY opened the position (entry) and SELL closed it (exit).
    const boughtDatetime = toISO(row.boughtTimestamp);
    const soldDatetime = toISO(row.soldTimestamp);
    const entryDatetime = direction === 'short' ? soldDatetime   : boughtDatetime;
    const exitDatetime  = direction === 'short' ? boughtDatetime : soldDatetime;
    const entryPrice    = direction === 'short' ? sellPrice                  : buyPrice;
    const exitPrice     = direction === 'short' ? buyPrice                   : sellPrice;

    const execution = {
      rowIndex,
      buyFillId,
      sellFillId,
      symbol: (row.symbol || '').trim().toUpperCase(),
      direction,
      boughtDatetime,
      soldDatetime,
      buyPrice,
      sellPrice,
      entryDatetime,
      exitDatetime,
      entryPrice,
      exitPrice,
      quantity: qty,
      fees,
      pnlGross,
      pnlNet,
      durationMinutes: durationToMinutes(row.duration),
      sourceMembers: [sourceMember(rowIndex, buyFillId, sellFillId)],
    };

    // A repeated buy/sell execution pair is a physical source duplicate, not a partial fill.
    if (buyFillId && sellFillId) {
      const pairKey = `${buyFillId}\u0000${sellFillId}`;
      const existing = executionPairs.get(pairKey);
      if (existing) {
        if (executionSignature(existing) !== executionSignature(execution)) {
          throw sourceConflict(
            'Tradovate contains conflicting rows for the same buy/sell execution pair.',
            [existing.rowIndex, rowIndex],
          );
        }
        existing.sourceMembers.push(sourceMember(rowIndex, buyFillId, sellFillId, true));
        continue;
      }
      executionPairs.set(pairKey, execution);
    }

    executions.push(execution);
  }

  const openingIdentities = new Map();
  const groups = new Map();

  for (const execution of executions) {
    const openingSide = execution.direction === 'short' ? 'sell' : 'buy';
    const openingFillId = execution.direction === 'short' ? execution.sellFillId : execution.buyFillId;
    let groupKey = `row:${execution.rowIndex}`;

    if (openingFillId) {
      const identityKey = `${openingSide}:${openingFillId}`;
      const signature = openingSignature(execution);
      const existing = openingIdentities.get(identityKey);
      if (existing && existing.signature !== signature) {
        throw sourceConflict(
          'Tradovate contains conflicting rows for the same opening execution.',
          [existing.rowIndex, execution.rowIndex],
        );
      }
      openingIdentities.set(identityKey, existing ?? { signature, rowIndex: execution.rowIndex });
      groupKey = identityKey;
    }

    const group = groups.get(groupKey);
    if (group) group.push(execution);
    else groups.set(groupKey, [execution]);
  }

  return [...groups.values()].map(aggregateExecutions);
}
