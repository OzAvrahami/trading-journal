import { formatCurrency, formatNumber, formatR, rawNumber } from '../../utils/formatters.js';
import i18n from '../../i18n/index.js';

export const GOAL_METRICS = [
  {
    value: 'net_pnl', get label() { return i18n.t('common.netPnl'); }, comparison: 'at_least', get comparisonLabel() { return i18n.t('common.atLeast'); }, unit: 'currency', min: -1000000000, max: 1000000000, step: '0.01',
    get help() { return i18n.t('goals.metricHelp.net_pnl'); },
  },
  {
    value: 'closed_trades', get label() { return i18n.t('dashboard.closedTrades'); }, comparison: 'at_least', get comparisonLabel() { return i18n.t('common.atLeast'); }, unit: 'count', min: 0, max: 1000000000, step: '1',
    get help() { return i18n.t('goals.metricHelp.closed_trades'); },
  },
  {
    value: 'win_rate', get label() { return i18n.t('common.winRate'); }, comparison: 'at_least', get comparisonLabel() { return i18n.t('common.atLeast'); }, unit: 'percent', min: 0, max: 100, step: '0.1',
    get help() { return i18n.t('goals.metricHelp.win_rate'); },
  },
  {
    value: 'average_r', get label() { return i18n.t('common.averageR'); }, comparison: 'at_least', get comparisonLabel() { return i18n.t('common.atLeast'); }, unit: 'r_multiple', min: -1000, max: 1000, step: '0.01',
    get help() { return i18n.t('goals.metricHelp.average_r'); },
  },
  {
    value: 'rule_adherence', get label() { return i18n.t('rules.adherence'); }, comparison: 'at_least', get comparisonLabel() { return i18n.t('common.atLeast'); }, unit: 'percent', min: 0, max: 100, step: '0.1',
    get help() { return i18n.t('goals.metricHelp.rule_adherence'); },
  },
  {
    value: 'journal_entries', get label() { return i18n.t('navigation.journal'); }, comparison: 'at_least', get comparisonLabel() { return i18n.t('common.atLeast'); }, unit: 'count', min: 0, max: 1000000000, step: '1',
    get help() { return i18n.t('goals.metricHelp.journal_entries'); },
  },
  {
    value: 'broken_rule_checks', get label() { return i18n.t('rules.broken'); }, comparison: 'at_most', get comparisonLabel() { return i18n.t('common.atMost'); }, unit: 'count', min: 0, max: 1000000000, step: '1',
    get help() { return i18n.t('goals.metricHelp.broken_rule_checks'); },
  },
];

export const GOAL_STATUSES = [
  { value: 'active', get label() { return i18n.t('status.active'); } },
  { value: 'paused', get label() { return i18n.t('status.paused'); } },
  { value: 'archived', get label() { return i18n.t('status.archived'); } },
];

export const GOAL_STATES = {
  upcoming: { get label() { return i18n.t('status.upcoming'); }, variant: 'information' },
  in_progress: { get label() { return i18n.t('status.in_progress'); }, variant: 'action' },
  achieved: { get label() { return i18n.t('status.achieved'); }, variant: 'positive' },
  missed: { get label() { return i18n.t('status.missed'); }, variant: 'negative' },
  paused: { get label() { return i18n.t('status.paused'); }, variant: 'warning' },
  archived: { get label() { return i18n.t('status.archived'); }, variant: 'neutral' },
};

export const UNAVAILABLE_REASONS = {
  get no_closed_trades() { return i18n.t('goals.no_closed_trades'); },
  get no_r_data() { return i18n.t('goals.no_r_data'); },
  get no_eligible_rule_checks() { return i18n.t('goals.no_eligible_rule_checks'); },
  get source_unavailable() { return i18n.t('goals.source_unavailable'); },
};

export function metricMeta(metricKey) {
  return GOAL_METRICS.find((metric) => metric.value === metricKey) ?? GOAL_METRICS[0];
}

export function formatGoalValue(value, unit, { signed = false } = {}) {
  if (value == null) return '—';
  if (unit === 'currency') return signed
    ? formatCurrency(value, { signDisplay: value > 0 ? 'always' : 'auto' })
    : formatCurrency(value);
  if (unit === 'percent') return `${rawNumber(Number(value), { maximumFractionDigits: 2 })}%`;
  if (unit === 'r_multiple') return formatR(Number(value));
  return formatNumber(Number(value), { maximumFractionDigits: 0 });
}
