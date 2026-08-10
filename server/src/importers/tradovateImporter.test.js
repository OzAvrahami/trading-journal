import assert from 'node:assert/strict';
import test from 'node:test';
import { parseImport, commitImport } from '../services/importService.js';
import { toISO } from '../utils/importUtils.js';
import { parseTradovate } from './tradovateImporter.js';

const HEADER = [
  'symbol', 'buyFillId', 'sellFillId', 'qty', 'buyPrice', 'sellPrice',
  'pnl', 'boughtTimestamp', 'soldTimestamp', 'duration',
].join(',');

function csv(rows) {
  return Buffer.from([
    HEADER,
    ...rows.map((row) => [
      row.symbol ?? 'MNQU6', row.buyFillId ?? '', row.sellFillId ?? '', row.qty,
      row.buyPrice, row.sellPrice, row.pnl, row.boughtTimestamp, row.soldTimestamp,
      row.duration ?? '1min 0sec',
    ].join(',')),
  ].join('\n'));
}

function shortRow({
  buyFillId, sellFillId, qty, buyPrice, sellPrice, pnl,
  boughtTimestamp, soldTimestamp,
}) {
  return {
    buyFillId,
    sellFillId,
    qty,
    buyPrice,
    sellPrice,
    pnl,
    boughtTimestamp,
    soldTimestamp,
    duration: '1min 0sec',
  };
}

const sixPartialClosingFills = [
  shortRow({ buyFillId: '615304740017', sellFillId: '615304740007', qty: 2, buyPrice: 29943.75, sellPrice: 29939.50, pnl: -17, boughtTimestamp: '08/10/2026 09:08:22', soldTimestamp: '08/10/2026 09:04:23' }),
  shortRow({ buyFillId: '615304740028', sellFillId: '615304740007', qty: 1, buyPrice: 29944.00, sellPrice: 29939.50, pnl: -9, boughtTimestamp: '08/10/2026 09:08:22', soldTimestamp: '08/10/2026 09:04:23' }),
  shortRow({ buyFillId: '615304740039', sellFillId: '615304740007', qty: 2, buyPrice: 29944.00, sellPrice: 29939.50, pnl: -18, boughtTimestamp: '08/10/2026 09:08:23', soldTimestamp: '08/10/2026 09:04:23' }),
  shortRow({ buyFillId: '615304740050', sellFillId: '615304740007', qty: 2, buyPrice: 29944.00, sellPrice: 29939.50, pnl: -18, boughtTimestamp: '08/10/2026 09:08:23', soldTimestamp: '08/10/2026 09:04:23' }),
  shortRow({ buyFillId: '615304740061', sellFillId: '615304740007', qty: 1, buyPrice: 29944.00, sellPrice: 29939.50, pnl: -9, boughtTimestamp: '08/10/2026 09:08:23', soldTimestamp: '08/10/2026 09:04:23' }),
  shortRow({ buyFillId: '615304740072', sellFillId: '615304740007', qty: 22, buyPrice: 29943.75, sellPrice: 29939.50, pnl: -187, boughtTimestamp: '08/10/2026 09:08:25', soldTimestamp: '08/10/2026 09:04:23' }),
];

const sampleTwoShapedRows = [
  ...sixPartialClosingFills,
  shortRow({ buyFillId: 'b-083', sellFillId: 's-083', qty: 30, buyPrice: 29947.25, sellPrice: 29943.75, pnl: -210, boughtTimestamp: '08/10/2026 09:10:30', soldTimestamp: '08/10/2026 09:08:43' }),
  shortRow({ buyFillId: 'b-103', sellFillId: 's-103', qty: 30, buyPrice: 29948, sellPrice: 29947, pnl: -60, boughtTimestamp: '08/10/2026 09:10:48', soldTimestamp: '08/10/2026 09:10:44' }),
  shortRow({ buyFillId: 'b-134', sellFillId: 's-123', qty: 6, buyPrice: 29952.25, sellPrice: 29948.25, pnl: -48, boughtTimestamp: '08/10/2026 09:11:13', soldTimestamp: '08/10/2026 09:10:57' }),
  shortRow({ buyFillId: 'b-145', sellFillId: 's-123', qty: 24, buyPrice: 29952.50, sellPrice: 29948.25, pnl: -204, boughtTimestamp: '08/10/2026 09:11:13', soldTimestamp: '08/10/2026 09:10:57' }),
  shortRow({ buyFillId: 'b-151', sellFillId: 's-151', qty: 30, buyPrice: 29953, sellPrice: 29950.25, pnl: -165, boughtTimestamp: '08/10/2026 09:12:10', soldTimestamp: '08/10/2026 09:11:18' }),
  shortRow({ buyFillId: 'b-180', sellFillId: 's-180', qty: 30, buyPrice: 29954, sellPrice: 29959.25, pnl: 315, boughtTimestamp: '08/10/2026 09:18:11', soldTimestamp: '08/10/2026 09:13:29' }),
  shortRow({ buyFillId: 'b-208', sellFillId: 's-208', qty: 30, buyPrice: 29962.75, sellPrice: 29958.25, pnl: -270, boughtTimestamp: '08/10/2026 09:18:37', soldTimestamp: '08/10/2026 09:18:27' }),
  shortRow({ buyFillId: 'b-228', sellFillId: 's-228', qty: 30, buyPrice: 29944.75, sellPrice: 29959.75, pnl: 900, boughtTimestamp: '08/10/2026 09:21:02', soldTimestamp: '08/10/2026 09:18:41' }),
  shortRow({ buyFillId: 'b-260', sellFillId: 's-260', qty: 30, buyPrice: 29943.75, sellPrice: 29936, pnl: -465, boughtTimestamp: '08/10/2026 09:21:21', soldTimestamp: '08/10/2026 09:21:07' }),
  shortRow({ buyFillId: 'b-284', sellFillId: 's-284', qty: 30, buyPrice: 29912.25, sellPrice: 29942.75, pnl: 1830, boughtTimestamp: '08/10/2026 09:27:17', soldTimestamp: '08/10/2026 09:21:27' }),
];

const sampleThreeShapedRows = [
  shortRow({ buyFillId: 'p3-b-1', sellFillId: 'p3-s-1', qty: 5, buyPrice: 29947.50, sellPrice: 29960.25, pnl: 127.50, boughtTimestamp: '08/10/2026 09:17:37', soldTimestamp: '08/10/2026 09:14:20' }),
  shortRow({ buyFillId: 'p3-b-2', sellFillId: 'p3-s-1', qty: 1, buyPrice: 29947.50, sellPrice: 29960.25, pnl: 25.50, boughtTimestamp: '08/10/2026 09:17:37', soldTimestamp: '08/10/2026 09:14:20' }),
  shortRow({ buyFillId: 'p3-b-3', sellFillId: 'p3-s-1', qty: 24, buyPrice: 29947.50, sellPrice: 29960.25, pnl: 612, boughtTimestamp: '08/10/2026 09:17:37', soldTimestamp: '08/10/2026 09:14:20' }),
  shortRow({ buyFillId: 'p3-b-4', sellFillId: 'p3-s-2', qty: 7, buyPrice: 29954, sellPrice: 29949, pnl: -70, boughtTimestamp: '08/10/2026 09:18:11', soldTimestamp: '08/10/2026 09:17:42' }),
  shortRow({ buyFillId: 'p3-b-5', sellFillId: 'p3-s-2', qty: 23, buyPrice: 29954.25, sellPrice: 29949, pnl: -241.50, boughtTimestamp: '08/10/2026 09:18:11', soldTimestamp: '08/10/2026 09:17:42' }),
  shortRow({ buyFillId: 'p3-b-6', sellFillId: 'p3-s-3', qty: 30, buyPrice: 29962.75, sellPrice: 29955.75, pnl: -420, boughtTimestamp: '08/10/2026 09:18:37', soldTimestamp: '08/10/2026 09:18:15' }),
  shortRow({ buyFillId: 'p3-b-7', sellFillId: 'p3-s-4', qty: 30, buyPrice: 29940.50, sellPrice: 29958, pnl: 1050, boughtTimestamp: '08/10/2026 09:20:29', soldTimestamp: '08/10/2026 09:18:46' }),
];

function totals(rows) {
  return rows.reduce((result, row) => ({
    gross: result.gross + row.pnl_gross,
    fees: result.fees + row.fees,
    net: result.net + row.pnl_net,
  }), { gross: 0, fees: 0, net: 0 });
}

function emptyAccountQueryable() {
  return {
    async query(sql, values) {
      if (sql.includes('SELECT dedup_key')) return { rows: [] };
      if (sql.includes('INSERT INTO trades')) {
        const columnCount = 26;
        return {
          rows: Array.from({ length: values.length / columnCount }, (_, index) => ({
            id: `trade-${index + 1}`,
            dedup_key: values[index * columnCount + columnCount - 1],
          })),
        };
      }
      throw new Error(`Unexpected query: ${sql}`);
    },
  };
}

test('groups six partial closing BUY fills into one SHORT logical Trade', () => {
  const [trade] = parseTradovate(csv(sixPartialClosingFills));
  assert.equal(parseTradovate(csv(sixPartialClosingFills)).length, 1);
  assert.equal(trade.direction, 'short');
  assert.equal(trade.quantity, 30);
  assert.equal(trade.entry_price, 29939.5);
  assert.equal(trade.exit_price, 29943.8);
  assert.equal(trade.pnl_gross, -258);
  assert.equal(trade.fees, 57);
  assert.equal(trade.pnl_net, -315);
  assert.equal(trade.entry_datetime, toISO('08/10/2026 09:04:23'));
  assert.equal(trade.exit_datetime, toISO('08/10/2026 09:08:25'));
  assert.equal(trade.duration_minutes, 4);
  assert.equal(trade._sourceMembers.length, 6);
  assert.equal(trade._sourceMembers.some((member) => member.physicalDuplicate), false);
});

test('groups a 6 + 24 partial exit into one 30-contract Trade', () => {
  const rows = sampleTwoShapedRows.filter((row) => row.sellFillId === 's-123');
  const trades = parseTradovate(csv(rows));
  assert.equal(trades.length, 1);
  assert.equal(trades[0].quantity, 30);
});

test('Performance (2)-shaped fixture produces 10 logical Trades with exact totals', async () => {
  const parsed = await parseImport('tradovate', csv(sampleTwoShapedRows));
  assert.deepEqual(parsed.stats, {
    total: 16,
    uniqueInFile: 10,
    inFileDuplicates: 0,
    sourceRowCount: 16,
    logicalTradeCount: 10,
    tradesToImport: 10,
  });
  assert.deepEqual(totals(parsed.rows), { gross: 1365, fees: 570, net: 795 });
  assert.equal(parsed.sourceRows.find((row) => row._sourceIdentifier === '615304740050:615304740007')._withinFileDuplicate, false);
  const committed = await commitImport('user', parsed.rows, 'account', emptyAccountQueryable());
  assert.equal(committed.inserted, 10);
});

test('Performance (3)-shaped fixture produces 4 logical Trades with exact totals', async () => {
  const parsed = await parseImport('tradovate', csv(sampleThreeShapedRows));
  assert.equal(parsed.stats.sourceRowCount, 7);
  assert.equal(parsed.stats.logicalTradeCount, 4);
  assert.equal(parsed.stats.tradesToImport, 4);
  assert.deepEqual(totals(parsed.rows), { gross: 1083.5, fees: 228, net: 855.5 });
  const committed = await commitImport('user', parsed.rows, 'account', emptyAccountQueryable());
  assert.equal(committed.inserted, 4);
});

test('nearby SHORT Trades with different opening fill IDs remain separate', () => {
  const rows = [
    shortRow({ buyFillId: 'near-b-1', sellFillId: 'near-s-1', qty: 30, buyPrice: 100, sellPrice: 101, pnl: 60, boughtTimestamp: '08/10/2026 10:00:05', soldTimestamp: '08/10/2026 10:00:00' }),
    shortRow({ buyFillId: 'near-b-2', sellFillId: 'near-s-2', qty: 30, buyPrice: 100, sellPrice: 101, pnl: 60, boughtTimestamp: '08/10/2026 10:00:06', soldTimestamp: '08/10/2026 10:00:01' }),
  ];
  assert.equal(parseTradovate(csv(rows)).length, 2);
});

test('does not broadly group rows whose expected opening fill ID is missing', () => {
  const rows = [
    shortRow({ buyFillId: 'missing-b-1', sellFillId: '', qty: 1, buyPrice: 99, sellPrice: 100, pnl: 2, boughtTimestamp: '08/10/2026 10:01:00', soldTimestamp: '08/10/2026 10:00:00' }),
    shortRow({ buyFillId: 'missing-b-2', sellFillId: '', qty: 1, buyPrice: 99, sellPrice: 100, pnl: 2, boughtTimestamp: '08/10/2026 10:01:00', soldTimestamp: '08/10/2026 10:00:00' }),
  ];
  assert.equal(parseTradovate(csv(rows)).length, 2);
});

test('mirrors existing LONG semantics by grouping closing SELL fills on opening buyFillId', () => {
  const rows = [
    { buyFillId: 'long-open', sellFillId: 'long-close-1', qty: 10, buyPrice: 100, sellPrice: 102, pnl: 20, boughtTimestamp: '08/10/2026 10:00:00', soldTimestamp: '08/10/2026 10:05:00' },
    { buyFillId: 'long-open', sellFillId: 'long-close-2', qty: 20, buyPrice: 100, sellPrice: 103, pnl: 60, boughtTimestamp: '08/10/2026 10:00:00', soldTimestamp: '08/10/2026 10:06:00' },
  ];
  const trades = parseTradovate(csv(rows));
  assert.equal(trades.length, 1);
  assert.equal(trades[0].direction, 'long');
  assert.equal(trades[0].quantity, 30);
  assert.equal(trades[0].entry_price, 100);
  assert.equal(trades[0].exit_price, 102.66666667);
  assert.equal(trades[0].exit_datetime, toISO('08/10/2026 10:06:00'));
});

test('counts an exact repeated execution pair once and preserves duplicate lineage', async () => {
  const row = shortRow({ buyFillId: 'duplicate-buy', sellFillId: 'duplicate-sell', qty: 2, buyPrice: 99, sellPrice: 100, pnl: 4, boughtTimestamp: '08/10/2026 10:01:00', soldTimestamp: '08/10/2026 10:00:00' });
  const parsed = await parseImport('tradovate', csv([row, { ...row }]));
  assert.equal(parsed.rows.length, 1);
  assert.equal(parsed.rows[0].quantity, 2);
  assert.equal(parsed.sourceRows.length, 2);
  assert.equal(parsed.sourceRows.filter((sourceRow) => sourceRow._physicalDuplicate).length, 1);
  assert.equal(parsed.stats.inFileDuplicates, 1);
});

test('fails safely when the same execution pair has conflicting economics', () => {
  const row = shortRow({ buyFillId: 'conflict-buy', sellFillId: 'conflict-sell', qty: 2, buyPrice: 99, sellPrice: 100, pnl: 4, boughtTimestamp: '08/10/2026 10:01:00', soldTimestamp: '08/10/2026 10:00:00' });
  assert.throws(
    () => parseTradovate(csv([row, { ...row, pnl: 5 }])),
    (error) => error.code === 'IMPORT_SOURCE_CONFLICT',
  );
});

test('fails safely when one opening fill ID has conflicting opening semantics', () => {
  const rows = [
    shortRow({ buyFillId: 'close-1', sellFillId: 'conflicting-open', qty: 1, buyPrice: 99, sellPrice: 100, pnl: 2, boughtTimestamp: '08/10/2026 10:01:00', soldTimestamp: '08/10/2026 10:00:00' }),
    shortRow({ buyFillId: 'close-2', sellFillId: 'conflicting-open', qty: 1, buyPrice: 100, sellPrice: 101, pnl: 2, boughtTimestamp: '08/10/2026 10:01:00', soldTimestamp: '08/10/2026 10:00:00' }),
  ];
  assert.throws(
    () => parseTradovate(csv(rows)),
    (error) => error.code === 'IMPORT_SOURCE_CONFLICT',
  );
});
