const DATE_KEY = /^(\d{4})-(\d{2})-(\d{2})/;
export const DEFAULT_TIMEZONE = 'Asia/Jerusalem';

export function normalizeDateKey(value) {
  if (!value) return null;
  const match = String(value).match(DATE_KEY);
  return match ? `${match[1]}-${match[2]}-${match[3]}` : null;
}

export function dateKeyParts(value) {
  const key = normalizeDateKey(value);
  if (!key) return null;
  const [year, month, day] = key.split('-').map(Number);
  return { key, year, month, day };
}

export function daysInMonth(year, month) {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

export function getMonthRange(value) {
  const parts = dateKeyParts(value);
  if (!parts) return null;
  const month = String(parts.month).padStart(2, '0');
  return {
    monthStart: `${parts.year}-${month}-01`,
    monthEnd: `${parts.year}-${month}-${String(daysInMonth(parts.year, parts.month)).padStart(2, '0')}`,
  };
}

export function addDaysToDateKey(value, amount) {
  const parts = dateKeyParts(value);
  if (!parts) return null;
  const date = new Date(Date.UTC(parts.year, parts.month - 1, parts.day + amount));
  return [date.getUTCFullYear(), String(date.getUTCMonth() + 1).padStart(2, '0'), String(date.getUTCDate()).padStart(2, '0')].join('-');
}

export function weekdayForDateKey(value) {
  const parts = dateKeyParts(value);
  if (!parts) return null;
  return new Date(Date.UTC(parts.year, parts.month - 1, parts.day)).getUTCDay();
}

export function formatDateKey(value, options = { month: 'short', day: 'numeric', year: 'numeric' }) {
  const parts = dateKeyParts(value);
  if (!parts) return '—';
  const safeLocalDate = new Date(parts.year, parts.month - 1, parts.day, 12);
  return new Intl.DateTimeFormat('en-US', options).format(safeLocalDate);
}

export function isValidTimezone(timezone) {
  if (typeof timezone !== 'string' || !timezone.trim() || timezone.trim().length > 64) return false;
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: timezone.trim() }).format();
    return true;
  } catch {
    return false;
  }
}

export function currentDateKey(timezone = DEFAULT_TIMEZONE, date = new Date()) {
  const safeTimezone = isValidTimezone(timezone) ? timezone.trim() : DEFAULT_TIMEZONE;
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: safeTimezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(date);
  const value = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${value.year}-${value.month}-${value.day}`;
}

export function localTodayKey(date = new Date(), timezone = DEFAULT_TIMEZONE) {
  return currentDateKey(timezone, date);
}

export function mondayForDateKey(value) {
  const weekday = weekdayForDateKey(value);
  if (weekday == null) return null;
  return addDaysToDateKey(value, -(weekday === 0 ? 6 : weekday - 1));
}

export function periodRange(period, timezone = DEFAULT_TIMEZONE, date = new Date()) {
  const to = currentDateKey(timezone, date);
  if (period === 'today') return { from: to, to };
  if (period === 'wtd') return { from: mondayForDateKey(to), to };
  return { from: `${to.slice(0, 7)}-01`, to };
}
