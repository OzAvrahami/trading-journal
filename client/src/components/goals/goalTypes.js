import { formatCurrency, formatR, isolateLtr } from '../../utils/formatters.js';

export const GOAL_METRICS = [
  {
    value: 'net_pnl', label: 'Net PnL', comparison: 'at_least', comparisonLabel: 'At least', unit: 'currency', min: -1000000000, max: 1000000000, step: '0.01',
    help: 'Closed-trade net PnL in the goal period.',
  },
  {
    value: 'closed_trades', label: 'Closed trades', comparison: 'at_least', comparisonLabel: 'At least', unit: 'count', min: 0, max: 1000000000, step: '1',
    help: 'Number of closed trades.',
  },
  {
    value: 'win_rate', label: 'Win rate', comparison: 'at_least', comparisonLabel: 'At least', unit: 'percent', min: 0, max: 100, step: '0.1',
    help: 'Existing production win-rate definition.',
  },
  {
    value: 'average_r', label: 'Average R', comparison: 'at_least', comparisonLabel: 'At least', unit: 'r_multiple', min: -1000, max: 1000, step: '0.01',
    help: 'Average stored R where available.',
  },
  {
    value: 'rule_adherence', label: 'Rule adherence', comparison: 'at_least', comparisonLabel: 'At least', unit: 'percent', min: 0, max: 100, step: '0.1',
    help: 'Followed divided by followed plus broken.',
  },
  {
    value: 'journal_entries', label: 'Journal entries', comparison: 'at_least', comparisonLabel: 'At least', unit: 'count', min: 0, max: 1000000000, step: '1',
    help: 'Number of Journal entries.',
  },
  {
    value: 'broken_rule_checks', label: 'Broken rule checks', comparison: 'at_most', comparisonLabel: 'At most', unit: 'count', min: 0, max: 1000000000, step: '1',
    help: 'Maximum allowed broken checks.',
  },
];

export const GOAL_STATUSES = [
  { value: 'active', label: 'Active' },
  { value: 'paused', label: 'Paused' },
  { value: 'archived', label: 'Archived' },
];

export const GOAL_STATES = {
  upcoming: { label: 'Upcoming', variant: 'information' },
  in_progress: { label: 'In progress', variant: 'action' },
  achieved: { label: 'Achieved', variant: 'positive' },
  missed: { label: 'Missed', variant: 'negative' },
  paused: { label: 'Paused', variant: 'warning' },
  archived: { label: 'Archived', variant: 'neutral' },
};

export const UNAVAILABLE_REASONS = {
  no_closed_trades: 'No closed trades in this goal period.',
  no_r_data: 'No trades with R data in this goal period.',
  no_eligible_rule_checks: 'No eligible rule checks in this goal period.',
  source_unavailable: 'This source could not be calculated right now.',
};

export function metricMeta(metricKey) {
  return GOAL_METRICS.find((metric) => metric.value === metricKey) ?? GOAL_METRICS[0];
}

export function formatGoalValue(value, unit, { signed = false } = {}) {
  if (value == null) return '—';
  if (unit === 'currency') return signed
    ? formatCurrency(value, { signDisplay: value > 0 ? 'always' : 'auto' })
    : formatCurrency(value);
  if (unit === 'percent') return isolateLtr(`${Number(value).toLocaleString('en-US', { maximumFractionDigits: 2 })}%`);
  if (unit === 'r_multiple') return formatR(Number(value));
  return isolateLtr(Number(value).toLocaleString('en-US', { maximumFractionDigits: 0 }));
}
