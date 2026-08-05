import { activeLocale, formattingLocale } from '../i18n/index.js';
import { formatDateKey, normalizeDateKey } from './dateOnly.js';

const LRI = '\u2066';
const FSI = '\u2068';
const PDI = '\u2069';
const EMPTY_VALUE = '—';

function normalizeZero(value) {
  return value === 0 ? 0 : value;
}

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

export function rawCurrency(value, opts = {}, locale = activeLocale()) {
  if (value == null) return EMPTY_VALUE;
  const normalizedValue = normalizeZero(value);
  return new Intl.NumberFormat(formattingLocale(locale), {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
    ...opts,
  }).format(normalizedValue);
}

/** Format a number as directionally isolated USD currency. */
export function formatCurrency(value, opts = {}) {
  const formatted = rawCurrency(value, opts);
  return formatted === EMPTY_VALUE ? formatted : isolateLtr(formatted);
}

/** Format signed USD without treating a real zero as a gain or loss. */
export function formatSignedCurrency(value, opts = {}) {
  const normalizedValue = normalizeZero(value);
  return formatCurrency(normalizedValue, {
    ...opts,
    signDisplay: normalizedValue > 0 ? 'always' : 'auto',
  });
}

export function rawDate(value, locale = activeLocale()) {
  if (!value) return EMPTY_VALUE;
  const dateKey = /^\d{4}-\d{2}-\d{2}$/.test(String(value)) ? normalizeDateKey(value) : null;
  if (dateKey) return formatDateKey(dateKey, { month: 'short', day: 'numeric', year: 'numeric' }, locale);
  return new Date(value).toLocaleDateString(formattingLocale(locale), {
    month: 'short', day: 'numeric', year: 'numeric',
  });
}

/** Format a date while allowing the full mixed-direction expression to remain intact. */
export function formatDate(value) {
  const formatted = rawDate(value);
  return formatted === EMPTY_VALUE ? formatted : isolateAuto(formatted);
}

export function rawDatetime(value, locale = activeLocale()) {
  if (!value) return EMPTY_VALUE;
  return new Date(value).toLocaleString(formattingLocale(locale), {
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
  const hebrew = activeLocale() === 'he';
  if (minutes < 60) return hebrew ? `${minutes} דק׳` : `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;
  if (hebrew) return remainingMinutes > 0 ? `${hours} שע׳ ${remainingMinutes} דק׳` : `${hours} שע׳`;
  return remainingMinutes > 0 ? `${hours}h ${remainingMinutes}m` : `${hours}h`;
}

export function formatDuration(minutes) {
  const formatted = rawDuration(minutes);
  return formatted === EMPTY_VALUE ? formatted : isolateLtr(formatted);
}

export function rawPct(value, decimals = 1) {
  if (value == null) return EMPTY_VALUE;
  return new Intl.NumberFormat(formattingLocale(), {
    style: 'percent', minimumFractionDigits: decimals, maximumFractionDigits: decimals,
  }).format(normalizeZero(value));
}

export function rawNumber(value, opts = {}) {
  if (value == null) return EMPTY_VALUE;
  return new Intl.NumberFormat(formattingLocale(), opts).format(normalizeZero(value));
}

export function formatNumber(value, opts = {}) {
  const formatted = rawNumber(value, opts);
  return formatted === EMPTY_VALUE ? formatted : isolateLtr(formatted);
}

export function formatPct(value, decimals = 1) {
  const formatted = rawPct(value, decimals);
  return formatted === EMPTY_VALUE ? formatted : isolateLtr(formatted);
}

export function rawR(value) {
  if (value == null) return EMPTY_VALUE;
  const normalizedValue = normalizeZero(value);
  return `${normalizedValue > 0 ? '+' : ''}${normalizedValue.toFixed(2)}R`;
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
