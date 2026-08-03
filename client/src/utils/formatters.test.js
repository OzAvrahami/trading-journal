import { describe, expect, it } from 'vitest';
import {
  formatCurrency,
  formatDate,
  formatDuration,
  formatPct,
  formatR,
  formatSignedCurrency,
  isolateLtr,
  rawCurrency,
} from './formatters.js';

const stripIsolation = (value) => value.replace(/[\u2066\u2068\u2069]/g, '');

describe('display formatters', () => {
  it('preserves visible currency output and wraps it in one LTR isolate', () => {
    const visible = rawCurrency(-1120);
    const formatted = formatCurrency(-1120);

    expect(stripIsolation(formatted)).toBe(visible);
    expect(formatted).toBe(`\u2066${visible}\u2069`);
    expect(formatted.match(/\u2066/g)).toHaveLength(1);
    expect(formatted.match(/\u2069/g)).toHaveLength(1);
  });

  it('keeps null placeholders unisolated', () => {
    expect(formatCurrency(null)).toBe('—');
    expect(formatDate(null)).toBe('—');
  });

  it('adds a sign to gains without marking zero as a gain', () => {
    expect(stripIsolation(formatSignedCurrency(12))).toBe('+$12.00');
    expect(stripIsolation(formatSignedCurrency(0))).toBe('$0.00');
    expect(stripIsolation(formatSignedCurrency(-12))).toBe('-$12.00');
  });

  it('isolates complete percentage, ratio, and duration expressions', () => {
    expect(formatPct(0.423)).toBe('\u206642.3%\u2069');
    expect(formatR(1.7)).toBe('\u2066+1.70R\u2069');
    expect(formatDuration(75)).toBe('\u20661h 15m\u2069');
    expect(isolateLtr('A / B')).toBe('\u2066A / B\u2069');
  });
});
