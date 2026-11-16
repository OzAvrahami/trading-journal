import { createError } from '../middleware/errorHandler.js';

export function sourceTimestamp(value, offsetMinutes) {
  const fail = () => { throw createError('CAPTURE_TIMESTAMP_INVALID', 'Capture timestamp or verified numeric offset is invalid.', 400); };
  if (!Number.isInteger(offsetMinutes) || Math.abs(offsetMinutes) > 840) fail();
  const m = typeof value === 'string' && /^(\d{2})\/(\d{2})\/(\d{4}) (\d{2}):(\d{2}):(\d{2})$/.exec(value);
  if (!m) fail();
  const [, month, day, year, hour, minute, second] = m.map(Number);
  if (year < 100 || hour > 23 || minute > 59 || second > 59) fail();
  const wall = new Date(Date.UTC(year, month - 1, day, hour, minute, second));
  if (wall.getUTCFullYear() !== year || wall.getUTCMonth() !== month - 1 || wall.getUTCDate() !== day) fail();
  return new Date(wall.getTime() - offsetMinutes * 60000).toISOString();
}
