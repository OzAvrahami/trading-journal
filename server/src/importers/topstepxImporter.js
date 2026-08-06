import { parse } from 'csv-parse/sync';
import { toNum, toISO, normalizeDirection, durationToMinutes } from '../utils/importUtils.js';

/**
 * TopstepX CSV importer.
 *
 * Expected columns:
 *   Id, ContractName, EnteredAt, ExitedAt, EntryPrice, ExitPrice,
 *   Fees, PnL, Size, Type, TradeDay, TradeDuration, Commissions
 *
 * Returns an array of raw (un-validated) normalised row objects.
 */
export function parseTopstepX(csvBuffer) {
  const records = parse(csvBuffer, {
    columns: true,         // use first row as header names
    skip_empty_lines: true,
    trim: true,
    relax_column_count: true, // tolerate slight column count mismatches
  });

  return records.map((row, index) => {
    const fees = toNum(row.Fees);
    const commissions = toNum(row.Commissions);
    const totalFees = fees + commissions;
    const pnlGross = toNum(row.PnL);

    return {
      _rowIndex: index + 2, // +2 because index 0 = header row, index 1 = first data row
      _sourceIdentifier: String(row.Id || '').trim().slice(0, 255) || null,
      symbol: (row.ContractName || '').trim().toUpperCase(),
      market: 'futures',
      direction: normalizeDirection(row.Type),
      entry_datetime: toISO(row.EnteredAt),
      exit_datetime: toISO(row.ExitedAt),
      entry_price: toNum(row.EntryPrice),
      exit_price: toNum(row.ExitPrice),
      quantity: toNum(row.Size),
      fees: totalFees,
      pnl_gross: pnlGross,
      pnl_net: parseFloat((pnlGross - totalFees).toFixed(4)),
      duration_minutes: durationToMinutes(row.TradeDuration),
      status: 'closed',
      notes: 'Imported from TopstepX',
      // Fields not available in TopstepX CSV
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
  });
}
