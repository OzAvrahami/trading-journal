import { describe, expect, it } from 'vitest';
import { localizeRouteMetadata, resolveRouteMetadata } from './routeMetadata.js';

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

  it('resolves New and Edit Trade before the dynamic detail route', () => {
    expect(resolveRouteMetadata('/trades/new')).toMatchObject({ title: 'New Trade', routeKey: 'tradeNew', nav: '/trades' });
    expect(resolveRouteMetadata('/trades/550e8400-e29b-41d4-a716-446655440000/edit')).toMatchObject({ title: 'Edit Trade', routeKey: 'tradeEdit', nav: '/trades' });
  });

  it('localizes the two editor route identities independently', () => {
    const t = (key) => ({
      'routes.tradeNew.title': 'עסקה חדשה', 'routes.tradeNew.description': 'תיאור חדש',
      'routes.tradeEdit.title': 'עריכת עסקה', 'routes.tradeEdit.description': 'תיאור עריכה',
      'navigation.journal': 'יומן', 'navigation.trades': 'עסקאות',
    }[key] || key);
    expect(localizeRouteMetadata(resolveRouteMetadata('/trades/new'), t).title).toBe('עסקה חדשה');
    expect(localizeRouteMetadata(resolveRouteMetadata('/trades/550e8400-e29b-41d4-a716-446655440000/edit'), t).title).toBe('עריכת עסקה');
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

  it('resolves and localizes the managed Strategies route', () => {
    const metadata = resolveRouteMetadata('/strategies');
    expect(metadata).toMatchObject({
      title: 'Strategies & Setups',
      description: 'Manage reusable trade classifications and review their real performance.',
      breadcrumbs: ['Trading', 'Strategies & Setups'],
      nav: '/strategies',
    });
    const t = (key) => ({
      'routes.strategies.title': 'אסטרטגיות וסטאפים',
      'routes.strategies.description': 'ניהול סיווגים חוזרים לעסקאות ובחינת הביצועים האמיתיים שלהם.',
      'navigation.trading': 'מסחר',
      'navigation.strategies': 'אסטרטגיות וסטאפים',
    }[key] || key);
    expect(localizeRouteMetadata(metadata, t)).toMatchObject({
      title: 'אסטרטגיות וסטאפים',
      nav: '/strategies',
    });
  });

  it('keeps Import History detail inside the protected Import navigation scope', () => {
    expect(resolveRouteMetadata('/import/history/550e8400-e29b-41d4-a716-446655440000')).toMatchObject({
      title: 'Import Run', routeKey: 'importRunDetail', nav: '/import', breadcrumbs: ['Manage', 'Import', 'Import Run'],
    });
  });
});
