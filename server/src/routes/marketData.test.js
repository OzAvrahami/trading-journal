import assert from 'node:assert/strict';
import http from 'node:http';
import { after, before, beforeEach, test } from 'node:test';
import express from 'express';
import jwt from 'jsonwebtoken';
import { errorHandler } from '../middleware/errorHandler.js';
import marketDataRoutes from './marketData.js';
import {
  clearQuoteCache,
  MAX_QUOTE_SYMBOLS,
} from '../services/marketDataService.js';

const app = express();
app.use('/api/market-data', marketDataRoutes);
app.use(errorHandler);

let server;
let originalApiKey;
let originalJwtSecret;

before(async () => {
  originalApiKey = process.env.FINNHUB_API_KEY;
  originalJwtSecret = process.env.JWT_SECRET;
  process.env.FINNHUB_API_KEY = 'test-api-key';
  process.env.JWT_SECRET = 'market-data-route-test-secret';

  await new Promise((resolve) => {
    server = app.listen(0, '127.0.0.1', resolve);
  });
});

after(async () => {
  await new Promise((resolve, reject) => {
    server.close((error) => error ? reject(error) : resolve());
  });

  if (originalApiKey === undefined) {
    delete process.env.FINNHUB_API_KEY;
  } else {
    process.env.FINNHUB_API_KEY = originalApiKey;
  }

  if (originalJwtSecret === undefined) {
    delete process.env.JWT_SECRET;
  } else {
    process.env.JWT_SECRET = originalJwtSecret;
  }
});

beforeEach(() => {
  clearQuoteCache();
});

function accessToken() {
  return jwt.sign(
    { sub: 'market-data-test-user', email: 'trader@example.com' },
    process.env.JWT_SECRET,
    { expiresIn: '5m' },
  );
}

function requestJson(path, token) {
  const { port } = server.address();

  return new Promise((resolve, reject) => {
    const request = http.request({
      host: '127.0.0.1',
      port,
      path,
      method: 'GET',
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    }, (response) => {
      const chunks = [];
      response.on('data', (chunk) => chunks.push(chunk));
      response.on('end', () => {
        const body = Buffer.concat(chunks).toString('utf8');
        resolve({
          statusCode: response.statusCode,
          body: body ? JSON.parse(body) : null,
        });
      });
    });

    request.on('error', reject);
    request.end();
  });
}

test('GET /quotes requires authentication', async () => {
  const response = await requestJson('/api/market-data/quotes?symbols=AAPL');

  assert.equal(response.statusCode, 401);
  assert.equal(response.body.error.code, 'UNAUTHORIZED');
});

test('GET /quotes rejects a missing or empty symbols query parameter', async () => {
  for (const path of [
    '/api/market-data/quotes',
    '/api/market-data/quotes?symbols=',
  ]) {
    const response = await requestJson(path, accessToken());

    assert.equal(response.statusCode, 400);
    assert.equal(response.body.error.code, 'VALIDATION_ERROR');
  }
});

test('GET /quotes rejects a malformed symbol', async () => {
  const response = await requestJson(
    '/api/market-data/quotes?symbols=AAPL,BAD%20SYMBOL',
    accessToken(),
  );

  assert.equal(response.statusCode, 400);
  assert.equal(response.body.error.code, 'VALIDATION_ERROR');
});

test('GET /quotes rejects more than the maximum number of symbols', async () => {
  const symbols = Array.from(
    { length: MAX_QUOTE_SYMBOLS + 1 },
    (_, index) => `SYM${index}`,
  ).join(',');
  const response = await requestJson(
    `/api/market-data/quotes?symbols=${symbols}`,
    accessToken(),
  );

  assert.equal(response.statusCode, 400);
  assert.equal(response.body.error.code, 'VALIDATION_ERROR');
});

test('GET /quotes parses, dispatches, and wraps normalized quotes', async (t) => {
  const prices = { AAPL: 310, MSFT: 420 };

  t.mock.method(
    globalThis,
    'fetch',
    async (url) => ({
      ok: true,
      status: 200,
      json: async () => ({
        c: prices[url.searchParams.get('symbol')],
        d: 1,
        dp: 0.5,
        h: 425,
        l: 300,
        o: 305,
        pc: 309,
        t: 1786038724,
      }),
    }),
  );

  const response = await requestJson(
    '/api/market-data/quotes?symbols=%20aapl%20,MSFT,AAPL',
    accessToken(),
  );

  assert.equal(response.statusCode, 200);
  assert.deepEqual(response.body.quotes.map((quote) => quote.symbol), ['AAPL', 'MSFT']);
  assert.deepEqual(response.body.quotes.map((quote) => quote.price), [310, 420]);
  assert.equal(globalThis.fetch.mock.callCount(), 2);
  assert.deepEqual(
    globalThis.fetch.mock.calls.map((call) => call.arguments[0].searchParams.get('symbol')),
    ['AAPL', 'MSFT'],
  );
  assert.ok(
    globalThis.fetch.mock.calls.every(
      (call) => call.arguments[1].headers['X-Finnhub-Token'] === 'test-api-key',
    ),
  );
});
