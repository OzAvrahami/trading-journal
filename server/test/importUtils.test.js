import test from 'node:test';
import assert from 'node:assert/strict';
import { buildDedupKey, durationToMinutes, normalizeDirection, toISO, toNum } from '../src/utils/importUtils.js';

test('toNum handles broker currency, separators, accounting negatives, and blanks', () => {
  assert.equal(toNum('$1,275.50'), 1275.5);
  assert.equal(toNum('$(84.25)'), -84.25);
  assert.equal(toNum(''), 0);
  assert.equal(toNum('not-a-number'), 0);
});

test('durationToMinutes preserves current supported duration formats', () => {
  assert.equal(durationToMinutes('1:12:30'), 73);
  assert.equal(durationToMinutes('08:45'), 9);
  assert.equal(durationToMinutes('2h 15m'), 135);
  assert.equal(durationToMinutes('120'), 2);
  assert.equal(durationToMinutes(''), null);
});

test('direction and ISO conversion retain their current normalization behavior', () => {
  assert.equal(normalizeDirection('SELL'), 'short');
  assert.equal(normalizeDirection('buy'), 'long');
  assert.equal(toISO('2026-02-14T10:30:00Z'), '2026-02-14T10:30:00.000Z');
  assert.equal(toISO(''), null);
});

test('buildDedupKey normalizes symbol, dates, and numeric precision', () => {
  const key = buildDedupKey({
    symbol: ' mes ',
    entry_datetime: '2026-02-14T10:30:00Z',
    exit_datetime: null,
    entry_price: '5123.5',
    exit_price: '',
    quantity: 2,
  });

  assert.equal(
    key,
    'MES|2026-02-14T10:30:00.000Z|null|5123.50000000|null|2.00000000',
  );
});
