import { describe, expect, it } from 'vitest';
import { mobileMoreItems, mobileNavigationItems, navigationGroups, navigationItems } from './navigation.js';

describe('Daily Review navigation', () => {
  it('appears in Trading after Trades without removing existing routes', () => {
    const trading = navigationGroups.find((group) => group.label === 'Trading');
    expect(trading.items.map((item) => item.label)).toEqual(['Dashboard', 'Trades', 'Daily Review']);
    expect(navigationItems.map((item) => item.label)).toEqual(expect.arrayContaining(['Analytics', 'Journal & Reviews', 'Rules & Adherence', 'Goals']));
  });

  it('keeps three primary mobile destinations and exposes Daily Review through More', () => {
    expect(mobileNavigationItems).toHaveLength(3);
    expect(mobileMoreItems.some((item) => item.to === '/daily-review')).toBe(true);
  });

  it('makes Daily Review available to the command palette destination registry', () => {
    expect(navigationItems.find((item) => item.to === '/daily-review')).toMatchObject({ label: 'Daily Review' });
  });
});
