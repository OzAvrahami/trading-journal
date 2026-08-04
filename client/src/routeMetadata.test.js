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

  it('resolves the real Analytics route and header scope slot', () => {
    expect(resolveRouteMetadata('/insights/analytics')).toMatchObject({
      title: 'Analytics',
      breadcrumbs: ['Insights', 'Analytics'],
      nav: '/insights/analytics',
      headerControls: ['analyticsScope'],
    });
  });

  it('resolves Journal metadata without account scope', () => {
    expect(resolveRouteMetadata('/insights/journal')).toMatchObject({
      title: 'Journal & Reviews',
      description: 'Capture notes and structured reviews, then connect them to the trades they describe.',
      breadcrumbs: ['Insights', 'Journal & Reviews'],
      nav: '/insights/journal',
      headerControls: ['journalActions'],
    });
    expect(resolveRouteMetadata('/insights/journal').headerControls).not.toContain('analyticsScope');
  });
});
