import { CalendarCheck, ChartBar, ChartLineUp, ListBullets, Bank, Notebook, UploadSimple, ListChecks, Target } from '@phosphor-icons/react';

export const navigationGroups = [
  {
    label: 'Trading',
    items: [
      { to: '/dashboard', label: 'Dashboard', Icon: ChartLineUp },
      { to: '/trades', label: 'Trades', Icon: ListBullets },
      { to: '/daily-review', label: 'Daily Review', Icon: CalendarCheck },
    ],
  },
  {
    label: 'Manage',
    items: [
      { to: '/accounts', label: 'Accounts', Icon: Bank },
      { to: '/import', label: 'Import', Icon: UploadSimple },
    ],
  },
  {
    label: 'Insights',
    items: [
      { to: '/insights/analytics', label: 'Analytics', Icon: ChartBar },
      { to: '/insights/journal', label: 'Journal & Reviews', Icon: Notebook },
      { to: '/insights/rules', label: 'Rules & Adherence', Icon: ListChecks },
      { to: '/insights/goals', label: 'Goals', Icon: Target },
    ],
  },
];

export const navigationItems = navigationGroups.flatMap((group) => group.items);
export const mobileNavigationItems = navigationItems.filter((item) => ['/dashboard', '/trades', '/accounts'].includes(item.to));
export const mobileMoreItems = navigationItems.filter((item) => ['/daily-review', '/import', '/insights/analytics', '/insights/journal', '/insights/rules', '/insights/goals'].includes(item.to));
