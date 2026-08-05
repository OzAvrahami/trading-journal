import { describe, expect, it } from 'vitest';
import { mapTradeToFormValues, normalizeTradePayload, validateTradeForm } from './tradeFormModel.js';

const base = {
  accountId: 'account-1', symbol: ' mnq ', market: 'futures', direction: 'long', status: 'closed',
  entryDatetime: '2026-08-04T10:00', exitDatetime: '2026-08-04T11:00', entryPrice: '22000.25', exitPrice: '22010.25',
  quantity: '2', fees: '4', strategy: ' ORB ', setup: ' Breakout ', timeframe: '5m', riskAmount: '100', stopLoss: '21995',
  takeProfit: '22015', notes: ' waited ', emotionPre: 'Focused', emotionDuring: '', emotionPost: 'Calm',
  screenshotLinks: 'https://example.com/a.png\nhttps://example.com/a.png',
};

describe('canonical trade form model', () => {
  it('normalizes create payloads without translating internal keys or calculating PnL', () => {
    const payload = normalizeTradePayload(base, { timezone: 'Asia/Jerusalem' });
    expect(payload).toMatchObject({
      accountId: 'account-1', symbol: 'MNQ', market: 'futures', direction: 'long',
      entryDatetime: '2026-08-04T07:00:00.000Z', exitDatetime: '2026-08-04T08:00:00.000Z',
      entryPrice: 22000.25, exitPrice: 22010.25, quantity: 2, fees: 4,
      strategy: 'ORB', setup: 'Breakout', emotions: { pre: 'Focused', post: 'Calm' },
      screenshotLinks: ['https://example.com/a.png'],
    });
    expect(payload).not.toHaveProperty('pnlNet');
    expect(payload).not.toHaveProperty('status');
  });

  it('uses explicit null exits for open trades and only supported mutable fields for edit', () => {
    const payload = normalizeTradePayload({ ...base, status: 'open' }, { timezone: 'Asia/Jerusalem', isEdit: true });
    expect(payload.exitDatetime).toBeNull();
    expect(payload.exitPrice).toBeNull();
    expect(payload).not.toHaveProperty('accountId');
    expect(payload).not.toHaveProperty('entryDatetime');
    expect(payload).not.toHaveProperty('entryPrice');
    expect(payload).not.toHaveProperty('symbol');
  });

  it('validates closed-pair consistency, chronology, numbers, and screenshot URLs', () => {
    expect(validateTradeForm({ ...base, exitDatetime: '' }, { timezone: 'Asia/Jerusalem' })).toHaveProperty('exitDatetime');
    expect(validateTradeForm({ ...base, exitDatetime: '2026-08-04T09:00' }, { timezone: 'Asia/Jerusalem' }).exitDatetime).toBeTruthy();
    expect(validateTradeForm({ ...base, quantity: '0' }, { timezone: 'Asia/Jerusalem' })).toHaveProperty('quantity');
    expect(validateTradeForm({ ...base, screenshotLinks: 'javascript:alert(1)' }, { timezone: 'Asia/Jerusalem' })).toHaveProperty('screenshotLinks');
    expect(validateTradeForm(base, { timezone: 'Asia/Jerusalem' })).toEqual({});
  });

  it('maps a stored trade into exact user-local fields while preserving optional values', () => {
    const mapped = mapTradeToFormValues({
      ...base, symbol: 'MNQ', entryDatetime: '2026-08-04T07:00:00.000Z', exitDatetime: '2026-08-04T08:00:00.000Z',
      emotions: { pre: 'Focused', post: 'Calm' }, screenshotLinks: ['https://example.com/a.png'],
    }, 'Asia/Jerusalem');
    expect(mapped.entryDatetime).toBe('2026-08-04T10:00');
    expect(mapped.exitDatetime).toBe('2026-08-04T11:00');
    expect(mapped.emotionPre).toBe('Focused');
    expect(mapped.screenshotLinks).toBe('https://example.com/a.png');
  });

  it('round-trips managed IDs without replacing the text snapshots', () => {
    const payload = normalizeTradePayload({
      ...base,
      strategyId: 'strategy-1',
      setupId: 'setup-1',
      strategy: 'Opening Range Breakout',
      setup: 'Confirmed breakout',
    }, { timezone: 'Asia/Jerusalem' });
    expect(payload).toMatchObject({
      strategyId: 'strategy-1',
      setupId: 'setup-1',
      strategy: 'Opening Range Breakout',
      setup: 'Confirmed breakout',
    });

    const mapped = mapTradeToFormValues({
      ...base,
      strategyId: 'strategy-1',
      setupId: 'setup-1',
      strategy: 'Historical snapshot',
      setup: 'Historical setup snapshot',
    }, 'Asia/Jerusalem');
    expect(mapped).toMatchObject({
      strategyId: 'strategy-1',
      setupId: 'setup-1',
      strategy: 'Historical snapshot',
      setup: 'Historical setup snapshot',
    });
  });

  it('keeps legacy text-only classification valid and rejects a managed Setup without a Strategy', () => {
    expect(validateTradeForm({ ...base, strategyId: '', setupId: '' }, { timezone: 'Asia/Jerusalem' })).toEqual({});
    expect(validateTradeForm({ ...base, strategyId: '', setupId: 'setup-1' }, { timezone: 'Asia/Jerusalem' })).toHaveProperty('setupId');
  });
});
