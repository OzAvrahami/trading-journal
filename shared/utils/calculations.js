/**
 * Pure computation helpers for trade fields.
 * Safe to use on both server and client — no DB access, no side effects.
 */

/**
 * Calculate gross PnL.
 * Long:  (exitPrice - entryPrice) * quantity
 * Short: (entryPrice - exitPrice) * quantity
 */
export function calcPnlGross(direction, entryPrice, exitPrice, quantity) {
  if (exitPrice == null) return null;
  const diff = direction === 'long'
    ? exitPrice - entryPrice
    : entryPrice - exitPrice;
  return parseFloat((diff * quantity).toFixed(4));
}

/**
 * Calculate net PnL after fees.
 */
export function calcPnlNet(pnlGross, fees = 0) {
  if (pnlGross == null) return null;
  return parseFloat((pnlGross - fees).toFixed(4));
}

/**
 * Calculate R-multiple: pnlNet / riskAmount
 */
export function calcRMultiple(pnlNet, riskAmount) {
  if (pnlNet == null || !riskAmount || riskAmount === 0) return null;
  return parseFloat((pnlNet / riskAmount).toFixed(4));
}

/**
 * Calculate trade duration in whole minutes.
 */
export function calcDurationMinutes(entryDatetime, exitDatetime) {
  if (!exitDatetime) return null;
  return Math.floor((new Date(exitDatetime) - new Date(entryDatetime)) / 60000);
}

/**
 * Determine trade status.
 */
export function calcStatus(exitDatetime) {
  return exitDatetime ? 'closed' : 'open';
}

/**
 * Compute all derived fields at once from raw trade input.
 * Returns an object ready to merge into a trade record.
 */
export function computeTradeFields({
  direction,
  entryPrice,
  exitPrice,
  quantity,
  fees,
  riskAmount,
  entryDatetime,
  exitDatetime,
}) {
  const pnlGross = calcPnlGross(direction, entryPrice, exitPrice, quantity);
  const pnlNet = calcPnlNet(pnlGross, fees);
  const rMultiple = calcRMultiple(pnlNet, riskAmount);
  const durationMinutes = calcDurationMinutes(entryDatetime, exitDatetime);
  const status = calcStatus(exitDatetime);
  return { pnlGross, pnlNet, rMultiple, durationMinutes, status };
}
