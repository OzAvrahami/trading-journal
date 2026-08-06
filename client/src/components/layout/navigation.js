import { CalendarCheck, ChartBar, ChartDonut, ChartLine, ChartLineUp, Coins, ListBullets, ListDashes, Bank, Notebook, Receipt, UploadSimple, ListChecks, Target, TreeStructure, Gear, Briefcase } from '@phosphor-icons/react';

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
      {
        to: '/portfolio', label: 'Investments', labelKey: 'navigation.investments', Icon: Briefcase,
        children: [
          { to: '/portfolio', label: 'Overview', labelKey: 'navigation.investmentsOverview', Icon: Briefcase },
          { to: '/portfolio/holdings', label: 'Holdings', labelKey: 'navigation.investmentsHoldings', Icon: ListDashes },
          { to: '/portfolio/transactions', label: 'Transactions', labelKey: 'navigation.investmentsTransactions', Icon: Receipt },
          { to: '/portfolio/dividends', label: 'Dividends', labelKey: 'navigation.investmentsDividends', Icon: Coins },
          { to: '/portfolio/performance', label: 'Portfolio Performance', labelKey: 'navigation.investmentsPerformance', Icon: ChartLine },
          { to: '/portfolio/allocation', label: 'Asset Allocation', labelKey: 'navigation.investmentsAllocation', Icon: ChartDonut },
        ],
      },
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
export const commandNavigationItems = navigationItems.flatMap((item) => item.children ? [item, ...item.children] : [item]);
export const mobileNavigationItems = navigationItems.filter((item) => ['/dashboard', '/trades', '/accounts'].includes(item.to));
export const mobileMoreItems = navigationItems.flatMap((item) => item.children ? [item, ...item.children] : [item]).filter((item) => ['/strategies', '/daily-review', '/portfolio', '/portfolio/holdings', '/portfolio/transactions', '/portfolio/dividends', '/portfolio/performance', '/portfolio/allocation', '/import', '/insights/analytics', '/insights/journal', '/insights/rules', '/insights/goals', '/settings'].includes(item.to));

export function preserveInvestmentScope(to, location) {
  if (!to.startsWith('/portfolio') || !location?.pathname?.startsWith('/portfolio')) return to;
  const accountId = new URLSearchParams(location.search).get('accountId');
  return accountId ? `${to}?accountId=${encodeURIComponent(accountId)}` : to;
}
