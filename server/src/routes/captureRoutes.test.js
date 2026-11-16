import test from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import jwt from 'jsonwebtoken';
import { randomBytes } from 'node:crypto';
import router, { clearParseSessions } from './importRoutes.js';
import pool from '../db/client.js';
import { errorHandler } from '../middleware/errorHandler.js';
import { fixture } from '../../test/helpers/captureFixture.js';

test('actual import API retains authentication/ownership and rejects changing the preview target', async () => {
  const owner = '11111111-1111-4111-8111-111111111111';
  const target = '22222222-2222-4222-8222-222222222222';
  const other = '33333333-3333-4333-8333-333333333333';
  const originalQuery = pool.query; const originalSecret = process.env.JWT_SECRET;
  let queries = 0;
  pool.query = async (sql, values) => {
    queries++;
    if (sql === 'SELECT id, email FROM users WHERE id = $1') return { rows: [{ id: values[0], email: 'synthetic@example.invalid' }] };
    if (sql === "SELECT id FROM trading_accounts WHERE id = $1 AND user_id = $2 AND status = 'active'") {
      return { rows: values[0] === target && values[1] === owner ? [{ id: target }] : [] };
    }
    if (sql.startsWith('SELECT id, status, base_currency')) return { rows: [{ id: target, status: 'active', base_currency: 'USD' }] };
    if (sql.includes('FROM capture_accounts') || sql.includes('FROM trades t LEFT JOIN')) return { rows: [] };
    assert.fail('Unexpected DB operation: ' + sql);
  };
  process.env.JWT_SECRET = randomBytes(32).toString('hex');
  const app = express(); app.use(express.json()); app.use('/api/imports', router); app.use(errorHandler);
  const server = await new Promise(resolve => { const s = app.listen(0, '127.0.0.1', () => resolve(s)); });
  const url = `http://127.0.0.1:${server.address().port}/api/imports`;
  const token = sub => jwt.sign({ sub }, process.env.JWT_SECRET, { expiresIn: '1m' });
  const submit = async (accountId, sub = owner, pkg = fixture()) => {
    const form = new FormData(); form.set('broker', 'tradovate'); form.set('format', 'capture');
    if (accountId) form.set('accountId', accountId);
    form.set('file', new Blob([JSON.stringify(pkg)], { type: 'application/json' }), 'synthetic.capture.json');
    return fetch(`${url}/parse`, { method: 'POST', body: form, headers: sub ? { Authorization: `Bearer ${token(sub)}` } : {} });
  };
  try {
    assert.equal((await submit(target, null)).status, 401); assert.equal(queries, 0);
    assert.equal((await submit()).status, 400);
    assert.equal((await submit('100')).status, 400); // External ID cannot become an internal target.
    assert.equal((await submit(other)).status, 404);
    assert.equal((await submit(target, other)).status, 404);
    const malformed = fixture(); delete malformed.performance.metadata.verifiedOffsetMinutes;
    assert.equal((await submit(target, owner, malformed)).status, 400);
    const response = await submit(target); assert.equal(response.status, 200);
    const data = await response.json(); assert.equal(data.previewOnly, false); assert.equal(data.targetAccountId, target); assert.equal(data.plan.inserted,1);
    assert.equal(data.preview[0].fees, null); assert.equal(data.preview[0].pnl_net, null);
    for (const [sub, status] of [[other, 410], [owner, 409]]) {
      const commit = await fetch(`${url}/commit`, { method: 'POST', headers: { Authorization: `Bearer ${token(sub)}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId: data.sessionId, accountId: other }) });
      assert.equal(commit.status, status);
      if (sub === owner) assert.equal((await commit.json()).error.code, 'CAPTURE_TARGET_CHANGED');
    }
  } finally {
    await new Promise(resolve => server.close(resolve)); pool.query = originalQuery; clearParseSessions();
    if (originalSecret === undefined) delete process.env.JWT_SECRET; else process.env.JWT_SECRET = originalSecret;
  }
});
