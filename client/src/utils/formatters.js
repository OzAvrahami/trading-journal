const LRI = '\u2066';
const FSI = '\u2068';
const PDI = '\u2069';
const EMPTY_VALUE = '—';

export function isolateLtr(value) {
  return `${LRI}${value}${PDI}`;
}

export function isolateAuto(value) {
  return `${FSI}${value}${PDI}`;
}

export function formatLtrText(value) {
  if (value == null || value === '') return EMPTY_VALUE;
  return isolateLtr(String(value));
}

export function rawCurrency(value, opts = {}) {
  if (value == null) return EMPTY_VALUE;
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
    ...opts,
  }).format(value);
}

/** Format a number as directionally isolated USD currency. */
export function formatCurrency(value, opts = {}) {
  const formatted = rawCurrency(value, opts);
  return formatted === EMPTY_VALUE ? formatted : isolateLtr(formatted);
}

export function rawDate(value) {
  if (!value) return EMPTY_VALUE;
  return new Date(value).toLocaleDateString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric',
  });
}

/** Format a date while allowing the full mixed-direction expression to remain intact. */
export function formatDate(value) {
  const formatted = rawDate(value);
  return formatted === EMPTY_VALUE ? formatted : isolateAuto(formatted);
}

export function rawDatetime(value) {
  if (!value) return EMPTY_VALUE;
  return new Date(value).toLocaleString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

/** Format a date and time as one directionally isolated expression. */
export function formatDatetime(value) {
  const formatted = rawDatetime(value);
  return formatted === EMPTY_VALUE ? formatted : isolateAuto(formatted);
}

export function rawDuration(minutes) {
  if (minutes == null) return EMPTY_VALUE;
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;
  return remainingMinutes > 0 ? `${hours}h ${remainingMinutes}m` : `${hours}h`;
}

export function formatDuration(minutes) {
  const formatted = rawDuration(minutes);
  return formatted === EMPTY_VALUE ? formatted : isolateLtr(formatted);
}

export function rawPct(value, decimals = 1) {
  if (value == null) return EMPTY_VALUE;
  return `${(value * 100).toFixed(decimals)}%`;
}

export function formatPct(value, decimals = 1) {
  const formatted = rawPct(value, decimals);
  return formatted === EMPTY_VALUE ? formatted : isolateLtr(formatted);
}

export function rawR(value) {
  if (value == null) return EMPTY_VALUE;
  return `${value >= 0 ? '+' : ''}${value.toFixed(2)}R`;
}

export function formatR(value) {
  const formatted = rawR(value);
  return formatted === EMPTY_VALUE ? formatted : isolateLtr(formatted);
}

/** Return semantic Tailwind color classes for a PnL value. */
export function pnlColor(value) {
  if (value == null) return 'text-muted';
  if (value > 0) return 'text-positive';
  if (value < 0) return 'text-negative';
  return 'text-muted';
}
