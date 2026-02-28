/**
 * Format a number as USD currency.
 */
export function formatCurrency(value, opts = {}) {
  if (value == null) return '—';
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
    ...opts,
  }).format(value);
}

/**
 * Format a date string to a readable date.
 */
export function formatDate(value) {
  if (!value) return '—';
  return new Date(value).toLocaleDateString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric',
  });
}

/**
 * Format a datetime string to readable date + time.
 */
export function formatDatetime(value) {
  if (!value) return '—';
  return new Date(value).toLocaleString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

/**
 * Format duration in minutes to a human-readable string.
 */
export function formatDuration(minutes) {
  if (minutes == null) return '—';
  if (minutes < 60) return `${minutes}m`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m > 0 ? `${h}h ${m}m` : `${h}h`;
}

/**
 * Format a decimal ratio as a percentage string.
 */
export function formatPct(value, decimals = 1) {
  if (value == null) return '—';
  return `${(value * 100).toFixed(decimals)}%`;
}

/**
 * Format an R-multiple value.
 */
export function formatR(value) {
  if (value == null) return '—';
  return `${value >= 0 ? '+' : ''}${value.toFixed(2)}R`;
}

/**
 * Return Tailwind color classes for a PnL value.
 */
export function pnlColor(value) {
  if (value == null) return 'text-gray-400';
  if (value > 0) return 'text-green-400';
  if (value < 0) return 'text-red-400';
  return 'text-gray-400';
}
