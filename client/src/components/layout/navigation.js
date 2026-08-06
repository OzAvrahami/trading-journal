import { CalendarCheck, ChartBar, ChartLineUp, ListBullets, Bank, Notebook, UploadSimple, ListChecks, Target, TreeStructure, Gear, Briefcase } from '@phosphor-icons/react';

export const navigationGroups = [
  {
    label: 'Trading', labelKey: 'navigation.trading',
    items: [
      { to: '/dashboard', label: 'Dashboard', labelKey: 'navigation.dashboard', Icon: ChartLineUp },
      { to: '/trades', label: 'Trades', labelKey: 'navigation.trades', Icon: ListBullets },
      { to: '/strategies', label: 'Strategies & Setups', labelKey: 'navigation.strategies', Icon: TreeStructure },
      { to: '/daily-review', label: 'Daily Review', labelKey: 'navigation.dailyReview', Icon: CalendarCheck },
    ],
  },
  {
    label: 'Investments', labelKey: 'navigation.investments',
    items: [
      { to: '/portfolio', label: 'Portfolio', labelKey: 'navigation.portfolio', Icon: Briefcase },
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
  {
    label: 'System', labelKey: 'navigation.system',
    items: [
      { to: '/settings', label: 'Settings', labelKey: 'navigation.settings', Icon: Gear },
    ],
  },
];

export const navigationItems = navigationGroups.flatMap((group) => group.items);
export const mobileNavigationItems = navigationItems.filter((item) => ['/dashboard', '/trades', '/accounts'].includes(item.to));
export const mobileMoreItems = navigationItems.filter((item) => ['/strategies', '/daily-review', '/portfolio', '/import', '/insights/analytics', '/insights/journal', '/insights/rules', '/insights/goals', '/settings'].includes(item.to));
