import { describe, expect, it } from 'vitest';
import { resolveRouteMetadata } from './routeMetadata.js';

describe('route metadata', () => {
  it('resolves static routes from one registry', () => {
    expect(resolveRouteMetadata('/accounts')).toMatchObject({
      title: 'Accounts',
      nav: '/accounts',
    });
  });

  it('maps dynamic trade details back to Trades navigation', () => {
    expect(resolveRouteMetadata('/trades/trade-123')).toMatchObject({
      title: 'Trade details',
      nav: '/trades',
    });
  });
});
