import { ChartLineUp, ListBullets, Bank, UploadSimple } from '@phosphor-icons/react';

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
];

export const navigationItems = navigationGroups.flatMap((group) => group.items);
