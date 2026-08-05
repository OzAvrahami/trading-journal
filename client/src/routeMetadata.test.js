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

  it('resolves Rules metadata, header actions, and no account scope', () => {
    expect(resolveRouteMetadata('/insights/rules')).toMatchObject({
      title: 'Rules & Adherence',
      description: 'Define your trading rules, record what happened, and measure process consistency over time.',
      breadcrumbs: ['Insights', 'Rules & Adherence'],
      nav: '/insights/rules',
      headerControls: ['rulesActions'],
      commandActions: ['newRule', 'recordRuleCheck'],
    });
    expect(resolveRouteMetadata('/insights/rules').headerControls).not.toContain('analyticsScope');
  });

  it('resolves Goals metadata with only the New Goal action', () => {
    expect(resolveRouteMetadata('/insights/goals')).toMatchObject({
      title: 'Goals',
      description: 'Set measurable trading and process goals, then track progress from your real activity.',
      breadcrumbs: ['Insights', 'Goals'],
      nav: '/insights/goals',
      headerControls: ['goalsActions'],
      commandActions: ['newGoal'],
    });
    expect(resolveRouteMetadata('/insights/goals').headerControls).not.toContain('analyticsScope');
  });

  it('resolves Daily Review metadata and its date navigation slot', () => {
    expect(resolveRouteMetadata('/daily-review/2026-08-04')).toMatchObject({
      title: 'Daily Review',
      description: 'Review the selected trading day, record what happened, and prepare for the next session.',
      breadcrumbs: ['Trading', 'Daily Review'],
      nav: '/daily-review',
      headerControls: ['dailyReviewDate'],
    });
    expect(resolveRouteMetadata('/daily-review').commandActions).toEqual([]);
  });
});
