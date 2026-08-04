import pool from '../db/client.js';

export const DEFAULT_TIMEZONE = 'Asia/Jerusalem';
const DATE_KEY = /^(\d{4})-(\d{2})-(\d{2})$/;

export function isValidDateKey(value) {
  const match = typeof value === 'string' ? value.match(DATE_KEY) : null;
  if (!match) return false;
  const [, yearText, monthText, dayText] = match;
  const year = Number(yearText);
  const month = Number(monthText);
  const day = Number(dayText);
  const parsed = new Date(Date.UTC(year, month - 1, day));
  return parsed.getUTCFullYear() === year
    && parsed.getUTCMonth() === month - 1
    && parsed.getUTCDate() === day;
}

export function mapPostgresDate(value) {
  if (value == null) return null;
  if (!isValidDateKey(value)) {
    throw new TypeError('Expected PostgreSQL DATE as an exact YYYY-MM-DD string.');
  }
  return value;
}

export function normalizeTimezone(value) {
  return typeof value === 'string' ? value.trim() : value;
}

export function isValidTimezone(value) {
  const timezone = normalizeTimezone(value);
  if (typeof timezone !== 'string' || timezone.length === 0 || timezone.length > 64) return false;
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: timezone }).format();
    return true;
  } catch {
    return false;
  }
}

export function assertTimezone(value) {
  const timezone = normalizeTimezone(value);
  if (!isValidTimezone(timezone)) throw new RangeError('Expected a valid IANA timezone.');
  return timezone;
}

export async function getUserTimezone(userId, queryable = pool) {
  const result = await queryable.query('SELECT timezone FROM users WHERE id = $1', [userId]);
  const timezone = normalizeTimezone(result.rows[0]?.timezone);
  return isValidTimezone(timezone) ? timezone : DEFAULT_TIMEZONE;
}

export function dateKeyInTimezone(timezone, instant = new Date()) {
  const validTimezone = assertTimezone(timezone);
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: validTimezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(instant);
  const value = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${value.year}-${value.month}-${value.day}`;
}

export function addDaysToDateKey(value, amount) {
  if (!isValidDateKey(value)) throw new RangeError('Expected a valid YYYY-MM-DD date.');
  const [year, month, day] = value.split('-').map(Number);
  const date = new Date(Date.UTC(year, month - 1, day + amount));
  return [
    date.getUTCFullYear(),
    String(date.getUTCMonth() + 1).padStart(2, '0'),
    String(date.getUTCDate()).padStart(2, '0'),
  ].join('-');
}

export function mondayOfDateKey(value) {
  if (!isValidDateKey(value)) throw new RangeError('Expected a valid YYYY-MM-DD date.');
  const [year, month, day] = value.split('-').map(Number);
  const weekday = new Date(Date.UTC(year, month - 1, day)).getUTCDay();
  return addDaysToDateKey(value, -(weekday === 0 ? 6 : weekday - 1));
}

export function monthStartDateKey(value) {
  if (!isValidDateKey(value)) throw new RangeError('Expected a valid YYYY-MM-DD date.');
  return `${value.slice(0, 7)}-01`;
}

function zonedParts(instant, timezone) {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: timezone,
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23',
  }).formatToParts(instant);
  return Object.fromEntries(parts.map((part) => [part.type, part.value]));
}

// Used for deterministic boundary verification. Production SQL uses PostgreSQL's
// timezone database through AT TIME ZONE for filtering and grouping.
export function localDateStartInstant(value, timezone) {
  if (!isValidDateKey(value)) throw new RangeError('Expected a valid YYYY-MM-DD date.');
  const validTimezone = assertTimezone(timezone);
  const [year, month, day] = value.split('-').map(Number);
  const desired = Date.UTC(year, month - 1, day);
  let candidate = desired;

  for (let attempt = 0; attempt < 4; attempt += 1) {
    const parts = zonedParts(new Date(candidate), validTimezone);
    const represented = Date.UTC(
      Number(parts.year), Number(parts.month) - 1, Number(parts.day),
      Number(parts.hour), Number(parts.minute), Number(parts.second),
    );
    const adjustment = desired - represented;
    candidate += adjustment;
    if (adjustment === 0) return new Date(candidate);
  }

  const finalParts = zonedParts(new Date(candidate), validTimezone);
  if (`${finalParts.year}-${finalParts.month}-${finalParts.day}` !== value
    || finalParts.hour !== '00' || finalParts.minute !== '00') {
    throw new RangeError(`Local midnight is not representable in ${validTimezone} on ${value}.`);
  }
  return new Date(candidate);
}

export function addTimestampDateRange({ conditions, params, column, from, to, timezone }) {
  if (from && !isValidDateKey(from)) throw new RangeError('Expected a valid from date.');
  if (to && !isValidDateKey(to)) throw new RangeError('Expected a valid to date.');
  if (from && to && from > to) throw new RangeError('End date must not precede start date.');
  const validTimezone = assertTimezone(timezone);
  let timezonePlaceholder = null;
  const add = (value) => {
    params.push(value);
    return `$${params.length}`;
  };
  const timezoneParam = () => {
    if (!timezonePlaceholder) timezonePlaceholder = add(validTimezone);
    return timezonePlaceholder;
  };

  if (from) {
    const dateParam = add(from);
    conditions.push(`${column} >= (${dateParam}::date::timestamp AT TIME ZONE ${timezoneParam()})`);
  }
  if (to) {
    const dateParam = add(to);
    conditions.push(`${column} < ((${dateParam}::date + 1)::timestamp AT TIME ZONE ${timezoneParam()})`);
  }
  return timezonePlaceholder;
}

export function ensureTimezoneParameter(params, timezone, currentPlaceholder = null) {
  if (currentPlaceholder) return currentPlaceholder;
  params.push(assertTimezone(timezone));
  return `$${params.length}`;
}

export function localDateSql(timestampColumn, timezonePlaceholder) {
  return `(${timestampColumn} AT TIME ZONE ${timezonePlaceholder})::date`;
}
