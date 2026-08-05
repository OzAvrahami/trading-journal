import { CalendarCheck, ChartBar, ChartLineUp, ListBullets, Bank, Notebook, UploadSimple, ListChecks, Target } from '@phosphor-icons/react';

export const navigationGroups = [
  {
    label: 'Trading', labelKey: 'navigation.trading',
    items: [
      { to: '/dashboard', label: 'Dashboard', labelKey: 'navigation.dashboard', Icon: ChartLineUp },
      { to: '/trades', label: 'Trades', labelKey: 'navigation.trades', Icon: ListBullets },
      { to: '/daily-review', label: 'Daily Review', labelKey: 'navigation.dailyReview', Icon: CalendarCheck },
    ],
  },
  {
    label: 'Manage', labelKey: 'navigation.manage',
    items: [
      { to: '/accounts', label: 'Accounts', labelKey: 'navigation.accounts', Icon: Bank },
      { to: '/import', label: 'Import', labelKey: 'navigation.import', Icon: UploadSimple },
    ],
  },
  {
    label: 'Insights', labelKey: 'navigation.insights',
    items: [
      { to: '/insights/analytics', label: 'Analytics', labelKey: 'navigation.analytics', Icon: ChartBar },
      { to: '/insights/journal', label: 'Journal & Reviews', labelKey: 'navigation.journal', Icon: Notebook },
      { to: '/insights/rules', label: 'Rules & Adherence', labelKey: 'navigation.rules', Icon: ListChecks },
      { to: '/insights/goals', label: 'Goals', labelKey: 'navigation.goals', Icon: Target },
    ],
  },
];

export const navigationItems = navigationGroups.flatMap((group) => group.items);
export const mobileNavigationItems = navigationItems.filter((item) => ['/dashboard', '/trades', '/accounts'].includes(item.to));
export const mobileMoreItems = navigationItems.filter((item) => ['/daily-review', '/import', '/insights/analytics', '/insights/journal', '/insights/rules', '/insights/goals'].includes(item.to));
