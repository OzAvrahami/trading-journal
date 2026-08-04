const ROUTES = [
  {
    match: (pathname) => pathname === '/dashboard',
    title: 'Dashboard',
    description: 'Review trading performance across your current scope.',
    breadcrumbs: ['Journal', 'Dashboard'],
    nav: '/dashboard',
    headerControls: ['dashboardScope'],
    commandActions: ['addTrade'],
  },
  {
    match: (pathname) => pathname === '/trades',
    title: 'Trades',
    description: 'Find, filter, export, and manage recorded trades.',
    breadcrumbs: ['Journal', 'Trades'],
    nav: '/trades',
    headerControls: ['tradesActions'],
    commandActions: ['addTrade', 'exportTrades'],
  },
  {
    match: (pathname) => /^\/trades\/[^/]+$/.test(pathname),
    title: 'Trade details',
    description: 'Review the recorded trade context and outcome.',
    breadcrumbs: ['Journal', 'Trades', 'Trade details'],
    nav: '/trades',
    headerControls: ['tradeActions'],
    commandActions: [],
  },
  {
    match: (pathname) => pathname === '/accounts',
    title: 'Accounts',
    description: 'Manage the accounts used to organize trading activity.',
    breadcrumbs: ['Manage', 'Accounts'],
    nav: '/accounts',
    headerControls: ['accountActions'],
    commandActions: ['addAccount'],
  },
  {
    match: (pathname) => pathname === '/import',
    title: 'Import',
    description: 'Bring broker trade files into an existing account.',
    breadcrumbs: ['Manage', 'Import'],
    nav: '/import',
    headerControls: [],
    commandActions: [],
  },
  {
    match: (pathname) => pathname === '/insights/analytics',
    title: 'Analytics',
    description: 'Analyze trading performance across markets, direction, strategy, timing, and account scope.',
    breadcrumbs: ['Insights', 'Analytics'],
    nav: '/insights/analytics',
    headerControls: ['analyticsScope'],
    commandActions: [],
  },
  {
    match: (pathname) => pathname === '/insights/journal',
    title: 'Journal & Reviews',
    description: 'Capture notes and structured reviews, then connect them to the trades they describe.',
    breadcrumbs: ['Insights', 'Journal & Reviews'],
    nav: '/insights/journal',
    headerControls: ['journalActions'],
    commandActions: [],
  },
  {
    match: (pathname) => pathname === '/insights/rules',
    title: 'Rules & Adherence',
    description: 'Define your trading rules, record what happened, and measure process consistency over time.',
    breadcrumbs: ['Insights', 'Rules & Adherence'],
    nav: '/insights/rules',
    headerControls: ['rulesActions'],
    commandActions: ['newRule', 'recordRuleCheck'],
  },
  {
    match: (pathname) => pathname === '/insights/goals',
    title: 'Goals',
    description: 'Set measurable trading and process goals, then track progress from your real activity.',
    breadcrumbs: ['Insights', 'Goals'],
    nav: '/insights/goals',
    headerControls: ['goalsActions'],
    commandActions: ['newGoal'],
  },
];

const FALLBACK = {
  title: 'TradingLog',
  description: '',
  breadcrumbs: ['TradingLog'],
  nav: null,
  headerControls: [],
  commandActions: [],
};

export function resolveRouteMetadata(pathname) {
  return ROUTES.find((route) => route.match(pathname)) || FALLBACK;
}

export const routeMetadata = ROUTES;
