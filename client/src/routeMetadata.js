const ROUTES = [
  ...[
    ['/portfolio/holdings', 'Holdings', 'Review current derived positions across investment Accounts.', 'investmentsHoldings'],
    ['/portfolio/transactions', 'Transactions', 'Review and manage the stored investment ledger.', 'investmentsTransactions'],
    ['/portfolio/dividends', 'Dividends', 'Review recorded dividend payments across investment Accounts.', 'investmentsDividends'],
    ['/portfolio/performance', 'Portfolio Performance', 'Review value history based on stored Transactions and manual prices.', 'investmentsPerformance'],
    ['/portfolio/allocation', 'Asset Allocation', 'Review supported Account, asset-type, Instrument, currency, and cash allocation.', 'investmentsAllocation'],
  ].map(([path, title, description, routeKey]) => ({
    match: (pathname) => pathname === path,
    title,
    description,
    breadcrumbs: ['Investments', title],
    nav: '/portfolio', routeKey, headerControls: [], commandActions: [],
  })),
  {
    match: (pathname) => /^\/portfolio\/[^/]+$/.test(pathname),
    title: 'Investment account details',
    description: 'Review derived holdings, cash, transactions, and manual valuations.',
    breadcrumbs: ['Investments', 'Overview', 'Investment account details'],
    nav: '/portfolio', routeKey: 'portfolioDetail', headerControls: [], commandActions: [],
  },
  {
    match: (pathname) => pathname === '/portfolio',
    title: 'Investments',
    description: 'Review investment-enabled Accounts and their manually tracked value.',
    breadcrumbs: ['Investments', 'Overview'],
    nav: '/portfolio', routeKey: 'portfolio', headerControls: [], commandActions: [],
  },
  {
    match: (pathname) => pathname === '/settings',
    title: 'Settings',
    description: 'Manage language, appearance, timezone, and trading defaults.',
    breadcrumbs: ['System', 'Settings'],
    nav: '/settings', routeKey: 'settings', headerControls: [], commandActions: [],
  },
  {
    match: (pathname) => /^\/import\/history\/[^/]+$/.test(pathname),
    title: 'Import Run',
    description: 'Review durable results for a confirmed Trade import.',
    breadcrumbs: ['Manage', 'Import', 'Import Run'],
    nav: '/import', routeKey: 'importRunDetail', headerControls: [], commandActions: [],
  },
  {
    match: (pathname) => /^\/accounts\/[^/]+$/.test(pathname),
    title: 'Account details',
    description: 'Review account identity, tracked balance context, performance, and recent trades.',
    breadcrumbs: ['Manage', 'Accounts', 'Account details'],
    nav: '/accounts', routeKey: 'accountDetail', headerControls: [], commandActions: [],
  },
  {
    match: (pathname) => pathname === '/strategies',
    title: 'Strategies & Setups',
    description: 'Manage reusable trade classifications and review their real performance.',
    breadcrumbs: ['Trading', 'Strategies & Setups'],
    nav: '/strategies',
    headerControls: [],
    commandActions: [],
  },
  {
    match: (pathname) => pathname === '/dashboard',
    title: 'Dashboard',
    description: 'Review trading performance across your current scope.',
    breadcrumbs: ['Journal', 'Dashboard'],
    nav: '/dashboard',
    headerControls: ['dashboardScope'],
    commandActions: ['quickAddTrade'],
  },
  {
    match: (pathname) => pathname === '/trades',
    title: 'Trades',
    description: 'Find, filter, export, and manage recorded trades.',
    breadcrumbs: ['Journal', 'Trades'],
    nav: '/trades',
    headerControls: ['tradesActions'],
    commandActions: ['quickAddTrade', 'exportTrades'],
  },
  {
    match: (pathname) => pathname === '/trades/new',
    title: 'New Trade',
    description: 'Record a new trade with the context needed for an accurate review.',
    breadcrumbs: ['Journal', 'Trades', 'New Trade'],
    nav: '/trades',
    routeKey: 'tradeNew',
    headerControls: [],
    commandActions: [],
  },
  {
    match: (pathname) => /^\/trades\/[^/]+\/edit$/.test(pathname),
    title: 'Edit Trade',
    description: 'Update the recorded outcome and review context for this trade.',
    breadcrumbs: ['Journal', 'Trades', 'Edit Trade'],
    nav: '/trades',
    routeKey: 'tradeEdit',
    headerControls: [],
    commandActions: [],
  },
  {
    match: (pathname) => pathname === '/daily-review' || /^\/daily-review\/[^/]+$/.test(pathname),
    title: 'Daily Review',
    description: 'Review the selected trading day, record what happened, and prepare for the next session.',
    breadcrumbs: ['Trading', 'Daily Review'],
    nav: '/daily-review',
    headerControls: ['dailyReviewDate'],
    commandActions: [],
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

const ROUTE_KEYS = new Map([
  ['/dashboard', 'dashboard'], ['/trades', 'trades'], ['/strategies', 'strategies'], ['/daily-review', 'dailyReview'],
  ['/accounts', 'accounts'], ['/import', 'import'], ['/insights/analytics', 'analytics'],
  ['/insights/journal', 'journal'], ['/insights/rules', 'rules'], ['/insights/goals', 'goals'],
  ['/settings', 'settings'],
  ['/portfolio', 'portfolio'],
]);

export function localizeRouteMetadata(metadata, t) {
  const routeKey = metadata.routeKey || (metadata.nav === '/trades' && metadata.title === 'Trade details'
    ? 'tradeDetail'
    : ROUTE_KEYS.get(metadata.nav));
  if (!routeKey) return metadata;
  const breadcrumbMap = {
    Journal: 'navigation.journal', Trading: 'navigation.trading', Manage: 'navigation.manage',
    Insights: 'navigation.insights', Investments: 'navigation.investments', Overview: 'navigation.investmentsOverview', 'Investment account details': 'routes.portfolioDetail.title', System: 'navigation.system', Settings: 'navigation.settings', Dashboard: 'navigation.dashboard', Trades: 'navigation.trades',
    'Strategies & Setups': 'navigation.strategies',
    'Daily Review': 'navigation.dailyReview', 'Trade details': 'routes.tradeDetail.title',
    'New Trade': 'routes.tradeNew.title', 'Edit Trade': 'routes.tradeEdit.title',
    Accounts: 'navigation.accounts', 'Account details': 'routes.accountDetail.title', Import: 'navigation.import', 'Import Run': 'routes.importRunDetail.title', Analytics: 'navigation.analytics',
    'Journal & Reviews': 'navigation.journal', 'Rules & Adherence': 'navigation.rules', Goals: 'navigation.goals',
    Holdings: 'navigation.investmentsHoldings', Transactions: 'navigation.investmentsTransactions',
    Dividends: 'navigation.investmentsDividends', 'Portfolio Performance': 'navigation.investmentsPerformance',
    'Asset Allocation': 'navigation.investmentsAllocation',
  };
  return {
    ...metadata,
    title: t(`routes.${routeKey}.title`),
    description: t(`routes.${routeKey}.description`),
    breadcrumbs: metadata.breadcrumbs.map((crumb) => t(breadcrumbMap[crumb] || crumb)),
  };
}

export const routeMetadata = ROUTES;
