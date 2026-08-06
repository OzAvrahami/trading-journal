import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { describe, test } from 'node:test';
import {
  BACKUP_SELECTS,
  REQUIRED_CONFIRMATION,
  RESET_STEPS,
  createSerializedQueryExecutor,
  formatGoalDiagnostics,
  maskDatabaseHost,
  readDemoSeedConfig,
  reportSeedFailure,
  runDemoSeed,
  validateComputedDemoGoals,
} from './seedDemo.js';

const user = {
  id: '11111111-1111-4111-8111-111111111111',
  email: 'demo.user@example.com',
  timezone: 'Asia/Jerusalem',
};
const env = {
  NODE_ENV: 'development',
  DEMO_USER_EMAIL: user.email,
  DEMO_RESET_CONFIRM: REQUIRED_CONFIRMATION,
  DEMO_ANCHOR_DATE: '2026-08-04',
  DATABASE_URL: 'postgres://secret-user:secret-password@db.example.internal:5432/demo',
};

function makeHarness({ users = [user], failClient, validator } = {}) {
  const events = [];
  const client = {
    async query(sql, params = []) {
      const normalized = sql.replace(/\s+/g, ' ').trim();
      events.push({ kind: 'client', sql: normalized, params });
      if (failClient?.(normalized)) throw new Error('injected client failure');
      if (normalized.startsWith('DELETE FROM')) return { rows: [], rowCount: 0 };
      return { rows: [], rowCount: 1 };
    },
    release() { events.push({ kind: 'release' }); },
  };
  const database = {
    async query(sql, params = []) {
      const normalized = sql.replace(/\s+/g, ' ').trim();
      events.push({ kind: 'pool', sql: normalized, params });
      if (normalized.startsWith('SELECT id, email, timezone FROM users')) return { rows: users };
      if (normalized.startsWith('SELECT COUNT(*)')) return { rows: [{ count: 0 }] };
      if (normalized.startsWith('SELECT * FROM')) return { rows: [] };
      throw new Error(`Unexpected pool query: ${normalized}`);
    },
    async connect() {
      events.push({ kind: 'connect' });
      return client;
    },
  };
  let capturedBackup;
  const backupWriter = async (input) => {
    events.push({ kind: 'backup' });
    capturedBackup = input.backup;
    return 'D:\\tmp\\demo-backup.json';
  };
  const persistedValidator = validator ?? (async () => {
    events.push({ kind: 'validate' });
    return { ok: true };
  });
  const messages = [];
  const logger = {
    warn(message) { messages.push(String(message)); },
    info(message) { messages.push(String(message)); },
  };
  return { database, client, events, backupWriter, persistedValidator, logger, messages, getBackup: () => capturedBackup };
}

async function execute(harness, overrides = {}) {
  return runDemoSeed({
    env,
    database: harness.database,
    now: new Date('2026-08-04T10:00:00.000Z'),
    backupWriter: harness.backupWriter,
    persistedValidator: harness.persistedValidator,
    logger: harness.logger,
    ...overrides,
  });
}

function computedGoalsWithoutInProgress() {
  const states = ['achieved', 'achieved', 'paused', 'archived', 'upcoming', 'missed', 'achieved'];
  return states.map((derivedState, index) => ({
    name: `Goal ${index + 1}`,
    metricKey: index === 4 ? 'rule_adherence' : 'closed_trades',
    currentValue: index === 4 ? null : index,
    targetValue: 10,
    status: derivedState === 'paused' ? 'paused' : derivedState === 'archived' ? 'archived' : 'active',
    startDate: index === 4 ? '2026-08-11' : '2026-07-01',
    endDate: index === 5 ? '2026-07-15' : '2026-09-01',
    derivedState,
    hasData: index !== 4,
    unavailableReason: index === 4 ? 'no_eligible_rule_checks' : null,
  }));
}

describe('serialized transaction query adapter', () => {
  test('executes concurrently requested operations one at a time in call order', async () => {
    let active = 0;
    let maximumActive = 0;
    const events = [];
    const client = {
      async query(label) {
        active += 1;
        maximumActive = Math.max(maximumActive, active);
        events.push(`start:${label}`);
        await new Promise((resolve) => setTimeout(resolve, 5));
        events.push(`end:${label}`);
        active -= 1;
        return label;
      },
    };
    const serialized = createSerializedQueryExecutor(client);
    const results = await Promise.all([
      serialized.query('trade metrics'),
      serialized.query('rule metrics'),
      serialized.query('journal metrics'),
    ]);
    assert.deepEqual(results, ['trade metrics', 'rule metrics', 'journal metrics']);
    assert.equal(maximumActive, 1);
    assert.deepEqual(events, [
      'start:trade metrics', 'end:trade metrics',
      'start:rule metrics', 'end:rule metrics',
      'start:journal metrics', 'end:journal metrics',
    ]);
  });

  test('continues the queue after a rejected operation without hiding that rejection', async () => {
    let calls = 0;
    const serialized = createSerializedQueryExecutor({
      async query(label) {
        calls += 1;
        if (calls === 1) throw new Error('first source failed');
        return label;
      },
    });
    const first = serialized.query('first');
    const second = serialized.query('second');
    await assert.rejects(first, /first source failed/);
    assert.equal(await second, 'second');
    assert.equal(calls, 2);
  });
});

describe('demo seed safety configuration', () => {
  test('defaults to English and accepts explicit English or Hebrew locale', () => {
    assert.equal(readDemoSeedConfig(env).locale, 'en');
    assert.equal(readDemoSeedConfig({ ...env, DEMO_LOCALE: 'en' }).locale, 'en');
    assert.equal(readDemoSeedConfig({ ...env, DEMO_LOCALE: 'he' }).locale, 'he');
  });

  test('rejects an unsupported or blank demo locale before database, backup, or transaction work', async () => {
    for (const locale of ['fr', '']) {
      const harness = makeHarness();
      await assert.rejects(execute(harness, { env: { ...env, DEMO_LOCALE: locale } }), /DEMO_LOCALE/);
      assert.equal(harness.events.length, 0);
    }
  });

  test('rejects production before any database access', async () => {
    const harness = makeHarness();
    await assert.rejects(execute(harness, { env: { ...env, NODE_ENV: 'production' } }), /forbidden/);
    assert.equal(harness.events.length, 0);
  });

  test('rejects a missing target email', () => {
    assert.throws(() => readDemoSeedConfig({ ...env, DEMO_USER_EMAIL: '' }), /DEMO_USER_EMAIL/);
  });

  test('rejects a missing confirmation', () => {
    assert.throws(() => readDemoSeedConfig({ ...env, DEMO_RESET_CONFIRM: undefined }), /must exactly equal/);
  });

  test('rejects an incorrect confirmation', () => {
    assert.throws(() => readDemoSeedConfig({ ...env, DEMO_RESET_CONFIRM: 'yes' }), /must exactly equal/);
  });

  test('rejects an invalid optional anchor date', () => {
    assert.throws(() => readDemoSeedConfig({ ...env, DEMO_ANCHOR_DATE: '2026-02-30' }), /real YYYY-MM-DD/);
  });

  test('rejects a missing user before backup, connect or delete', async () => {
    const harness = makeHarness({ users: [] });
    await assert.rejects(execute(harness), /exactly one user; found 0/);
    assert.equal(harness.events.some((event) => event.kind === 'connect' || event.kind === 'backup'), false);
  });

  test('rejects an unexpected multiple-user result safely', async () => {
    const harness = makeHarness({ users: [user, { ...user, id: '22222222-2222-4222-8222-222222222222' }] });
    await assert.rejects(execute(harness), /exactly one user; found 2/);
    assert.equal(harness.events.some((event) => event.kind === 'connect'), false);
  });

  test('rejects an invalid target timezone', async () => {
    const harness = makeHarness({ users: [{ ...user, timezone: 'Local time' }] });
    await assert.rejects(execute(harness), /invalid IANA timezone/);
    assert.equal(harness.events.some((event) => event.kind === 'backup'), false);
  });

  test('masks the database host without exposing credentials', () => {
    const masked = maskDatabaseHost(env.DATABASE_URL);
    assert.match(masked, /\*/);
    assert.doesNotMatch(masked, /secret|postgres|5432/);
  });
});

describe('demo backup, ownership and transaction ordering', () => {
  test('creates the backup before connect, BEGIN or any delete', async () => {
    const harness = makeHarness();
    await execute(harness);
    const backupIndex = harness.events.findIndex((event) => event.kind === 'backup');
    const beginIndex = harness.events.findIndex((event) => event.sql === 'BEGIN');
    const deleteIndex = harness.events.findIndex((event) => event.sql?.startsWith('DELETE FROM'));
    assert.ok(backupIndex >= 0 && backupIndex < beginIndex && beginIndex < deleteIndex);
  });

  test('backup includes domain rows but excludes authentication secrets', async () => {
    const harness = makeHarness();
    await execute(harness);
    const backup = harness.getBackup();
    assert.deepEqual(Object.keys(backup).sort(), ['dailyReviewDetails', 'goals', 'importRunRows', 'importRuns', 'investmentInstruments', 'investmentPortfolios', 'investmentPrices', 'investmentTransactions', 'journalEntries', 'journalEntryTrades', 'metadata', 'ruleChecks', 'setups', 'strategies', 'trades', 'tradingAccounts', 'tradingRules'].sort());
    const serialized = JSON.stringify(backup);
    assert.doesNotMatch(serialized, /password_hash|token_hash|JWT|DATABASE_URL/);
  });

  test('records the selected demo locale in backup metadata and the destructive warning', async () => {
    const harness = makeHarness();
    await execute(harness, { env: { ...env, DEMO_LOCALE: 'he' } });
    assert.equal(harness.getBackup().metadata.demoLocale, 'he');
    assert.ok(harness.messages.some((message) => message.includes('Demo locale: he')));
  });

  test('selects, counts, backs up and deletes only with the target user ID', async () => {
    const harness = makeHarness();
    await execute(harness);
    const ownedQueries = harness.events.filter((event) => /FROM (?:investment_prices|investment_transactions|investment_instruments|investment_portfolios|goals|rule_checks|trading_rules|journal_entry_trades|journal_entries|trades|trading_accounts)/.test(event.sql ?? ''));
    assert.ok(ownedQueries.length > 0);
    assert.ok(ownedQueries.every((event) => /user_id = \$1/.test(event.sql) && event.params[0] === user.id));
  });

  test('uses the required foreign-key-safe reset order', () => {
    assert.deepEqual(RESET_STEPS.map((step) => step.table), [
      'investment_prices', 'investment_transactions', 'investment_instruments', 'investment_portfolios',
      'import_run_rows', 'import_runs',
      'goals', 'rule_checks', 'trading_rules', 'journal_entry_trades',
      'daily_review_details', 'journal_entries', 'trades', 'setups', 'strategies', 'trading_accounts',
    ]);
    assert.ok(RESET_STEPS.every((step) => /WHERE user_id = \$1$/.test(step.sql)));
  });

  test('commits only after inserts and persisted validation succeed', async () => {
    const harness = makeHarness();
    const result = await execute(harness);
    const validateIndex = harness.events.findIndex((event) => event.kind === 'validate');
    const commitIndex = harness.events.findIndex((event) => event.sql === 'COMMIT');
    assert.ok(validateIndex > 0 && commitIndex > validateIndex);
    assert.equal(result.summary.trades, 57);
    assert.equal(harness.events.some((event) => event.sql === 'ROLLBACK'), false);
  });

  test('rolls back after a delete failure', async () => {
    const harness = makeHarness({ failClient: (sql) => sql.startsWith('DELETE FROM rule_checks') });
    await assert.rejects(execute(harness), /injected client failure/);
    assert.ok(harness.events.some((event) => event.sql === 'ROLLBACK'));
    assert.equal(harness.events.some((event) => event.sql === 'COMMIT'), false);
  });

  test('rolls back after an insert failure', async () => {
    const harness = makeHarness({ failClient: (sql) => sql.startsWith('INSERT INTO trades') });
    await assert.rejects(execute(harness), /injected client failure/);
    assert.ok(harness.events.some((event) => event.sql === 'ROLLBACK'));
    assert.equal(harness.events.some((event) => event.kind === 'validate'), false);
  });

  test('rolls back after post-seed validation failure', async () => {
    const harness = makeHarness({ validator: async () => { harness.events.push({ kind: 'validate' }); throw new Error('validation failed'); } });
    await assert.rejects(execute(harness), /validation failed/);
    assert.ok(harness.events.some((event) => event.sql === 'ROLLBACK'));
    assert.equal(harness.events.some((event) => event.sql === 'COMMIT'), false);
  });

  test('a missing required Goal state rolls back without printing a committed summary', async () => {
    let harness;
    harness = makeHarness({
      validator: async () => {
        harness.events.push({ kind: 'validate' });
        validateComputedDemoGoals(computedGoalsWithoutInProgress());
      },
    });
    await assert.rejects(execute(harness), /missing the in_progress derived state/);
    const backupIndex = harness.events.findIndex((event) => event.kind === 'backup');
    const beginIndex = harness.events.findIndex((event) => event.sql === 'BEGIN');
    const firstDeleteIndex = harness.events.findIndex((event) => event.sql?.startsWith('DELETE FROM'));
    const rollbackIndex = harness.events.findIndex((event) => event.sql === 'ROLLBACK');
    assert.ok(backupIndex < beginIndex && beginIndex < firstDeleteIndex && firstDeleteIndex < rollbackIndex);
    assert.equal(harness.events.some((event) => event.sql === 'COMMIT'), false);
    assert.equal(harness.messages.some((message) => message.includes('committed for')), false);
  });

  test('hard-fails when BEGIN cannot start without attempting a data statement', async () => {
    const harness = makeHarness({ failClient: (sql) => sql === 'BEGIN' });
    await assert.rejects(execute(harness), /injected client failure/);
    assert.equal(harness.events.some((event) => event.sql?.startsWith('DELETE FROM')), false);
    assert.equal(harness.events.some((event) => event.sql === 'COMMIT'), false);
  });

  test('uses the user-local current date when no anchor is supplied', async () => {
    const harness = makeHarness();
    let dataset;
    await execute(harness, {
      env: { ...env, DEMO_ANCHOR_DATE: '' },
      now: new Date('2026-08-01T21:30:00.000Z'),
      persistedValidator: async (_client, value) => { dataset = value; return { ok: true }; },
    });
    assert.equal(dataset.anchorDate, '2026-08-02');
  });
});

describe('Goal diagnostics and CLI error reporting', () => {
  test('a missing state reports every safe Goal field for each fixture', () => {
    const goals = computedGoalsWithoutInProgress();
    assert.deepEqual(Object.keys(formatGoalDiagnostics(goals)[0]), [
      'name', 'metricKey', 'currentValue', 'targetValue', 'storedStatus',
      'startDate', 'endDate', 'derivedState', 'unavailableReason',
    ]);
    assert.throws(() => validateComputedDemoGoals(goals), (error) => {
      assert.match(error.message, /missing the in_progress derived state/);
      for (const goal of goals) assert.match(error.message, new RegExp(goal.name));
      for (const field of ['metricKey', 'currentValue', 'targetValue', 'storedStatus', 'startDate', 'endDate', 'derivedState', 'unavailableReason']) {
        assert.match(error.message, new RegExp(field));
      }
      assert.doesNotMatch(error.message, /DATABASE_URL|secret-password|secret-user/);
      return true;
    });
  });

  test('reports a thrown non-Error value safely', () => {
    const output = [];
    reportSeedFailure({ code: 'FIXTURE_FAILURE' }, { error: (value) => output.push(String(value)) });
    assert.deepEqual(output, ['Demo seed failed.', '{"code":"FIXTURE_FAILURE"}']);
  });

  test('reports an Error with an empty message and preserves rollback diagnostics', () => {
    const output = [];
    const failure = new Error('');
    failure.stack = '';
    failure.rollbackError = new Error('rollback unavailable');
    reportSeedFailure(failure, { error: (value) => output.push(String(value)) });
    assert.deepEqual(output.slice(0, 3), ['Demo seed failed.', 'Error', 'Rollback also failed:']);
    assert.match(output[3], /rollback unavailable/);
  });
});

describe('static destructive-safety contract', () => {
  const source = readFileSync(new URL('./seedDemo.js', import.meta.url), 'utf8');

  test('never targets preserved users, refresh tokens or migrations', () => {
    assert.doesNotMatch(source, /DELETE FROM\s+(?:users|refresh_tokens|schema_migrations)\b/i);
    assert.ok(BACKUP_SELECTS.every((item) => /WHERE user_id = \$1/.test(item.sql)));
  });

  test('contains no schema wipe, truncate or unsupported portfolio insert', () => {
    assert.doesNotMatch(source, /DROP\s+(?:DATABASE|SCHEMA)|\bTRUNCATE\b/i);
    assert.doesNotMatch(source, /INSERT INTO\s+(?:positions|executions|portfolio_transactions|holdings|lots|dividends|allocation|price_cache|fx_rates|notifications|import_history|saved_views)/i);
  });

  test('does not auto-run merely because it is imported', () => {
    assert.match(source, /if \(invokedPath === import\.meta\.url\) main\(\)/);
    assert.doesNotMatch(source, /Math\.random/);
  });

  test('warnings expose no credentials and confirm preserved tables', async () => {
    const harness = makeHarness();
    await execute(harness);
    const output = harness.messages.join('\n');
    assert.match(output, /users, refresh_tokens, schema_migrations/);
    assert.match(output, /Target user ID/);
    assert.doesNotMatch(output, /secret-user|secret-password|postgres:\/\//);
  });
});
