import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { describe, test } from 'node:test';
import { applyManualPrices, replayInvestmentTransactions } from './portfolioCalculationService.js';
import { createPortfolioSchema, updatePortfolioSchema } from '../routes/portfolios.js';
import { createInstrumentSchema, updateInstrumentSchema } from '../routes/investmentInstruments.js';
import { createTransactionSchema, listTransactionsSchema } from '../routes/portfolioTransactions.js';
import { priceSchema } from '../routes/investmentPrices.js';
import { getPortfolio, listInstruments, listPortfolios, listPrices, listTransactions, mapTransactionRow } from './portfolioService.js';

const migrationUrl = new URL('../db/migrations/015_portfolio_foundation.sql', import.meta.url);
const tx = (overrides) => ({ id: randomUUID(), transactionDate: '2026-01-01', createdAt: '2026-01-01T12:00:00.000Z', currency: 'USD', fees: 0, ...overrides });

describe('Portfolio foundation migration contract', () => {
  test('creates four isolated investment tables and leaves day-trading tables untouched', async () => {
    const sql = await readFile(migrationUrl, 'utf8');
    for (const table of ['investment_portfolios','investment_instruments','investment_transactions','investment_prices']) {
      assert.match(sql, new RegExp(`CREATE TABLE IF NOT EXISTS ${table}`));
    }
    assert.doesNotMatch(sql, /ALTER TABLE\s+(?:trades|trading_accounts)/i);
    assert.doesNotMatch(sql, /INSERT INTO\s+(?:trades|trading_accounts)|UPDATE\s+(?:trades|trading_accounts)|DELETE\s+FROM/i);
    assert.doesNotMatch(sql, /portfolio_snapshot|holding_snapshot|tax_lot|CREATE POLICY/i);
  });

  test('enforces defaults, identity, transaction shapes, strict DATEs, and manual prices', async () => {
    const sql = await readFile(migrationUrl, 'utf8');
    assert.match(sql, /investment_portfolios_one_default_per_user[\s\S]*WHERE is_default = TRUE/i);
    assert.match(sql, /investment_portfolios_default_requires_active/);
    assert.match(sql, /investment_instruments_user_identity_unique[\s\S]*COALESCE\(btrim\(exchange\), ''\)/i);
    assert.match(sql, /transaction_date DATE NOT NULL/);
    assert.match(sql, /investment_transactions_shape_valid/);
    for (const type of ['buy','sell','dividend','fee','deposit','withdrawal']) assert.match(sql, new RegExp(`'${type}'`));
    assert.match(sql, /price_date DATE NOT NULL/);
    assert.match(sql, /investment_prices_source_manual CHECK \(source = 'manual'\)/);
    assert.match(sql, /investment_prices_user_instrument_date_unique UNIQUE/);
  });

  test('installs owned currency integrity and updated-at triggers transactionally', async () => {
    const sql = await readFile(migrationUrl, 'utf8');
    assert.match(sql, /^--[\s\S]*BEGIN;[\s\S]*COMMIT;\s*$/);
    assert.match(sql, /validate_investment_transaction_context/);
    assert.match(sql, /investment_transactions_portfolio_owner/);
    assert.match(sql, /investment_transactions_instrument_owner/);
    assert.match(sql, /investment_transactions_portfolio_currency_match/);
    assert.match(sql, /investment_prices_instrument_currency_match/);
    for (const table of ['investment_portfolios','investment_instruments','investment_transactions','investment_prices']) {
      assert.match(sql, new RegExp(`${table}_updated_at[\\s\\S]*update_updated_at_column`));
    }
  });
});

describe('moving weighted-average Portfolio replay', () => {
  test('derives Buy basis, partial Sell PnL, dividend, fees, cash, and valuation', () => {
    const instrument = { instrumentId:'11111111-1111-4111-8111-111111111111', instrumentSymbol:'VOO', instrumentName:'ETF', instrumentAssetType:'etf' };
    const replay = replayInvestmentTransactions([
      tx({id:'00000000-0000-4000-8000-000000000001',transactionType:'deposit',amount:2000}),
      tx({id:'00000000-0000-4000-8000-000000000002',transactionType:'buy',quantity:10,price:100,fees:10,...instrument}),
      tx({id:'00000000-0000-4000-8000-000000000003',transactionType:'sell',quantity:4,price:150,fees:5,...instrument}),
      tx({id:'00000000-0000-4000-8000-000000000004',transactionType:'dividend',amount:50,fees:2,...instrument}),
      tx({id:'00000000-0000-4000-8000-000000000005',transactionType:'fee',amount:10}),
    ]);
    assert.equal(replay.positions[0].quantity, 6);
    assert.equal(replay.positions[0].averageCost, 101);
    assert.equal(replay.positions[0].costBasis, 606);
    assert.equal(replay.realizedPnl, 191);
    assert.equal(replay.dividendIncome, 50);
    assert.equal(replay.totalFees, 27);
    assert.equal(replay.cashBalance, 1623);
    const valued = applyManualPrices(replay, new Map([[instrument.instrumentId,{price:120,priceDate:'2026-01-02'}]]));
    assert.equal(valued.marketValue, 720);
    assert.equal(valued.unrealizedPnl, 114);
    assert.equal(valued.totalValue, 2343);
    assert.equal(valued.totalReturn, 343);
  });

  test('supports full closure and a fresh weighted-average re-entry', () => {
    const instrumentId='22222222-2222-4222-8222-222222222222';
    const replay=replayInvestmentTransactions([
      tx({id:'1',transactionType:'deposit',amount:5000}),
      tx({id:'2',transactionType:'buy',instrumentId,quantity:10,price:50}),
      tx({id:'3',transactionType:'sell',instrumentId,quantity:10,price:60}),
      tx({id:'4',transactionType:'buy',instrumentId,quantity:5,price:80,fees:5}),
    ]);
    assert.equal(replay.positions[0].quantity,5);
    assert.equal(replay.positions[0].averageCost,81);
    assert.equal(replay.positions[0].realizedPnl,100);
  });

  test('sorts deterministically and rejects a later Sell after historical changes', () => {
    const instrumentId='33333333-3333-4333-8333-333333333333';
    assert.throws(()=>replayInvestmentTransactions([
      tx({id:'c',transactionDate:'2026-01-03',transactionType:'sell',instrumentId,quantity:6,price:120}),
      tx({id:'a',transactionDate:'2026-01-01',transactionType:'deposit',amount:2000}),
      tx({id:'b',transactionDate:'2026-01-02',transactionType:'buy',instrumentId,quantity:5,price:100}),
    ]),(error)=>error.code==='PORTFOLIO_INSUFFICIENT_HOLDINGS');
  });

  test('does not treat a missing price as zero or partially total the Portfolio', () => {
    const instrumentId='44444444-4444-4444-8444-444444444444';
    const replay=replayInvestmentTransactions([tx({id:'1',transactionType:'deposit',amount:1000}),tx({id:'2',transactionType:'buy',instrumentId,quantity:2,price:100})]);
    const valued=applyManualPrices(replay,new Map());
    assert.equal(valued.positions[0].latestPrice,null);
    assert.equal(valued.positions[0].marketValue,null);
    assert.equal(valued.valuationAvailable,false);
    assert.equal(valued.totalValue,null);
    assert.equal(valued.totalReturn,null);
    assert.equal(valued.missingPriceCount,1);
  });

  test('revalidates later Sells after a historical edit or deletion', () => {
    const instrumentId='55555555-5555-4555-8555-555555555555';
    const deposit=tx({id:'1',transactionDate:'2026-01-01',transactionType:'deposit',amount:2000});
    const buy=tx({id:'2',transactionDate:'2026-01-02',transactionType:'buy',instrumentId,quantity:10,price:100});
    const sell=tx({id:'3',transactionDate:'2026-01-03',transactionType:'sell',instrumentId,quantity:8,price:110});
    assert.equal(replayInvestmentTransactions([deposit,buy,sell]).positions[0].quantity,2);
    assert.throws(()=>replayInvestmentTransactions([deposit,{...buy,quantity:5},sell]),(error)=>error.code==='PORTFOLIO_INSUFFICIENT_HOLDINGS');
    assert.throws(()=>replayInvestmentTransactions([deposit,sell]),(error)=>error.code==='PORTFOLIO_INSUFFICIENT_HOLDINGS');
  });

  test('keeps dividends and withdrawals out of average cost and investment profit', () => {
    const instrumentId='66666666-6666-4666-8666-666666666666';
    const replay=replayInvestmentTransactions([
      tx({id:'1',transactionType:'deposit',amount:3000}),
      tx({id:'2',transactionType:'buy',instrumentId,quantity:10,price:100,fees:10}),
      tx({id:'3',transactionType:'buy',instrumentId,quantity:5,price:80,fees:5}),
      tx({id:'4',transactionType:'dividend',instrumentId,amount:30,fees:1}),
      tx({id:'5',transactionType:'withdrawal',amount:100}),
    ]);
    assert.equal(replay.positions[0].averageCost,94.33333333);
    assert.equal(replay.positions[0].costBasis,1415);
    assert.equal(replay.positions[0].dividendIncome,30);
    assert.equal(replay.realizedPnl,0);
    assert.equal(replay.netContributions,2900);
    assert.equal(replay.totalFees,16);
  });
});

describe('Portfolio API validation', () => {
  const uuid='11111111-1111-4111-8111-111111111111';
  test('normalizes bounded Portfolio and Instrument fields without accepting ownership', () => {
    assert.deepEqual(createPortfolioSchema.parse({name:'  Long term ',baseCurrency:'usd'}),{name:'Long term',baseCurrency:'USD',isDefault:false});
    assert.equal(createPortfolioSchema.safeParse({name:'x',baseCurrency:'US',userId:uuid}).success,false);
    assert.equal(updatePortfolioSchema.safeParse({status:'archived'}).success,true);
    assert.deepEqual(createInstrumentSchema.parse({symbol:' voo ',assetType:'etf',currency:'usd'}),{symbol:'VOO',assetType:'etf',currency:'USD'});
    assert.equal(updateInstrumentSchema.safeParse({symbol:'AAPL'}).success,false);
  });

  test('validates every Transaction shape and preserves exact DATE strings', () => {
    const base={portfolioId:uuid,transactionDate:'2026-08-06',fees:0};
    assert.equal(createTransactionSchema.safeParse({...base,transactionType:'buy',instrumentId:uuid,quantity:1.25,price:100}).success,true);
    assert.equal(createTransactionSchema.safeParse({...base,transactionType:'sell',instrumentId:uuid,quantity:1,price:100,amount:100}).success,false);
    assert.equal(createTransactionSchema.safeParse({...base,transactionType:'dividend',instrumentId:uuid,amount:25}).success,true);
    assert.equal(createTransactionSchema.safeParse({...base,transactionType:'fee',amount:10}).success,true);
    assert.equal(createTransactionSchema.safeParse({...base,transactionType:'deposit',amount:1000}).success,true);
    assert.equal(createTransactionSchema.safeParse({...base,transactionType:'withdrawal',amount:100}).success,true);
    assert.equal(createTransactionSchema.safeParse({...base,transactionType:'buy',instrumentId:uuid,quantity:1,price:100,transactionDate:'2026-02-30'}).success,false);
    assert.equal(listTransactionsSchema.safeParse({from:'2026-02-02',to:'2026-02-01'}).success,false);
  });

  test('manual price validation requires positive same-shape currency metadata', () => {
    assert.deepEqual(priceSchema.parse({price:123.456,currency:'usd'}),{price:123.456,currency:'USD'});
    assert.equal(priceSchema.safeParse({price:0,currency:'USD'}).success,false);
    assert.equal(priceSchema.safeParse({price:1,currency:'US'}).success,false);
  });
});

describe('owned Portfolio read paths', () => {
  const userId='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';

  test('Portfolio and Instrument lists parameterize the authenticated user', async () => {
    const calls=[];const queryable={query:async(sql,params)=>{calls.push({sql,params});return{rows:[]};}};
    assert.deepEqual(await listPortfolios(userId,{includeArchived:true},queryable),{portfolios:[]});
    assert.deepEqual(await listInstruments(userId,{includeInactive:true,search:'VOO'},queryable),{instruments:[]});
    assert.equal(calls[0].params[0],userId);
    assert.equal(calls[1].params[0],userId);
    assert.match(calls[0].sql,/WHERE p\.user_id = \$1/);
    assert.match(calls[1].sql,/symbol ILIKE \$2/);
  });

  test('foreign Portfolio detail is indistinguishable from missing', async () => {
    const queryable={query:async(sql,params)=>{assert.match(sql,/p\.id = \$1 AND p\.user_id = \$2/);assert.equal(params[1],userId);return{rows:[]};}};
    await assert.rejects(getPortfolio(userId,'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',queryable),(error)=>error.code==='PORTFOLIO_NOT_FOUND'&&error.statusCode===404);
  });

  test('Transaction and price history remain user-scoped and paginated', async () => {
    const calls=[];const queryable={query:async(sql,params)=>{calls.push({sql,params});return /COUNT/.test(sql)?{rows:[{count:0}]}:{rows:[]};}};
    const transactions=await listTransactions(userId,{portfolioId:'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',limit:20,offset:5},queryable);
    const prices=await listPrices(userId,{},queryable);
    assert.deepEqual(transactions,{transactions:[],total:0,limit:20,offset:5});
    assert.deepEqual(prices,{prices:[]});
    assert.ok(calls.every((call)=>call.params[0]===userId));
    assert.match(calls[0].sql,/LIMIT \$3 OFFSET \$4/);
  });

  test('maps PostgreSQL DATE values without instant conversion', () => {
    const mapped=mapTransactionRow({id:'t',portfolio_id:'p',instrument_id:null,transaction_type:'deposit',transaction_date:'2026-08-06',amount:'100.00',fees:'0',currency:'USD',notes:null,created_at:'2026-08-06T00:00:00.000Z',updated_at:'2026-08-06T00:00:00.000Z'});
    assert.equal(mapped.transactionDate,'2026-08-06');
    assert.equal(mapped.amount,100);
  });
});
