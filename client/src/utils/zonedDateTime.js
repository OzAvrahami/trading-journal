import { isValidTimezone } from './dateOnly.js';

const LOCAL_DATETIME = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/;

function partsAt(instant, timezone) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: timezone,
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(instant);
  return Object.fromEntries(parts.map(({ type, value }) => [type, value]));
}

export function instantToLocalDateTime(value, timezone) {
  if (!value || !isValidTimezone(timezone)) return '';
  const instant = new Date(value);
  if (Number.isNaN(instant.getTime())) return '';
  const parts = partsAt(instant, timezone);
  return `${parts.year}-${parts.month}-${parts.day}T${parts.hour}:${parts.minute}`;
}

export function localDateTimeToInstant(value, timezone) {
  const match = LOCAL_DATETIME.exec(value || '');
  if (!match || !isValidTimezone(timezone)) return null;
  const [, year, month, day, hour, minute] = match;
  const desired = Date.UTC(+year, +month - 1, +day, +hour, +minute, 0);
  const calendarCheck = new Date(desired);
  if (
    calendarCheck.getUTCFullYear() !== +year || calendarCheck.getUTCMonth() !== +month - 1
    || calendarCheck.getUTCDate() !== +day || +hour > 23 || +minute > 59
  ) return null;

  let candidate = desired;
  for (let attempt = 0; attempt < 4; attempt += 1) {
    const parts = partsAt(new Date(candidate), timezone);
    const represented = Date.UTC(+parts.year, +parts.month - 1, +parts.day, +parts.hour, +parts.minute, 0);
    const adjustment = desired - represented;
    candidate += adjustment;
    if (adjustment === 0) break;
  }

  return instantToLocalDateTime(new Date(candidate), timezone) === value
    ? new Date(candidate).toISOString()
    : null;
}

export function currentLocalDateTime(timezone, now = new Date()) {
  return instantToLocalDateTime(now, timezone);
}
