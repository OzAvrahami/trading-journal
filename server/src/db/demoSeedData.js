import { createHash } from 'node:crypto';
import { computeFields } from '../services/tradeService.js';
import { METRIC_CONFIG, validateGoalDefinition } from '../services/goalsService.js';
import {
  addDaysToDateKey,
  assertTimezone,
  dateKeyInTimezone,
  isValidDateKey,
} from '../utils/dateTime.js';

export const DEMO_ACCOUNT_TYPES = Object.freeze(['funded', 'evaluation', 'demo', 'live']);
export const DEMO_ACCOUNT_STATUSES = Object.freeze(['active', 'inactive', 'archived']);

export const DEMO_DAILY_NET_PNL = Object.freeze([
  -420, 610, 1240, -180, 0, 880, -1310, 2140, 460, -640, 1520,
  -260, 980, -1840, 720, 1360, -520, 240, 1980, -1120, 640, 1006,
]);

const TRADING_DATE_OFFSETS = Object.freeze([
  -35, -28, -25, -24, -23, -22, -21, -18, -17, -16, -15,
  -14, -11, -10, -9, -8, -7, -4, -3, -2, -1, 0,
]);

const ACCOUNT_DEFINITIONS = Object.freeze([
  { company: 'fidelity', accountNumber: 'DEMO-FID-4192', accountName: 'Fidelity Individual', accountType: 'live', status: 'active' },
  { company: 'fidelity', accountNumber: 'DEMO-ROTH-7730', accountName: 'Roth IRA', accountType: 'live', status: 'active' },
  { company: 'interactive brokers', accountNumber: 'DEMO-IBEU-2201', accountName: 'IBKR Europe', accountType: 'live', status: 'active' },
  { company: 'interactive brokers', accountNumber: 'DEMO-IBTR-2288', accountName: 'IBKR Trading', accountType: 'live', status: 'active' },
  { company: 'tradovate', accountNumber: 'DEMO-TRAD-8814', accountName: 'Tradovate Live', accountType: 'live', status: 'active' },
  { company: 'topstep', accountNumber: 'DEMO-TS-150F', accountName: 'Topstep 150K Funded', accountType: 'funded', status: 'active' },
  { company: 'topstep', accountNumber: 'DEMO-TS-50E', accountName: 'Topstep Combine 50K', accountType: 'evaluation', status: 'inactive' },
  { company: 'ninjatrader', accountNumber: 'DEMO-NT-0001', accountName: 'NinjaTrader Demo', accountType: 'demo', status: 'archived' },
]);

const SYMBOLS = Object.freeze(['MNQ', 'NQ', 'ES', 'MES', 'AAPL', 'NVDA', 'TSLA']);
const STRATEGIES = Object.freeze([
  'Opening Range Breakout', 'VWAP Reclaim', 'Trend Continuation',
  'Mean Reversion', 'Support Resistance', 'Momentum',
]);
const SETUPS = Object.freeze(['Breakout', 'Pullback', 'Reversal', 'Range Fade', 'Continuation']);
const TIMEFRAMES = Object.freeze(['1m', '5m', '15m', '30m', '1h']);

function stableUuid(namespace, userId, anchorDate, index) {
  const hex = createHash('sha256')
    .update(`${namespace}:${userId}:${anchorDate}:${index}`)
    .digest('hex')
    .slice(0, 32);
  const variant = ['8', '9', 'a', 'b'][Number.parseInt(hex[16], 16) % 4];
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-4${hex.slice(13, 16)}-${variant}${hex.slice(17, 20)}-${hex.slice(20, 32)}`;
}

function zonedParts(instant, timezone) {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: timezone,
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23',
  }).formatToParts(instant);
  return Object.fromEntries(parts.map((part) => [part.type, part.value]));
}

export function localDateTimeToInstant(dateKey, time, timezone) {
  if (!isValidDateKey(dateKey) || !/^\d{2}:\d{2}:\d{2}$/.test(time)) {
    throw new RangeError('Expected a valid local YYYY-MM-DD and HH:mm:ss value.');
  }
  const zone = assertTimezone(timezone);
  const [year, month, day] = dateKey.split('-').map(Number);
  const [hour, minute, second] = time.split(':').map(Number);
  if (hour > 23 || minute > 59 || second > 59) throw new RangeError('Expected a valid local time.');
  const desired = Date.UTC(year, month - 1, day, hour, minute, second);
  let candidate = desired;
  for (let attempt = 0; attempt < 4; attempt += 1) {
    const parts = zonedParts(new Date(candidate), zone);
    const represented = Date.UTC(
      Number(parts.year), Number(parts.month) - 1, Number(parts.day),
      Number(parts.hour), Number(parts.minute), Number(parts.second),
    );
    const adjustment = desired - represented;
    candidate += adjustment;
    if (adjustment === 0) return new Date(candidate);
  }
  const final = zonedParts(new Date(candidate), zone);
  if (`${final.year}-${final.month}-${final.day} ${final.hour}:${final.minute}:${final.second}` !== `${dateKey} ${time}`) {
    throw new RangeError(`Local date-time is not representable in ${zone}.`);
  }
  return new Date(candidate);
}

function timeForSlot(slot, baseMinutes = 9 * 60 + 35) {
  const total = baseMinutes + slot * 47;
  return `${String(Math.floor(total / 60)).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}:00`;
}

function splitAmount(total, count) {
  const cents = Math.round(total * 100);
  const base = Math.floor(cents / count);
  let remainder = cents - base * count;
  return Array.from({ length: count }, () => {
    const value = base + (remainder > 0 ? 1 : 0);
    remainder -= remainder > 0 ? 1 : 0;
    return value / 100;
  });
}

function buildTrade({ userId, anchorDate, timezone, accounts, date, pnlNet, index, slot, open = false }) {
  const symbol = SYMBOLS[index % SYMBOLS.length];
  const market = ['AAPL', 'NVDA', 'TSLA'].includes(symbol) ? 'stocks' : 'futures';
  const direction = index % 2 === 0 ? 'long' : 'short';
  const quantity = market === 'stocks' ? 50 : 2;
  const basePrices = { MNQ: 23200, NQ: 23100, ES: 5600, MES: 5580, AAPL: 220, NVDA: 185, TSLA: 300 };
  const entryPrice = Number((basePrices[symbol] + (index % 13) * (market === 'stocks' ? 0.35 : 3.25)).toFixed(8));
  const entry = localDateTimeToInstant(date, timeForSlot(slot, open ? 13 * 60 + 5 : 9 * 60 + 35), timezone);
  const riskAmount = 350 + (index % 5) * 75;
  const fee = open ? 0 : (index < 28 ? 7 : 6);
  const gross = open ? null : Number((pnlNet + fee).toFixed(4));
  const delta = open ? null : gross / quantity;
  const exitPrice = open ? null : Number((direction === 'long' ? entryPrice + delta : entryPrice - delta).toFixed(8));
  if (exitPrice != null && exitPrice <= 0) throw new Error(`Generated an invalid exit price for trade ${index}.`);
  const exit = open ? null : new Date(entry.getTime() + (18 + (index % 7) * 11) * 60000);
  const fields = {
    direction,
    entryPrice,
    exitPrice,
    quantity,
    fees: fee,
    riskAmount,
    entryDatetime: entry.toISOString(),
    exitDatetime: exit?.toISOString() ?? null,
  };
  const computed = computeFields(fields);
  if (!open && Math.abs(computed.pnlNet - pnlNet) > 0.0001) {
    throw new Error(`Production trade calculation drifted for generated trade ${index}.`);
  }
  const stopDistance = riskAmount / quantity;
  return {
    id: stableUuid('trade', userId, anchorDate, index),
    userId,
    accountId: accounts[index % accounts.length].id,
    symbol,
    market,
    direction,
    entryDatetime: fields.entryDatetime,
    exitDatetime: fields.exitDatetime,
    entryPrice,
    exitPrice,
    quantity,
    fees: fee,
    strategy: STRATEGIES[index % STRATEGIES.length],
    setup: SETUPS[index % SETUPS.length],
    timeframe: TIMEFRAMES[index % TIMEFRAMES.length],
    riskAmount,
    stopLoss: Number((direction === 'long' ? entryPrice - stopDistance : entryPrice + stopDistance).toFixed(8)),
    takeProfit: Number((direction === 'long' ? entryPrice + stopDistance * 2 : entryPrice - stopDistance * 2).toFixed(8)),
    notes: open ? 'Demo open trade with no fabricated unrealized result.' : 'Deterministic design-inspired demo trade.',
    emotions: { pre: 'focused', during: index % 4 === 0 ? 'patient' : 'calm', post: open ? '' : 'reflective' },
    screenshotLinks: [],
    dedupKey: null,
    ...computed,
    createdAt: fields.entryDatetime,
    updatedAt: fields.exitDatetime ?? fields.entryDatetime,
  };
}

function buildTrades(userId, anchorDate, timezone, accounts, tradingDates) {
  const closed = [];
  let tradeIndex = 0;
  let mixedIndex = 0;
  DEMO_DAILY_NET_PNL.forEach((dayNet, dayIndex) => {
    const positiveOnly = dayIndex === 1 || dayIndex === 2;
    const mixed = !positiveOnly;
    const internalOffset = mixed ? (mixedIndex++ === 0 ? 224 : 220) : 0;
    const positiveTotal = dayNet >= 0 ? dayNet + internalOffset : internalOffset;
    const negativeTotal = mixed ? (dayNet >= 0 ? internalOffset : Math.abs(dayNet) + internalOffset) : 0;
    const winnerCount = dayIndex < 9 ? 2 : 1;
    const outcomes = [
      ...splitAmount(positiveTotal, winnerCount),
      ...(mixed ? [-negativeTotal] : []),
      ...(dayNet === 0 ? [0, 0] : []),
    ];
    outcomes.forEach((pnlNet, slot) => {
      closed.push(buildTrade({
        userId, anchorDate, timezone, accounts,
        date: tradingDates[dayIndex], pnlNet, index: tradeIndex, slot,
      }));
      tradeIndex += 1;
    });
  });

  const openOffsets = [0, -1, -7, -35];
  const open = openOffsets.map((offset, index) => buildTrade({
    userId, anchorDate, timezone, accounts,
    date: addDaysToDateKey(anchorDate, offset), pnlNet: null,
    index: tradeIndex + index, slot: index, open: true,
  }));
  return [...closed, ...open];
}

function buildJournal(userId, anchorDate, timezone, trades) {
  const definitions = [
    [-0, 'daily_review', 'Today: patient execution', 'I followed the morning plan, recorded every trade, and stopped after the final planned setup.', ['discipline', 'daily-review'], true],
    [-1, 'trade_review', 'Review: confirmation before entry', 'The entry followed confirmation and the exit respected the planned invalidation level.', ['execution', 'confirmation'], true],
    [-2, 'daily_review', 'Daily review: one avoidable re-entry', 'The first two setups were valid. The final re-entry was rushed and is documented for the next session.', ['rules', 'patience'], true],
    [-3, 'note', 'Pre-market focus list', 'Trade documented setups only and reduce size when the opening range is unclear.', ['plan', 'risk'], false],
    [-4, 'trade_review', 'Review: VWAP reclaim', 'Waiting for the retest improved the entry and kept risk defined before execution.', ['VWAP', 'review'], true],
    [-7, 'weekly_review', 'Weekly review: first-hour edge', 'The strongest results came from documented setups during the first hour. Late entries remain the main process risk.', ['weekly-review', 'timing'], true],
    [-8, 'daily_review', 'Daily review: protected the loss limit', 'A difficult start remained controlled because the daily loss limit was respected.', ['risk', 'daily-review'], true],
    [-10, 'trade_review', 'Review: range fade loss', 'The trade lacked confirmation. The loss was contained, and the setup is flagged for stricter selection.', ['range-fade', 'mistake'], false],
    [-14, 'weekly_review', 'Weekly review: sizing consistency', 'Risk stayed consistent across accounts and no stop was moved farther away.', ['weekly-review', 'sizing'], true],
    [-18, 'daily_review', 'Daily review: strong process day', 'Only documented setups were taken and the session ended after the planned trade count.', ['process', 'discipline'], true],
    [-21, 'note', 'Rule reminder for runners', 'A runner needs a structural target before entry; otherwise the planned exit remains final.', ['rules', 'exits'], false],
    [-24, 'trade_review', 'Review: momentum continuation', 'The continuation entry was aligned with trend and the stop stayed at the original invalidation.', ['momentum', 'review'], true],
    [-28, 'weekly_review', 'Weekly review: reduce marginal setups', 'Mean-reversion attempts underperformed. Next week prioritizes opening range and trend continuation.', ['weekly-review', 'setups'], true],
    [-35, 'note', 'Demo dataset starting notes', 'This entry anchors the deterministic review history without adding unsupported portfolio concepts.', ['demo', 'journal'], false],
  ];
  const entries = definitions.map(([offset, entryType, title, content, tags, isComplete], index) => {
    const entryDate = addDaysToDateKey(anchorDate, offset);
    const createdAt = localDateTimeToInstant(entryDate, '18:15:00', timezone).toISOString();
    return {
      id: stableUuid('journal', userId, anchorDate, index), userId, entryType, entryDate,
      title, content, tags, isComplete, createdAt, updatedAt: createdAt,
    };
  });
  const closedTrades = trades.filter((trade) => trade.status === 'closed');
  const links = entries.flatMap((entry, entryIndex) => {
    const linkCount = entry.entryType === 'weekly_review' ? 3 : entry.entryType === 'note' ? 0 : 2;
    return Array.from({ length: linkCount }, (_, linkIndex) => ({
      userId,
      journalEntryId: entry.id,
      tradeId: closedTrades[(entryIndex * 3 + linkIndex) % closedTrades.length].id,
      createdAt: entry.createdAt,
    }));
  });
  return { entries, links };
}

function buildRules(userId, anchorDate, timezone, trades, journalEntries, tradingDates) {
  const definitions = [
    ['Define risk before entry', 'Risk amount, stop and invalidation must be clear before entry.', 'trade', true],
    ['Never move the stop farther away', 'A stop may tighten but never increase the original risk.', 'trade', true],
    ['Stop trading after daily loss limit', 'End the session when the documented daily loss limit is reached.', 'daily', true],
    ['Trade only documented setups', 'Every trade must use a named strategy and setup.', 'trade', true],
    ['Wait for confirmation before entry', 'Do not anticipate a signal before confirmation is present.', 'trade', true],
    ['Record every completed session', 'Create a daily review after each completed trading session.', 'daily', true],
    ['Respect maximum trades per day', 'Do not exceed the planned maximum number of daily trades.', 'daily', false],
    ['Review rule breaks before next session', 'Broken checks must be reviewed before the next session.', 'general', true],
  ];
  const rules = definitions.map(([name, description, scope, isActive], index) => {
    const createdAt = localDateTimeToInstant(addDaysToDateKey(anchorDate, -40), '12:00:00', timezone).toISOString();
    return {
      id: stableUuid('rule', userId, anchorDate, index), userId, name, description,
      scope, isActive, sortOrder: index, createdAt, updatedAt: createdAt,
    };
  });
  const closedTrades = trades.filter((trade) => trade.status === 'closed');
  const checks = [];
  rules.slice(0, 7).forEach((rule, ruleIndex) => {
    for (let checkIndex = 0; checkIndex < 6; checkIndex += 1) {
      const date = tradingDates[(ruleIndex * 3 + checkIndex) % tradingDates.length];
      const outcome = (ruleIndex + checkIndex) % 7 === 0
        ? 'not_applicable'
        : (ruleIndex * 2 + checkIndex) % 5 === 0 ? 'broken' : 'followed';
      checks.push({
        id: stableUuid('rule-check', userId, anchorDate, checks.length),
        userId,
        ruleId: rule.id,
        checkDate: date,
        outcome,
        notes: outcome === 'broken' ? 'Documented demo exception for review.' : outcome === 'followed' ? 'Plan followed.' : 'Rule did not apply to this context.',
        tradeId: checkIndex % 2 === 0 ? closedTrades[(ruleIndex * 5 + checkIndex) % closedTrades.length].id : null,
        journalEntryId: checkIndex % 3 === 0 ? journalEntries[(ruleIndex + checkIndex) % journalEntries.length].id : null,
        createdAt: localDateTimeToInstant(date, '17:30:00', timezone).toISOString(),
      });
    }
  });
  for (let index = 0; index < 2; index += 1) {
    const date = tradingDates[tradingDates.length - 1 - index];
    checks.push({
      id: stableUuid('rule-check', userId, anchorDate, checks.length), userId,
      ruleId: rules[7].id, checkDate: date, outcome: 'not_applicable',
      notes: 'No prior break required review.', tradeId: null,
      journalEntryId: journalEntries[index].id,
      createdAt: localDateTimeToInstant(date, '18:30:00', timezone).toISOString(),
    });
  }
  return { rules, checks };
}

function buildGoals(userId, anchorDate, timezone, tradingDates) {
  const fullStart = tradingDates[0];
  const createdAt = localDateTimeToInstant(addDaysToDateKey(anchorDate, -36), '12:00:00', timezone).toISOString();
  const definitions = [
    ['Reach $7,000 net PnL', 'Closed-trade net PnL across the demo period.', 'net_pnl', 7000, fullStart, anchorDate, 'active'],
    ['Complete 60 closed trades', 'Build a consistent sample without manual progress.', 'closed_trades', 60, fullStart, addDaysToDateKey(anchorDate, 14), 'active'],
    ['Maintain a 60% win rate', 'Paused while setup selection is reviewed.', 'win_rate', 60, fullStart, anchorDate, 'paused'],
    ['Average at least 0.30R', 'Archived historical process target.', 'average_r', 0.3, fullStart, anchorDate, 'archived'],
    ['Reach 85% rule adherence next cycle', 'Upcoming and unavailable until eligible checks exist.', 'rule_adherence', 85, addDaysToDateKey(anchorDate, 7), addDaysToDateKey(anchorDate, 30), 'active'],
    ['Complete three reviews in prior cycle', 'A deliberately missed historical Journal target.', 'journal_entries', 3, addDaysToDateKey(anchorDate, -70), addDaysToDateKey(anchorDate, -60), 'active'],
    ['Keep broken checks at five or fewer', 'Maximum permitted broken checks in the demo period.', 'broken_rule_checks', 5, fullStart, anchorDate, 'active'],
  ];
  return definitions.map(([name, description, metricKey, targetValue, startDate, endDate, status], index) => ({
    id: stableUuid('goal', userId, anchorDate, index), userId, name, description, metricKey,
    comparison: METRIC_CONFIG[metricKey].comparison, targetValue, startDate, endDate,
    status, createdAt, updatedAt: createdAt,
  }));
}

export function summarizeDemoDataset(dataset) {
  const closed = dataset.trades.filter((trade) => trade.status === 'closed');
  const winners = closed.filter((trade) => trade.pnlNet > 0);
  const losers = closed.filter((trade) => trade.pnlNet < 0);
  const breakeven = closed.filter((trade) => trade.pnlNet === 0);
  const sum = (rows, field) => rows.reduce((total, row) => total + Number(row[field] ?? 0), 0);
  const grossProfit = sum(winners, 'pnlNet');
  const grossLoss = Math.abs(sum(losers, 'pnlNet'));
  return {
    accounts: dataset.accounts.length,
    trades: dataset.trades.length,
    closed: closed.length,
    open: dataset.trades.length - closed.length,
    winners: winners.length,
    losers: losers.length,
    breakeven: breakeven.length,
    tradingDates: new Set(dataset.trades.map((trade) => dateKeyInTimezone(dataset.timezone, new Date(trade.entryDatetime)))).size,
    pnlNet: Number(sum(closed, 'pnlNet').toFixed(2)),
    totalFees: Number(sum(dataset.trades, 'fees').toFixed(2)),
    expectancy: Number((sum(closed, 'pnlNet') / closed.length).toFixed(2)),
    profitFactor: Number((grossProfit / grossLoss).toFixed(4)),
    journalEntries: dataset.journalEntries.length,
    journalLinks: dataset.journalEntryTrades.length,
    rules: dataset.rules.length,
    ruleChecks: dataset.ruleChecks.length,
    goals: dataset.goals.length,
  };
}

export function validateDemoDataset(dataset) {
  const summary = summarizeDemoDataset(dataset);
  const expected = {
    accounts: 8, trades: 57, closed: 53, open: 4, winners: 31, losers: 20,
    breakeven: 2, tradingDates: 22, pnlNet: 7486, totalFees: 346,
    journalEntries: 14, rules: 8, goals: 7,
  };
  Object.entries(expected).forEach(([key, value]) => {
    if (summary[key] !== value) throw new Error(`Demo dataset ${key} expected ${value}, received ${summary[key]}.`);
  });
  if (Math.abs(summary.expectancy - 141.25) > 0.01 || Math.abs(summary.profitFactor - 1.699) > 0.001) {
    throw new Error('Demo headline calculations are inconsistent.');
  }
  const ownedCollections = [dataset.accounts, dataset.trades, dataset.journalEntries, dataset.journalEntryTrades, dataset.rules, dataset.ruleChecks, dataset.goals];
  if (ownedCollections.some((rows) => rows.some((row) => row.userId !== dataset.userId))) {
    throw new Error('Demo dataset contains a foreign user row.');
  }
  if (dataset.accounts.some((account) => !DEMO_ACCOUNT_TYPES.includes(account.accountType) || !DEMO_ACCOUNT_STATUSES.includes(account.status))) {
    throw new Error('Demo account enum is invalid.');
  }
  const accountIds = new Set(dataset.accounts.map((account) => account.id));
  dataset.trades.forEach((trade) => {
    if (!accountIds.has(trade.accountId)) throw new Error('Demo trade references a foreign account.');
    const computed = computeFields(trade);
    for (const key of ['status', 'pnlGross', 'pnlNet', 'rMultiple', 'durationMinutes']) {
      if (computed[key] !== trade[key]) throw new Error(`Demo trade ${trade.id} has inconsistent ${key}.`);
    }
    if (trade.durationMinutes != null && trade.durationMinutes < 0) throw new Error('Demo trade has negative duration.');
  });
  const tradeIds = new Set(dataset.trades.map((trade) => trade.id));
  const journalIds = new Set(dataset.journalEntries.map((entry) => entry.id));
  if (dataset.journalEntryTrades.some((link) => !journalIds.has(link.journalEntryId) || !tradeIds.has(link.tradeId))) {
    throw new Error('Demo Journal link is invalid.');
  }
  const ruleIds = new Set(dataset.rules.map((rule) => rule.id));
  if (dataset.ruleChecks.some((check) => !ruleIds.has(check.ruleId)
    || (check.tradeId && !tradeIds.has(check.tradeId))
    || (check.journalEntryId && !journalIds.has(check.journalEntryId)))) {
    throw new Error('Demo Rule check link is invalid.');
  }
  dataset.goals.forEach((goal) => {
    const issue = validateGoalDefinition(goal);
    if (issue) throw new Error(`Demo goal is invalid: ${issue.message}`);
  });
  return summary;
}

export function generateDemoDataset({ userId, timezone, anchorDate }) {
  if (!userId) throw new Error('A target user ID is required.');
  assertTimezone(timezone);
  if (!isValidDateKey(anchorDate)) throw new RangeError('Expected a valid demo anchor date.');
  const tradingDates = TRADING_DATE_OFFSETS.map((offset) => addDaysToDateKey(anchorDate, offset));
  const accounts = ACCOUNT_DEFINITIONS.map((definition, index) => {
    const createdAt = localDateTimeToInstant(addDaysToDateKey(anchorDate, -45), '12:00:00', timezone).toISOString();
    return {
      id: stableUuid('account', userId, anchorDate, index), userId,
      ...definition, createdAt, updatedAt: createdAt,
    };
  });
  const trades = buildTrades(userId, anchorDate, timezone, accounts, tradingDates);
  const journal = buildJournal(userId, anchorDate, timezone, trades);
  const ruleData = buildRules(userId, anchorDate, timezone, trades, journal.entries, tradingDates);
  const goals = buildGoals(userId, anchorDate, timezone, tradingDates);
  const dataset = {
    userId, timezone, anchorDate, tradingDates, accounts, trades,
    journalEntries: journal.entries, journalEntryTrades: journal.links,
    rules: ruleData.rules, ruleChecks: ruleData.checks, goals,
  };
  validateDemoDataset(dataset);
  return dataset;
}
