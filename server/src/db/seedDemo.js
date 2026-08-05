import 'dotenv/config';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import {
  getCalendar,
  getDistribution,
  getRDistribution,
  getSummary,
} from '../services/analyticsService.js';
import { getJournalCalendar } from '../services/journalService.js';
import { getAdherence } from '../services/rulesService.js';
import { computeProgressForGoals, mapStoredGoal } from '../services/goalsService.js';
import { dateKeyInTimezone, isValidDateKey, isValidTimezone } from '../utils/dateTime.js';
import {
  generateDemoDataset,
  localDateTimeToInstant,
  normalizeDemoLocale,
  summarizeDemoDataset,
  validateDemoDataset,
} from './demoSeedData.js';

export const REQUIRED_CONFIRMATION = 'RESET_MY_DEMO_DATA';
export const DEFAULT_BACKUP_DIRECTORY = fileURLToPath(new URL('../../.local/demo-seed-backups/', import.meta.url));

export const RESET_STEPS = Object.freeze([
  { table: 'goals', sql: 'DELETE FROM goals WHERE user_id = $1' },
  { table: 'rule_checks', sql: 'DELETE FROM rule_checks WHERE user_id = $1' },
  { table: 'trading_rules', sql: 'DELETE FROM trading_rules WHERE user_id = $1' },
  { table: 'journal_entry_trades', sql: 'DELETE FROM journal_entry_trades WHERE user_id = $1' },
  { table: 'daily_review_details', sql: 'DELETE FROM daily_review_details WHERE user_id = $1' },
  { table: 'journal_entries', sql: 'DELETE FROM journal_entries WHERE user_id = $1' },
  { table: 'trades', sql: 'DELETE FROM trades WHERE user_id = $1' },
  { table: 'trading_accounts', sql: 'DELETE FROM trading_accounts WHERE user_id = $1' },
]);

export const BACKUP_SELECTS = Object.freeze([
  { key: 'tradingAccounts', table: 'trading_accounts', sql: 'SELECT * FROM trading_accounts WHERE user_id = $1 ORDER BY created_at, id' },
  { key: 'trades', table: 'trades', sql: 'SELECT * FROM trades WHERE user_id = $1 ORDER BY entry_datetime, id' },
  { key: 'journalEntries', table: 'journal_entries', sql: 'SELECT * FROM journal_entries WHERE user_id = $1 ORDER BY entry_date, created_at, id' },
  { key: 'journalEntryTrades', table: 'journal_entry_trades', sql: 'SELECT * FROM journal_entry_trades WHERE user_id = $1 ORDER BY journal_entry_id, trade_id' },
  { key: 'dailyReviewDetails', table: 'daily_review_details', sql: 'SELECT * FROM daily_review_details WHERE user_id = $1 ORDER BY review_date, journal_entry_id' },
  { key: 'tradingRules', table: 'trading_rules', sql: 'SELECT * FROM trading_rules WHERE user_id = $1 ORDER BY sort_order, created_at, id' },
  { key: 'ruleChecks', table: 'rule_checks', sql: 'SELECT * FROM rule_checks WHERE user_id = $1 ORDER BY check_date, created_at, id' },
  { key: 'goals', table: 'goals', sql: 'SELECT * FROM goals WHERE user_id = $1 ORDER BY created_at, id' },
]);

export function createSerializedQueryExecutor(client) {
  let queue = Promise.resolve();

  return {
    query(...args) {
      const operation = queue.then(() => client.query(...args));
      queue = operation.catch(() => undefined);
      return operation;
    },
  };
}

function printableThrownValue(value) {
  if (value instanceof Error) return value.stack || value.message || value.name || 'Error';
  if (typeof value === 'string') return value || '[empty thrown string]';
  try {
    return JSON.stringify(value) ?? String(value);
  } catch {
    return String(value);
  }
}

export function reportSeedFailure(error, logger = console) {
  logger.error('Demo seed failed.');
  logger.error(printableThrownValue(error));

  if (error instanceof Error && error.rollbackError !== undefined) {
    logger.error('Rollback also failed:');
    logger.error(printableThrownValue(error.rollbackError));
  }
}

function safeNow(value) {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) throw new Error('The demo seed clock is invalid.');
  return date;
}

export function readDemoSeedConfig(env = process.env) {
  if (String(env.NODE_ENV ?? '').trim().toLowerCase() === 'production') {
    throw new Error('Demo reset is forbidden when NODE_ENV=production.');
  }
  const email = String(env.DEMO_USER_EMAIL ?? '').trim();
  if (!email) throw new Error('DEMO_USER_EMAIL is required.');
  if (env.DEMO_RESET_CONFIRM !== REQUIRED_CONFIRMATION) {
    throw new Error(`DEMO_RESET_CONFIRM must exactly equal ${REQUIRED_CONFIRMATION}.`);
  }
  const locale = env.DEMO_LOCALE === undefined ? 'en' : normalizeDemoLocale(env.DEMO_LOCALE);
  const anchorDate = env.DEMO_ANCHOR_DATE == null || env.DEMO_ANCHOR_DATE === ''
    ? null
    : String(env.DEMO_ANCHOR_DATE).trim();
  if (anchorDate != null && !isValidDateKey(anchorDate)) {
    throw new Error('DEMO_ANCHOR_DATE must be a real YYYY-MM-DD calendar date.');
  }
  return { email, anchorDate, locale };
}

export function maskDatabaseHost(databaseUrl) {
  try {
    const host = new URL(databaseUrl).hostname;
    if (!host) return '[unavailable]';
    return host.split('.').map((label) => {
      if (label.length <= 2) return '*'.repeat(label.length);
      return `${label[0]}${'*'.repeat(Math.min(label.length - 2, 6))}${label.at(-1)}`;
    }).join('.');
  } catch {
    return '[unavailable]';
  }
}

function sanitizeEmailForFilename(email) {
  return email.toLowerCase().replace(/[^a-z0-9._-]+/g, '_').replace(/^_+|_+$/g, '') || 'demo-user';
}

function timestampForFilename(now) {
  return now.toISOString().replace(/[:.]/g, '-');
}

export async function writeDemoBackup({ backup, email, now, directory = DEFAULT_BACKUP_DIRECTORY }) {
  await mkdir(directory, { recursive: true });
  const filename = `${sanitizeEmailForFilename(email)}-${timestampForFilename(now)}.json`;
  const destination = path.join(directory, filename);
  await writeFile(destination, `${JSON.stringify(backup, null, 2)}\n`, { encoding: 'utf8', flag: 'wx' });
  return destination;
}

async function loadTargetUser(database, email) {
  const result = await database.query(
    'SELECT id, email, timezone FROM users WHERE lower(email) = lower($1) ORDER BY id',
    [email],
  );
  if (result.rows.length !== 1) {
    throw new Error(`DEMO_USER_EMAIL must identify exactly one user; found ${result.rows.length}.`);
  }
  const user = result.rows[0];
  if (!user?.id || !user?.email) throw new Error('The target user could not be loaded safely.');
  if (!isValidTimezone(user.timezone)) throw new Error('The target user has an invalid IANA timezone.');
  return user;
}

async function loadCurrentCounts(database, userId) {
  const entries = await Promise.all(BACKUP_SELECTS.map(async ({ table }) => {
    const result = await database.query(`SELECT COUNT(*)::int AS count FROM ${table} WHERE user_id = $1`, [userId]);
    return [table, Number(result.rows[0]?.count ?? 0)];
  }));
  return Object.fromEntries(entries);
}

async function collectBackup(database, user, now, demoLocale) {
  const data = {};
  for (const { key, sql } of BACKUP_SELECTS) {
    const result = await database.query(sql, [user.id]);
    data[key] = result.rows;
  }
  return {
    metadata: {
      version: 1,
      exportedAt: now.toISOString(),
      timezone: user.timezone,
      demoLocale,
      targetUserId: user.id,
    },
    ...data,
  };
}

function warningLines({ user, counts, anchorDate, host, locale }) {
  return [
    'DESTRUCTIVE DEMO RESET (one user only)',
    `Target email: ${user.email}`,
    `Target user ID: ${user.id}`,
    `User timezone: ${user.timezone}`,
    `Database host: ${host}`,
    `Anchor date: ${anchorDate}`,
    `Demo locale: ${locale}`,
    `Current records: ${RESET_STEPS.map(({ table }) => `${table}=${counts[table] ?? 0}`).join(', ')}`,
    'Preserved: users, refresh_tokens, schema_migrations, profile, timezone, and authentication sessions.',
  ];
}

async function insertAccounts(client, accounts) {
  for (const account of accounts) {
    await client.query(
      `INSERT INTO trading_accounts
         (id, user_id, company, account_number, account_name, account_type, status, created_at, updated_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
      [account.id, account.userId, account.company, account.accountNumber, account.accountName,
        account.accountType, account.status, account.createdAt, account.updatedAt],
    );
  }
}

async function insertTrades(client, trades) {
  for (const trade of trades) {
    await client.query(
      `INSERT INTO trades (
         id, user_id, account_id, symbol, market, direction,
         entry_datetime, exit_datetime, entry_price, exit_price, quantity, fees,
         strategy, setup, timeframe, risk_amount, stop_loss, take_profit, notes,
         emotions, screenshot_links, status, pnl_gross, pnl_net, r_multiple,
         duration_minutes, dedup_key, created_at, updated_at
       ) VALUES (
         $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,
         $20,$21,$22,$23,$24,$25,$26,$27,$28,$29
       )`,
      [
        trade.id, trade.userId, trade.accountId, trade.symbol, trade.market, trade.direction,
        trade.entryDatetime, trade.exitDatetime, trade.entryPrice, trade.exitPrice, trade.quantity, trade.fees,
        trade.strategy, trade.setup, trade.timeframe, trade.riskAmount, trade.stopLoss, trade.takeProfit, trade.notes,
        JSON.stringify(trade.emotions), trade.screenshotLinks, trade.status, trade.pnlGross, trade.pnlNet,
        trade.rMultiple, trade.durationMinutes, trade.dedupKey, trade.createdAt, trade.updatedAt,
      ],
    );
  }
}

async function insertJournal(client, entries, links, details) {
  for (const entry of entries) {
    await client.query(
      `INSERT INTO journal_entries
         (id, user_id, entry_type, entry_date, title, content, tags, is_complete, created_at, updated_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
      [entry.id, entry.userId, entry.entryType, entry.entryDate, entry.title, entry.content,
        entry.tags, entry.isComplete, entry.createdAt, entry.updatedAt],
    );
  }
  for (const link of links) {
    await client.query(
      `INSERT INTO journal_entry_trades (journal_entry_id, trade_id, user_id, created_at)
       VALUES ($1,$2,$3,$4)`,
      [link.journalEntryId, link.tradeId, link.userId, link.createdAt],
    );
  }
  for (const detail of details) {
    await client.query(
      `INSERT INTO daily_review_details
         (journal_entry_id, user_id, review_date, went_well, improve, next_session_plan,
          emotions, mistakes, created_at, updated_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
      [detail.journalEntryId, detail.userId, detail.reviewDate, detail.wentWell, detail.improve,
        detail.nextSessionPlan, detail.emotions, detail.mistakes, detail.createdAt, detail.updatedAt],
    );
  }
}

async function insertRules(client, rules, checks) {
  for (const rule of rules) {
    await client.query(
      `INSERT INTO trading_rules
         (id, user_id, name, description, scope, is_active, sort_order, created_at, updated_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
      [rule.id, rule.userId, rule.name, rule.description, rule.scope, rule.isActive,
        rule.sortOrder, rule.createdAt, rule.updatedAt],
    );
  }
  for (const check of checks) {
    await client.query(
      `INSERT INTO rule_checks
         (id, user_id, rule_id, check_date, outcome, notes, trade_id, journal_entry_id, created_at, updated_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$9)`,
      [check.id, check.userId, check.ruleId, check.checkDate, check.outcome, check.notes,
        check.tradeId, check.journalEntryId, check.createdAt],
    );
  }
}

async function insertGoals(client, goals) {
  for (const goal of goals) {
    await client.query(
      `INSERT INTO goals
         (id, user_id, name, description, metric_key, comparison, target_value,
          start_date, end_date, status, created_at, updated_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)`,
      [goal.id, goal.userId, goal.name, goal.description, goal.metricKey, goal.comparison,
        goal.targetValue, goal.startDate, goal.endDate, goal.status, goal.createdAt, goal.updatedAt],
    );
  }
}

export async function insertDemoDataset(client, dataset) {
  await insertAccounts(client, dataset.accounts);
  await insertTrades(client, dataset.trades);
  await insertJournal(client, dataset.journalEntries, dataset.journalEntryTrades, dataset.dailyReviewDetails);
  await insertRules(client, dataset.rules, dataset.ruleChecks);
  await insertGoals(client, dataset.goals);
}

const INTEGRITY_SQL = `SELECT
  (SELECT COUNT(*)::int FROM trading_accounts WHERE user_id = $1) AS accounts,
  (SELECT COUNT(*)::int FROM trades WHERE user_id = $1) AS trades,
  (SELECT COUNT(*)::int FROM trades WHERE user_id = $1 AND status = 'closed') AS closed,
  (SELECT COUNT(*)::int FROM trades WHERE user_id = $1 AND status = 'open') AS open,
  (SELECT COUNT(*)::int FROM trades WHERE user_id = $1 AND status = 'closed' AND pnl_net > 0) AS winners,
  (SELECT COUNT(*)::int FROM trades WHERE user_id = $1 AND status = 'closed' AND pnl_net < 0) AS losers,
  (SELECT COUNT(*)::int FROM trades WHERE user_id = $1 AND status = 'closed' AND pnl_net = 0) AS breakeven,
  (SELECT COUNT(DISTINCT (entry_datetime AT TIME ZONE $2)::date)::int FROM trades WHERE user_id = $1) AS trading_dates,
  (SELECT COUNT(*)::int FROM trades WHERE user_id = $1 AND ((exit_datetime IS NULL) <> (exit_price IS NULL))) AS invalid_exit_pairs,
  (SELECT COUNT(*)::int FROM trades WHERE user_id = $1 AND duration_minutes < 0) AS negative_durations,
  (SELECT COUNT(*)::int FROM trades t LEFT JOIN trading_accounts a ON a.id = t.account_id AND a.user_id = t.user_id
    WHERE t.user_id = $1 AND a.id IS NULL) AS foreign_accounts,
  (SELECT COUNT(*)::int FROM journal_entries WHERE user_id = $1) AS journal_entries,
  (SELECT COUNT(*)::int FROM journal_entry_trades WHERE user_id = $1) AS journal_links,
  (SELECT COUNT(*)::int FROM daily_review_details WHERE user_id = $1) AS daily_review_details,
  (SELECT COUNT(*)::int FROM daily_review_details drd
    LEFT JOIN journal_entries je ON je.id = drd.journal_entry_id AND je.user_id = drd.user_id
    WHERE drd.user_id = $1 AND (je.id IS NULL OR je.entry_type <> 'daily_review' OR je.entry_date <> drd.review_date)) AS invalid_daily_review_details,
  (SELECT COUNT(*)::int FROM journal_entry_trades jet
    LEFT JOIN journal_entries je ON je.id = jet.journal_entry_id AND je.user_id = jet.user_id
    LEFT JOIN trades t ON t.id = jet.trade_id AND t.user_id = jet.user_id
    WHERE jet.user_id = $1 AND (je.id IS NULL OR t.id IS NULL)) AS invalid_journal_links,
  (SELECT COUNT(*)::int FROM trading_rules WHERE user_id = $1) AS rules,
  (SELECT COUNT(*)::int FROM rule_checks WHERE user_id = $1) AS rule_checks,
  (SELECT COUNT(*)::int FROM rule_checks rc
    LEFT JOIN trading_rules r ON r.id = rc.rule_id AND r.user_id = rc.user_id
    LEFT JOIN trades t ON t.id = rc.trade_id AND t.user_id = rc.user_id
    LEFT JOIN journal_entries je ON je.id = rc.journal_entry_id AND je.user_id = rc.user_id
    WHERE rc.user_id = $1 AND (r.id IS NULL OR (rc.trade_id IS NOT NULL AND t.id IS NULL)
      OR (rc.journal_entry_id IS NOT NULL AND je.id IS NULL))) AS invalid_rule_links,
  (SELECT COUNT(*)::int FROM trading_rules r WHERE r.user_id = $1 AND NOT EXISTS (
    SELECT 1 FROM rule_checks rc WHERE rc.user_id = $1 AND rc.rule_id = r.id AND rc.outcome IN ('followed','broken')
  )) AS rules_without_eligible,
  (SELECT COUNT(*)::int FROM trading_rules r WHERE r.user_id = $1 AND r.is_active = FALSE AND EXISTS (
    SELECT 1 FROM rule_checks rc WHERE rc.user_id = $1 AND rc.rule_id = r.id
  )) AS inactive_rules_with_history,
  (SELECT COUNT(*)::int FROM goals WHERE user_id = $1) AS goals`;

function expectCount(row, key, expected) {
  const actual = Number(row[key] ?? -1);
  if (actual !== expected) throw new Error(`Post-seed ${key} expected ${expected}, received ${actual}.`);
}

export function formatGoalDiagnostics(goals) {
  return goals.map((goal) => ({
    name: goal.name,
    metricKey: goal.metricKey,
    currentValue: goal.currentValue ?? null,
    targetValue: goal.targetValue ?? null,
    storedStatus: goal.status,
    startDate: goal.startDate,
    endDate: goal.endDate,
    derivedState: goal.derivedState,
    unavailableReason: goal.unavailableReason ?? null,
  }));
}

export function validateComputedDemoGoals(computedGoals) {
  const diagnostics = JSON.stringify(formatGoalDiagnostics(computedGoals));
  if (computedGoals.length !== 7 || computedGoals.some((goal) => goal.unavailableReason === 'source_unavailable')) {
    throw new Error(`Goals could not be computed from the seeded sources. Goals: ${diagnostics}`);
  }
  const states = new Set(computedGoals.map((goal) => goal.derivedState));
  for (const required of ['upcoming', 'in_progress', 'achieved', 'missed', 'paused', 'archived']) {
    if (!states.has(required)) {
      throw new Error(`Demo Goals are missing the ${required} derived state. Goals: ${diagnostics}`);
    }
  }
  if (!computedGoals.some((goal) => !goal.hasData && ['no_r_data', 'no_eligible_rule_checks', 'no_closed_trades'].includes(goal.unavailableReason))) {
    throw new Error(`Demo Goals require one truthful unavailable ratio or average. Goals: ${diagnostics}`);
  }
}

export async function validatePersistedDemo(client, dataset) {
  const expected = summarizeDemoDataset(dataset);
  const integrity = await client.query(INTEGRITY_SQL, [dataset.userId, dataset.timezone]);
  const row = integrity.rows[0] ?? {};
  for (const key of ['accounts', 'trades', 'closed', 'open', 'winners', 'losers', 'breakeven', 'tradingDates', 'journalEntries', 'journalLinks', 'dailyReviewDetails', 'rules', 'ruleChecks', 'goals']) {
    expectCount(row, key.replace(/[A-Z]/g, (letter) => `_${letter.toLowerCase()}`), expected[key]);
  }
  for (const key of ['invalid_exit_pairs', 'negative_durations', 'foreign_accounts', 'invalid_journal_links', 'invalid_daily_review_details', 'invalid_rule_links']) {
    expectCount(row, key, 0);
  }
  if (Number(row.rules_without_eligible) < 1 || Number(row.inactive_rules_with_history) < 1) {
    throw new Error('Post-seed Rule history invariants were not satisfied.');
  }

  const scope = { from: dataset.tradingDates[0], to: dataset.anchorDate };
  const anchorInstant = localDateTimeToInstant(dataset.anchorDate, '12:00:00', dataset.timezone);
  const serializedQueries = createSerializedQueryExecutor(client);
  const summary = await getSummary(dataset.userId, scope, dataset.timezone, anchorInstant, serializedQueries);
  if (summary.totals.tradesClosed !== 53 || summary.totals.tradesOpen !== 4
    || summary.totals.winners !== 31 || summary.totals.losers !== 20
    || summary.totals.pnlNet !== 7486 || summary.totals.totalFees !== 346
    || Math.abs(summary.totals.expectancy - 141.25) > 0.01
    || Math.abs(summary.totals.profitFactor - 1.7) > 0.001) {
    throw new Error('Production Analytics summary did not match the deterministic KPI contract.');
  }
  if (summary.today.tradesCount < 1 || summary.wtd.tradesCount < 1 || summary.mtd.tradesCount < 1) {
    throw new Error('Today, WTD and MTD Analytics must contain demo activity.');
  }
  const rDistribution = await getRDistribution(dataset.userId, scope, dataset.timezone, serializedQueries);
  if (rDistribution.totalTrades !== 53 || rDistribution.buckets.reduce((sum, bucket) => sum + bucket.count, 0) !== 53) {
    throw new Error('Production R distribution validation failed.');
  }
  const dollarDistribution = await getDistribution(dataset.userId, scope, dataset.timezone, serializedQueries);
  if (dollarDistribution.buckets.reduce((sum, bucket) => sum + bucket.count, 0) !== 53) {
    throw new Error('Production dollar distribution validation failed.');
  }
  const calendar = await getCalendar(dataset.userId, scope, dataset.timezone, serializedQueries);
  if (calendar.days.length !== 22) throw new Error('Production Analytics calendar must contain 22 trading dates.');
  const journalCalendar = await getJournalCalendar(dataset.userId, dataset.anchorDate.slice(0, 7), serializedQueries);
  if (!journalCalendar.days.length) throw new Error('Journal calendar validation returned no demo dates.');
  const adherence = await getAdherence(dataset.userId, scope, serializedQueries);
  if (adherence.summary.eligibleChecks < 1 || adherence.summary.notApplicable < 1) {
    throw new Error('Rule adherence validation requires eligible and not-applicable checks.');
  }
  const goalRows = await serializedQueries.query('SELECT * FROM goals WHERE user_id = $1 ORDER BY created_at, id', [dataset.userId]);
  const computedGoals = await computeProgressForGoals(
    dataset.userId,
    goalRows.rows.map(mapStoredGoal),
    serializedQueries,
    dataset.anchorDate,
    dataset.timezone,
  );
  validateComputedDemoGoals(computedGoals);
  return { summary, rDistribution, dollarDistribution, calendar, journalCalendar, adherence, goals: computedGoals };
}

export async function runDemoSeed({
  env = process.env,
  database,
  now = new Date(),
  backupDirectory = DEFAULT_BACKUP_DIRECTORY,
  backupWriter = writeDemoBackup,
  persistedValidator = validatePersistedDemo,
  logger = console,
} = {}) {
  const config = readDemoSeedConfig(env);
  if (!database?.query || !database?.connect) throw new Error('A database pool is required.');
  const clock = safeNow(now);
  const user = await loadTargetUser(database, config.email);
  const anchorDate = config.anchorDate ?? dateKeyInTimezone(user.timezone, clock);
  const counts = await loadCurrentCounts(database, user.id);
  const backup = await collectBackup(database, user, clock, config.locale);
  const backupPath = await backupWriter({ backup, email: user.email, now: clock, directory: backupDirectory });

  for (const line of warningLines({
    user,
    counts,
    anchorDate,
    host: maskDatabaseHost(env.DATABASE_URL),
    locale: config.locale,
  })) logger.warn(line);

  const client = await database.connect();
  let began = false;
  try {
    await client.query('BEGIN');
    began = true;
    const deleted = {};
    for (const step of RESET_STEPS) {
      const result = await client.query(step.sql, [user.id]);
      deleted[step.table] = Number(result.rowCount ?? 0);
    }
    const dataset = generateDemoDataset({ userId: user.id, timezone: user.timezone, anchorDate, locale: config.locale });
    validateDemoDataset(dataset);
    await insertDemoDataset(client, dataset);
    const validation = await persistedValidator(client, dataset);
    await client.query('COMMIT');
    began = false;
    const summary = summarizeDemoDataset(dataset);
    logger.info(`Demo seed committed for ${user.email}: ${summary.accounts} accounts, ${summary.closed} closed trades, ${summary.open} open trades, ${summary.journalEntries} Journal entries, ${summary.rules} rules, ${summary.goals} goals.`);
    logger.info(`Backup: ${backupPath}`);
    return { user: { id: user.id, email: user.email, timezone: user.timezone }, anchorDate, locale: config.locale, backupPath, deleted, summary, validation };
  } catch (error) {
    let failure = error;
    if (began) {
      try {
        await client.query('ROLLBACK');
      } catch (rollbackError) {
        if (failure instanceof Error) {
          failure.rollbackError = rollbackError;
        } else {
          const wrapped = new Error('Demo seed failed with a non-Error thrown value.');
          wrapped.cause = failure;
          wrapped.rollbackError = rollbackError;
          failure = wrapped;
        }
      }
    }
    throw failure;
  } finally {
    client.release();
  }
}

export async function main() {
  let pool;
  try {
    readDemoSeedConfig(process.env);
    ({ default: pool } = await import('./client.js'));
    await runDemoSeed({ database: pool });
  } catch (error) {
    reportSeedFailure(error);
    process.exitCode = 1;
  } finally {
    if (pool) await pool.end();
  }
}

const invokedPath = process.argv[1] ? pathToFileURL(path.resolve(process.argv[1])).href : null;
if (invokedPath === import.meta.url) main();
