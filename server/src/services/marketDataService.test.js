import test, { beforeEach } from 'node:test';
import assert from 'node:assert';
import { 
    clearQuoteCache,
    getQuote,
    getQuotes,
    mapFinnhubQuote,
    MAX_QUOTE_SYMBOLS,
 } from './marketDataService.js';

 beforeEach(() => {
  clearQuoteCache();
});

test('mapFinnhubQuote maps a Finnhub quote to our market data format', () => {
    const finnhubQuote = {
        c: 311.71,
        d: 0.71,
        dp: 0.2283,
        h: 316.2894,
        l: 309.23,
        o: 313.73,
        pc: 311,
        t: 1786038724,
    };

    const result = mapFinnhubQuote('AAPL', finnhubQuote);

    assert.deepEqual(result, {
        symbol: 'AAPL',
        price: 311.71,
        change: 0.71,
        changePercent: 0.2283,
        dayHigh: 316.2894,
        dayLow: 309.23,
        open: 313.73,
        previousClose: 311,
        asOf: '2026-08-06T17:52:04.000Z',
    });    
});

test('getQuote normalizes the symbol and requests a quote from Finnhub', async (t) => {
    const originalApiKey = process.env.FINNHUB_API_KEY;
    process.env.FINNHUB_API_KEY = 'test-api-key';

    t.after(() => {
        if (originalApiKey === undefined) {
            delete process.env.FINNHUB_API_KEY;
        } else {
            process.env.FINNHUB_API_KEY = originalApiKey;
        }
    });

    const finnhubQuote = {
        c: 311.71,
        d: 0.71,
        dp: 0.2283,
        h: 316.2894,
        l: 309.23,
        o: 313.73,
        pc: 311,
        t: 1786038724,
    };

    t.mock.method(
        globalThis,
        'fetch',
        async () => ({
            ok: true,
            status: 200,
            json: async () => finnhubQuote,
        }),
    );

    const result = await getQuote(' aapl ');

    assert.equal(globalThis.fetch.mock.callCount(), 1);

    const call = globalThis.fetch.mock.calls[0];
    const [url, options] = call.arguments;

    assert.equal(
        url.toString(),
        'https://finnhub.io/api/v1/quote?symbol=AAPL',
    );

    assert.equal(
        options.headers['X-Finnhub-Token'],
        'test-api-key'
    );

    assert.deepEqual(result, {
        symbol: 'AAPL',
        price: 311.71,
        change: 0.71,
        changePercent: 0.2283,
        dayHigh: 316.2894,
        dayLow: 309.23,
        open: 313.73,
        previousClose: 311,
        asOf: '2026-08-06T17:52:04.000Z',
    });
});

test('getQuote rejects an empty stock symbol', async () => {
    await assert.rejects(
        () => getQuote('  '),
        (error) => {
            assert.equal(error.code, 'INVALID_SYMBOL');
            assert.equal(error.statusCode, 400);
            assert.equal(error.message, 'Stock symbol is required.');
            return true;
        },
    );
});

test('getQuote returns a provider error when Finnhub responds with an error', async (t) => {
    const originalApiKey = process.env.FINNHUB_API_KEY;
    process.env.FINNHUB_API_KEY = 'test-api-key';

    t.after(() => {
        if (originalApiKey === undefined) {
            delete process.env.FINNHUB_API_KEY;
        } else {
            process.env.FINNHUB_API_KEY = originalApiKey;
        }
    });

    t.mock.method(
        globalThis,
        'fetch',
        async () => ({
            ok: false,
            status: 500,
            statusText: 'Internal Server Error',
        }),
    );

    await assert.rejects(
        () => getQuote('AAPL'),
        (error) => {
            assert.equal(error.code, 'MARKET_DATA_PROVIDER_ERROR');
            assert.equal(error.statusCode, 502);
            assert.equal(error.message, 'Market data provider returned HTTP 500.');
            return true;
        },
    );
});

test('getQuote returns unavailable when the network request fails', async (t) => {
    const originalApiKey = process.env.FINNHUB_API_KEY;
    process.env.FINNHUB_API_KEY = 'test-api-key';

    t.after(() => {
        if (originalApiKey === undefined) {
            delete process.env.FINNHUB_API_KEY;
        } else {
            process.env.FINNHUB_API_KEY = originalApiKey;
        }
    });

    t.mock.method(
        globalThis,
        'fetch',
        async () => {
            throw new Error('Network failure');
        },
    );

    await assert.rejects(
        () => getQuote('AAPL'),
        (error) => {
            assert.equal(error.code, 'MARKET_DATA_UNAVAILABLE');
            assert.equal(error.message, 'Market data provider is currently unavailable.',);
            return true;
        },
    );
});

test('getQuote reuses a cached quote within the TTL', async (t) => {
  const originalApiKey = process.env.FINNHUB_API_KEY;
  process.env.FINNHUB_API_KEY = 'test-api-key';

  t.after(() => {
    if (originalApiKey === undefined) {
      delete process.env.FINNHUB_API_KEY;
    } else {
      process.env.FINNHUB_API_KEY = originalApiKey;
    }
  });

  const finnhubQuote = {
    c: 420.50,
    d: 2.50,
    dp: 0.5981,
    h: 422,
    l: 415,
    o: 417,
    pc: 418,
    t: 1786038724,
  };

  t.mock.method(
    globalThis,
    'fetch',
    async () => ({
      ok: true,
      status: 200,
      json: async () => finnhubQuote,
    }),
  );

  const first = await getQuote('MSFT');
  const second = await getQuote('MSFT');

  assert.equal(globalThis.fetch.mock.callCount(), 1);
  assert.deepEqual(second, first);
});

test('getQuotes normalizes, deduplicates, and preserves first-occurrence order', async (t) => {
  const originalApiKey = process.env.FINNHUB_API_KEY;
  process.env.FINNHUB_API_KEY = 'test-api-key';

  t.after(() => {
    if (originalApiKey === undefined) {
      delete process.env.FINNHUB_API_KEY;
    } else {
      process.env.FINNHUB_API_KEY = originalApiKey;
    }
  });

  const prices = { AAPL: 310, MSFT: 420, NVDA: 180 };

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
        l: 175,
        o: 300,
        pc: 299,
        t: 1786038724,
      }),
    }),
  );

  const quotes = await getQuotes(['aapl', 'MSFT', ' AAPL ', 'nvda']);

  assert.deepEqual(quotes.map((quote) => quote.symbol), ['AAPL', 'MSFT', 'NVDA']);
  assert.deepEqual(quotes.map((quote) => quote.price), [310, 420, 180]);
  assert.equal(globalThis.fetch.mock.callCount(), 3);
  assert.deepEqual(
    globalThis.fetch.mock.calls.map((call) => call.arguments[0].searchParams.get('symbol')),
    ['AAPL', 'MSFT', 'NVDA'],
  );
});

test('getQuotes starts independent uncached quote requests concurrently', async (t) => {
  const originalApiKey = process.env.FINNHUB_API_KEY;
  process.env.FINNHUB_API_KEY = 'test-api-key';

  t.after(() => {
    if (originalApiKey === undefined) {
      delete process.env.FINNHUB_API_KEY;
    } else {
      process.env.FINNHUB_API_KEY = originalApiKey;
    }
  });

  let firstRequestPending = true;
  let secondStartedWhileFirstPending = false;

  t.mock.method(
    globalThis,
    'fetch',
    async (url) => {
      if (url.searchParams.get('symbol') === 'AAPL') {
        await new Promise((resolve) => setTimeout(resolve, 20));
        firstRequestPending = false;
      } else if (firstRequestPending) {
        secondStartedWhileFirstPending = true;
      }

      return {
        ok: true,
        status: 200,
        json: async () => ({
          c: 310,
          d: 1,
          dp: 0.5,
          h: 315,
          l: 305,
          o: 309,
          pc: 309,
          t: 1786038724,
        }),
      };
    },
  );

  await getQuotes(['AAPL', 'MSFT']);

  assert.equal(secondStartedWhileFirstPending, true);
});

test('getQuotes reuses cached quotes and only fetches uncached symbols', async (t) => {
  const originalApiKey = process.env.FINNHUB_API_KEY;
  process.env.FINNHUB_API_KEY = 'test-api-key';

  t.after(() => {
    if (originalApiKey === undefined) {
      delete process.env.FINNHUB_API_KEY;
    } else {
      process.env.FINNHUB_API_KEY = originalApiKey;
    }
  });

  t.mock.method(
    globalThis,
    'fetch',
    async (url) => ({
      ok: true,
      status: 200,
      json: async () => ({
        c: url.searchParams.get('symbol') === 'AAPL' ? 310 : 420,
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

  const cached = await getQuote('AAPL');
  const quotes = await getQuotes([' aapl ', 'MSFT']);

  assert.equal(globalThis.fetch.mock.callCount(), 2);
  assert.deepEqual(
    globalThis.fetch.mock.calls.map((call) => call.arguments[0].searchParams.get('symbol')),
    ['AAPL', 'MSFT'],
  );
  assert.deepEqual(quotes[0], cached);
  assert.equal(quotes[1].symbol, 'MSFT');
});

test('getQuotes rejects an empty or non-array symbol collection', async () => {
  for (const symbols of [[], 'AAPL']) {
    await assert.rejects(
      () => getQuotes(symbols),
      (error) => {
        assert.equal(error.code, 'INVALID_SYMBOLS');
        assert.equal(error.statusCode, 400);
        return true;
      },
    );
  }
});

test('getQuotes rejects an invalid symbol before fetching any quotes', async (t) => {
  t.mock.method(globalThis, 'fetch', async () => {
    throw new Error('fetch should not be called');
  });

  await assert.rejects(
    () => getQuotes(['AAPL', 'not a symbol']),
    (error) => {
      assert.equal(error.code, 'INVALID_SYMBOL');
      assert.equal(error.statusCode, 400);
      return true;
    },
  );

  assert.equal(globalThis.fetch.mock.callCount(), 0);
});

test('getQuotes rejects requests above the maximum symbol limit', async () => {
  const symbols = Array.from(
    { length: MAX_QUOTE_SYMBOLS + 1 },
    (_, index) => `SYM${index}`,
  );

  await assert.rejects(
    () => getQuotes(symbols),
    (error) => {
      assert.equal(error.code, 'TOO_MANY_SYMBOLS');
      assert.equal(error.statusCode, 400);
      assert.match(error.message, new RegExp(String(MAX_QUOTE_SYMBOLS)));
      return true;
    },
  );
});
