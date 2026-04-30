/**
 * Remove currency symbols, commas, and whitespace, then parse to float.
 * Returns 0 if the value cannot be parsed.
 */
export function toNum(value) {
  if (value == null || value === '') return 0;
  const cleaned = String(value).replace(/[$,\s]/g, '');
  const num = parseFloat(cleaned);
  return isNaN(num) ? 0 : num;
}

/**
 * Parse various date/datetime string formats to an ISO 8601 UTC string.
 * Returns null if parsing fails or the value is empty.
 *
 * Handles common broker export formats:
 *  - "2024-01-15T09:31:00"
 *  - "1/15/2024 9:31 AM"
 *  - "2024-01-15 09:31:00"
 *  - ISO strings with timezone offsets
 */
export function toISO(value) {
  if (!value || String(value).trim() === '') return null;

  const str = String(value).trim();

  // Strip common trailing timezone text that Date() can't parse ("CT", "ET", "PT")
  const clean = str.replace(/\s+(CT|ET|PT|MT|CST|EST|PST|MST|CDT|EDT|PDT|MDT)$/i, '').trim();

  const d = new Date(clean);
  if (!isNaN(d.getTime())) return d.toISOString();

  return null;
}

/**
 * Normalize broker direction strings to "long" or "short".
 */
export function normalizeDirection(value) {
  if (!value) return 'long';
  const lower = String(value).toLowerCase().trim();
  if (lower === 'short' || lower === 's' || lower === 'sell') return 'short';
  return 'long';
}

/**
 * Parse a duration string to whole minutes.
 *
 * Supported formats:
 *  - "H:MM:SS"  or  "HH:MM:SS"   →  hours * 60 + minutes + round(seconds / 60)
 *  - "MM:SS"                       →  minutes + round(seconds / 60)
 *  - "1h 30m", "90m"              →  text with h/m units
 *  - Plain number                  →  treated as seconds → converted to minutes
 *
 * Returns null if the value is empty or unparseable.
 */
export function durationToMinutes(value) {
  if (!value || String(value).trim() === '') return null;

  const str = String(value).trim();

  // H:MM:SS or HH:MM:SS
  const hmsMatch = str.match(/^(\d+):(\d{2}):(\d{2})$/);
  if (hmsMatch) {
    const h = parseInt(hmsMatch[1], 10);
    const m = parseInt(hmsMatch[2], 10);
    const s = parseInt(hmsMatch[3], 10);
    return h * 60 + m + Math.round(s / 60);
  }

  // MM:SS
  const msMatch = str.match(/^(\d+):(\d{2})$/);
  if (msMatch) {
    const m = parseInt(msMatch[1], 10);
    const s = parseInt(msMatch[2], 10);
    return m + Math.round(s / 60);
  }

  // "1h 30m", "90m", "2h", etc.
  const textMatch = str.match(/(?:(\d+)\s*h(?:rs?)?)?\s*(?:(\d+)\s*m(?:in)?)?/i);
  if (textMatch && (textMatch[1] || textMatch[2])) {
    const h = parseInt(textMatch[1] || '0', 10);
    const m = parseInt(textMatch[2] || '0', 10);
    return h * 60 + m;
  }

  // Plain number — assume seconds
  const num = parseFloat(str);
  if (!isNaN(num)) return Math.round(num / 60);

  return null;
}

/**
 * Build a normalised composite deduplication key for a trade row.
 * Used for both within-file and DB duplicate detection.
 * Normalises numbers to fixed precision and dates to UTC ISO strings.
 */
export function buildDedupKey(row) {
  const norm = (n) =>
    n != null && n !== '' && !isNaN(parseFloat(n))
      ? parseFloat(n).toFixed(8)
      : 'null';

  const normDate = (d) => {
    if (!d) return 'null';
    const parsed = new Date(d);
    return isNaN(parsed.getTime()) ? 'null' : parsed.toISOString();
  };

  return [
    (row.symbol || '').trim().toUpperCase(),
    normDate(row.entry_datetime),
    normDate(row.exit_datetime),
    norm(row.entry_price),
    norm(row.exit_price),
    norm(row.quantity),
  ].join('|');
}
