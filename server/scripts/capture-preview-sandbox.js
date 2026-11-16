// Local-only preview harness: actual import router/auth/parser/UI, synthetic user/accounts,
// no .env loading, no database connection, and all query operations allowlisted in memory.
import express from 'express';
import jwt from 'jsonwebtoken';
import { randomBytes } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { existsSync } from 'node:fs';
import pool from '../src/db/client.js';
import router from '../src/routes/importRoutes.js';
import { errorHandler } from '../src/middleware/errorHandler.js';
import { requireAuth } from '../src/middleware/auth.js';

const owner = '11111111-1111-4111-8111-111111111111';
const target = '22222222-2222-4222-8222-222222222222';
const user = { id: owner, email: 'preview@example.invalid', displayName: 'Local preview (no database)', timezone: 'Asia/Jerusalem' };
const accounts = [{ id: target, company: 'Local preview only', accountNumber: 'SYNTHETIC', status: 'active', baseCurrency: 'USD' }];
const preferences = { locale: 'en', theme: 'light', tradeFormMode: 'simple', timezone: 'Asia/Jerusalem' };
process.env.JWT_SECRET = randomBytes(32).toString('hex');
pool.connect = () => { throw new Error('Database connections are disabled in the preview sandbox.'); };
pool.query = async (sql, values) => {
  if (sql === 'SELECT id, email FROM users WHERE id = $1') return { rows: values[0] === owner ? [user] : [] };
  if (sql === "SELECT id FROM trading_accounts WHERE id = $1 AND user_id = $2 AND status = 'active'") return { rows: values[0] === target && values[1] === owner ? [{ id: target }] : [] };
  if (sql.startsWith('SELECT id, status, base_currency')) return { rows: values[0] === target && values[1] === owner ? [{ id: target, status: 'active', base_currency: 'USD' }] : [] };
  if (sql.includes('FROM capture_accounts') || sql.includes('FROM trades t LEFT JOIN')) return { rows: [] };
  throw new Error('Database operations are disabled in the preview sandbox.');
};
const app = express(); app.use(express.json());
app.use((_req, res, next) => { res.set('Cache-Control', 'no-store'); next(); });
app.post('/api/auth/refresh', (_req, res) => res.json({ accessToken: jwt.sign({ sub: owner }, process.env.JWT_SECRET, { expiresIn: '30m' }) }));
app.get('/api/me', requireAuth, (_req, res) => res.json(user));
app.get('/api/accounts', requireAuth, (_req, res) => res.json(accounts));
app.get('/api/preferences', requireAuth, (_req, res) => res.json(preferences));
app.patch('/api/preferences', requireAuth, (req, res) => {
  if (['en','he'].includes(req.body.locale)) preferences.locale = req.body.locale;
  if (['light','dark'].includes(req.body.theme)) preferences.theme = req.body.theme;
  res.json(preferences);
});
app.get('/api/imports/runs', requireAuth, (_req, res) => res.json({ runs: [] }));
app.post('/api/imports/parse', (_req,res,next) => { const json=res.json.bind(res); res.json=body=>json({...body,previewOnly:true}); next(); });
app.post('/api/imports/commit', requireAuth, (_req,res) => res.status(409).json({error:{code:'CAPTURE_PREVIEW_ONLY',message:'This database-free sandbox cannot persist trades.'}}));
// Legacy CSV commits also cannot reach any persistent store in this harness.
app.use('/api/imports', router);
app.use('/api', (_req, res) => res.status(404).json({ error: { code: 'SANDBOX_ROUTE_DISABLED', message: 'Only capture preview is available in this local sandbox.' } }));
const dist = fileURLToPath(new URL('../../client/dist/', import.meta.url));
if (!existsSync(dist + '/index.html')) throw new Error('Build the client first: npm run build:client');
app.use(express.static(dist));
app.get('*', (_req, res) => res.sendFile(dist + '/index.html'));
app.use(errorHandler);
const server = app.listen(4178, '127.0.0.1', () => console.log('Local capture preview: http://127.0.0.1:4178/import (synthetic internal account; no database).'));
for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => server.close(() => process.exit(0)));
