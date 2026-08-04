import { ChartBar, ChartLineUp, ListBullets, Bank, UploadSimple } from '@phosphor-icons/react';

export const navigationGroups = [
  {
    label: 'Journal',
    items: [
      { to: '/dashboard', label: 'Dashboard', Icon: ChartLineUp },
      { to: '/trades', label: 'Trades', Icon: ListBullets },
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
    ],
  },
];

export const navigationItems = navigationGroups.flatMap((group) => group.items);
export const mobileNavigationItems = navigationItems.filter((item) => ['/dashboard', '/trades', '/accounts'].includes(item.to));
export const mobileMoreItems = navigationItems.filter((item) => ['/import', '/insights/analytics'].includes(item.to));
