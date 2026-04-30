import { parse } from 'csv-parse/sync';
import { toNum, toISO, durationToMinutes } from '../utils/importUtils.js';

/**
 * Tradovate CSV importer.
 *
 * Expected columns:
 *   symbol, _priceFormat, _priceFormatType, _tickSize,
 *   buyFillId, sellFillId, qty, buyPrice, sellPrice,
 *   pnl, boughtTimestamp, soldTimestamp, duration
 *
 * Direction logic:
 *   sellPrice > buyPrice  → long  (bought low, sold high)
 *   sellPrice < buyPrice  → short (sold high, bought low)
 *   equal                 → long
 *
 * Tradovate does not report fees per-trade in this export format;
 * pnl is treated as net and fees are set to 0.
 *
 * Returns an array of raw (un-validated) normalised row objects.
 */
export function parseTradovate(csvBuffer) {
  const records = parse(csvBuffer, {
    columns: true,
    skip_empty_lines: true,
    trim: true,
    relax_column_count: true,
  });

  return records.map((row, index) => {
    const buyPrice  = toNum(row.buyPrice);
    const sellPrice = toNum(row.sellPrice);
    const pnlGross  = toNum(row.pnl);

    let direction;
    if (sellPrice > buyPrice) {
      direction = 'long';
    } else if (sellPrice < buyPrice) {
      direction = 'short';
    } else {
      direction = 'long';
    }

    return {
      _rowIndex: index + 2,
      symbol: (row.symbol || '').trim().toUpperCase(),
      market: 'futures',
      direction,
      entry_datetime: toISO(row.boughtTimestamp),
      exit_datetime: toISO(row.soldTimestamp),
      entry_price: buyPrice,
      exit_price: sellPrice,
      quantity: toNum(row.qty),
      fees: 0,
      pnl_gross: pnlGross,
      pnl_net: pnlGross,
      duration_minutes: durationToMinutes(row.duration),
      status: 'closed',
      notes: 'Imported from Tradovate',
      // Fields not available in Tradovate CSV
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
