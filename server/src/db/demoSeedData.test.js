import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { describe, test } from 'node:test';
import { computeFields } from '../services/tradeService.js';
import { parsePostgresDate } from './client.js';
import {
  computeProgressForGoals,
  deriveGoalState,
  mapStoredGoal,
  METRIC_CONFIG,
  validateGoalDefinition,
} from '../services/goalsService.js';
import { dateKeyInTimezone } from '../utils/dateTime.js';
import {
  DEMO_ACCOUNT_STATUSES,
  DEMO_ACCOUNT_TYPES,
  generateDemoDataset,
  localDateTimeToInstant,
  summarizeDemoDataset,
  validateDemoDataset,
} from './demoSeedData.js';

const userId = '11111111-1111-4111-8111-111111111111';
const options = { userId, timezone: 'Asia/Jerusalem', anchorDate: '2026-08-04' };

function createFixtureMetricQueryable(dataset) {
  return {
    async query(sql, params) {
      const [, goalIds, startDates, endDates] = params;
      if (sql.includes('LEFT JOIN trades')) {
        return {
          rows: goalIds.map((goalId, index) => {
            const trades = dataset.trades.filter((trade) => {
              const date = dateKeyInTimezone(dataset.timezone, new Date(trade.entryDatetime));
              return trade.status === 'closed' && date >= startDates[index] && date <= endDates[index];
            });
            const rTrades = trades.filter((trade) => trade.rMultiple != null);
            return {
              goal_id: goalId,
              closed_count: trades.length,
              winners: trades.filter((trade) => trade.pnlNet > 0).length,
              net_pnl: trades.reduce((sum, trade) => sum + trade.pnlNet, 0),
              r_count: rTrades.length,
              average_r: rTrades.length
                ? rTrades.reduce((sum, trade) => sum + trade.rMultiple, 0) / rTrades.length
                : null,
            };
          }),
        };
      }
      if (sql.includes('LEFT JOIN rule_checks')) {
        return {
          rows: goalIds.map((goalId, index) => {
            const checks = dataset.ruleChecks.filter((check) => check.checkDate >= startDates[index] && check.checkDate <= endDates[index]);
            return {
              goal_id: goalId,
              total_checks: checks.length,
              followed: checks.filter((check) => check.outcome === 'followed').length,
              broken: checks.filter((check) => check.outcome === 'broken').length,
            };
          }),
        };
      }
      if (sql.includes('LEFT JOIN journal_entries')) {
        return {
          rows: goalIds.map((goalId, index) => ({
            goal_id: goalId,
            journal_count: dataset.journalEntries.filter((entry) => entry.entryDate >= startDates[index] && entry.entryDate <= endDates[index]).length,
          })),
        };
      }
      throw new Error('Unexpected Goal metric query.');
    },
  };
}

function roundTripGoalThroughDatabase(goal) {
  return mapStoredGoal({
    id: goal.id,
    name: goal.name,
    description: goal.description,
    metric_key: goal.metricKey,
    comparison: goal.comparison,
    target_value: String(goal.targetValue),
    start_date: parsePostgresDate(goal.startDate),
    end_date: parsePostgresDate(goal.endDate),
    status: goal.status,
    created_at: new Date(goal.createdAt),
    updated_at: new Date(goal.updatedAt),
  });
}

describe('deterministic demo fixture generation', () => {
  test('generates byte-for-byte equivalent logical data for the same inputs', () => {
    assert.deepEqual(generateDemoDataset(options), generateDemoDataset(options));
  });

  test('moves relative records deterministically when the anchor changes', () => {
    const first = generateDemoDataset(options);
    const second = generateDemoDataset({ ...options, anchorDate: '2026-08-05' });
    assert.notEqual(first.trades[0].id, second.trades[0].id);
    assert.equal(second.anchorDate, '2026-08-05');
    assert.equal(second.tradingDates.at(-1), '2026-08-05');
    assert.equal(second.tradingDates[0], '2026-07-01');
  });

  test('converts deterministic local timestamps through the target timezone', () => {
    const instant = localDateTimeToInstant('2026-08-04', '09:35:00', 'Asia/Jerusalem');
    assert.equal(dateKeyInTimezone('Asia/Jerusalem', instant), '2026-08-04');
    assert.equal(instant.toISOString(), '2026-08-04T06:35:00.000Z');
  });

  test('creates the eight design-inspired accounts with production enums', () => {
    const dataset = generateDemoDataset(options);
    assert.equal(dataset.accounts.length, 8);
    assert.deepEqual(dataset.accounts.map((account) => account.accountName), [
      'Fidelity Individual', 'Roth IRA', 'IBKR Europe', 'IBKR Trading',
      'Tradovate Live', 'Topstep 150K Funded', 'Topstep Combine 50K', 'NinjaTrader Demo',
    ]);
    assert.ok(dataset.accounts.every((account) => DEMO_ACCOUNT_TYPES.includes(account.accountType)));
    assert.ok(dataset.accounts.every((account) => DEMO_ACCOUNT_STATUSES.includes(account.status)));
    assert.ok(dataset.accounts.every((account) => account.company === account.company.toLowerCase()));
  });

  test('creates coherent open and closed exit-field states', () => {
    const dataset = generateDemoDataset(options);
    for (const trade of dataset.trades) {
      assert.equal(trade.exitDatetime == null, trade.exitPrice == null);
      assert.equal(trade.status, trade.exitDatetime == null ? 'open' : 'closed');
      if (trade.exitDatetime) assert.ok(new Date(trade.exitDatetime) >= new Date(trade.entryDatetime));
    }
  });

  test('keeps every trade on an account owned by the target user', () => {
    const dataset = generateDemoDataset(options);
    const accountIds = new Set(dataset.accounts.filter((account) => account.userId === userId).map((account) => account.id));
    assert.ok(dataset.trades.every((trade) => trade.userId === userId && accountIds.has(trade.accountId)));
  });

  test('reuses production calculation output for every stored trade result', () => {
    const dataset = generateDemoDataset(options);
    for (const trade of dataset.trades) {
      const computed = computeFields(trade);
      assert.deepEqual(computed, {
        status: trade.status,
        pnlGross: trade.pnlGross,
        pnlNet: trade.pnlNet,
        rMultiple: trade.rMultiple,
        durationMinutes: trade.durationMinutes,
      });
      assert.ok(trade.durationMinutes == null || trade.durationMinutes >= 0);
      assert.equal(Object.is(trade.pnlNet, -0), false);
    }
  });

  test('produces exact winner, loser and breakeven counts', () => {
    const summary = summarizeDemoDataset(generateDemoDataset(options));
    assert.deepEqual({ closed: summary.closed, open: summary.open, winners: summary.winners, losers: summary.losers, breakeven: summary.breakeven }, {
      closed: 53, open: 4, winners: 31, losers: 20, breakeven: 2,
    });
  });

  test('produces the required headline KPIs', () => {
    const summary = summarizeDemoDataset(generateDemoDataset(options));
    assert.equal(summary.pnlNet, 7486);
    assert.equal(summary.totalFees, 346);
    assert.equal(summary.expectancy, 141.25);
    assert.equal(summary.profitFactor, 1.7);
  });

  test('covers 22 dates including today and a prior month', () => {
    const dataset = generateDemoDataset(options);
    assert.equal(new Set(dataset.tradingDates).size, 22);
    assert.equal(dataset.tradingDates.at(-1), options.anchorDate);
    assert.notEqual(dataset.tradingDates[0].slice(0, 7), options.anchorDate.slice(0, 7));
    assert.ok(dataset.trades.some((trade) => dateKeyInTimezone(options.timezone, new Date(trade.entryDatetime)) === options.anchorDate));
  });

  test('creates supported Journal types, completion states, tags and owned links', () => {
    const dataset = generateDemoDataset(options);
    assert.equal(dataset.journalEntries.length, 14);
    const types = new Set(dataset.journalEntries.map((entry) => entry.entryType));
    assert.deepEqual(types, new Set(['note', 'trade_review', 'daily_review', 'weekly_review']));
    assert.ok(dataset.journalEntries.some((entry) => entry.isComplete));
    assert.ok(dataset.journalEntries.some((entry) => !entry.isComplete));
    assert.ok(dataset.journalEntries.every((entry) => entry.tags.length > 0 && !/[<>]/.test(entry.content)));
    assert.ok(dataset.journalEntryTrades.every((link) => link.userId === userId));
  });

  test('creates trade/daily/general Rules, historical inactive checks and a no-eligible rule', () => {
    const dataset = generateDemoDataset(options);
    assert.deepEqual(new Set(dataset.rules.map((rule) => rule.scope)), new Set(['trade', 'daily', 'general']));
    const inactive = dataset.rules.find((rule) => !rule.isActive);
    assert.ok(dataset.ruleChecks.some((check) => check.ruleId === inactive.id));
    assert.ok(dataset.rules.some((rule) => {
      const outcomes = dataset.ruleChecks.filter((check) => check.ruleId === rule.id).map((check) => check.outcome);
      return outcomes.length > 0 && outcomes.every((outcome) => outcome === 'not_applicable');
    }));
    assert.ok(dataset.ruleChecks.some((check) => check.outcome === 'followed'));
    assert.ok(dataset.ruleChecks.some((check) => check.outcome === 'broken'));
    assert.ok(dataset.ruleChecks.some((check) => check.outcome === 'not_applicable'));
  });

  test('creates all seven valid Goal metric/comparison mappings and lifecycle statuses', () => {
    const dataset = generateDemoDataset(options);
    assert.deepEqual(new Set(dataset.goals.map((goal) => goal.metricKey)), new Set(Object.keys(METRIC_CONFIG)));
    assert.ok(dataset.goals.every((goal) => goal.comparison === METRIC_CONFIG[goal.metricKey].comparison));
    assert.ok(dataset.goals.every((goal) => validateGoalDefinition(goal) == null));
    assert.ok(dataset.goals.some((goal) => goal.status === 'paused'));
    assert.ok(dataset.goals.some((goal) => goal.status === 'archived'));
    const upcoming = dataset.goals.find((goal) => goal.metricKey === 'rule_adherence');
    const missed = dataset.goals.find((goal) => goal.metricKey === 'journal_entries');
    const inProgress = dataset.goals.find((goal) => goal.metricKey === 'closed_trades');
    assert.equal(deriveGoalState(upcoming, false, options.anchorDate), 'upcoming');
    assert.equal(deriveGoalState(missed, false, options.anchorDate), 'missed');
    assert.ok(inProgress.startDate <= options.anchorDate);
    assert.ok(inProgress.endDate > options.anchorDate);
    assert.equal(deriveGoalState(inProgress, false, options.anchorDate), 'in_progress');
  });

  test('traces every fixture through the real Goals progress service', async () => {
    const dataset = generateDemoDataset(options);
    const computed = await computeProgressForGoals(
      userId,
      dataset.goals.map(roundTripGoalThroughDatabase),
      createFixtureMetricQueryable(dataset),
      options.anchorDate,
      options.timezone,
    );
    assert.deepEqual(computed.map((goal) => ({
      name: goal.name,
      metricKey: goal.metricKey,
      currentValue: goal.currentValue,
      targetValue: goal.targetValue,
      status: goal.status,
      startDate: goal.startDate,
      endDate: goal.endDate,
      derivedState: goal.derivedState,
      unavailableReason: goal.unavailableReason,
    })), [
      { name: 'Reach $7,000 net PnL', metricKey: 'net_pnl', currentValue: 7486, targetValue: 7000, status: 'active', startDate: '2026-06-30', endDate: '2026-08-04', derivedState: 'achieved', unavailableReason: null },
      { name: 'Complete 60 closed trades', metricKey: 'closed_trades', currentValue: 53, targetValue: 60, status: 'active', startDate: '2026-06-30', endDate: '2026-08-18', derivedState: 'in_progress', unavailableReason: null },
      { name: 'Maintain a 60% win rate', metricKey: 'win_rate', currentValue: 58.49, targetValue: 60, status: 'paused', startDate: '2026-06-30', endDate: '2026-08-04', derivedState: 'paused', unavailableReason: null },
      { name: 'Average at least 0.30R', metricKey: 'average_r', currentValue: 0.2924, targetValue: 0.3, status: 'archived', startDate: '2026-06-30', endDate: '2026-08-04', derivedState: 'archived', unavailableReason: null },
      { name: 'Reach 85% rule adherence next cycle', metricKey: 'rule_adherence', currentValue: null, targetValue: 85, status: 'active', startDate: '2026-08-11', endDate: '2026-09-03', derivedState: 'upcoming', unavailableReason: 'no_eligible_rule_checks' },
      { name: 'Complete three reviews in prior cycle', metricKey: 'journal_entries', currentValue: 0, targetValue: 3, status: 'active', startDate: '2026-05-26', endDate: '2026-06-05', derivedState: 'missed', unavailableReason: null },
      { name: 'Keep broken checks at five or fewer', metricKey: 'broken_rule_checks', currentValue: 7, targetValue: 5, status: 'active', startDate: '2026-06-30', endDate: '2026-08-04', derivedState: 'in_progress', unavailableReason: null },
    ]);
  });

  test('returns the same expected counts on a simulated rerun', () => {
    const first = summarizeDemoDataset(generateDemoDataset(options));
    const second = summarizeDemoDataset(generateDemoDataset(options));
    assert.deepEqual(second, first);
    assert.deepEqual(validateDemoDataset(generateDemoDataset(options)), first);
  });

  test('contains no random generation or unsupported design entities', () => {
    const source = readFileSync(new URL('./demoSeedData.js', import.meta.url), 'utf8');
    assert.doesNotMatch(source, /Math\.random/);
    const dataset = generateDemoDataset(options);
    for (const key of ['positions', 'executions', 'portfolioTransactions', 'holdings', 'lots', 'dividends', 'allocation', 'notifications']) {
      assert.equal(Object.hasOwn(dataset, key), false);
    }
  });
});
