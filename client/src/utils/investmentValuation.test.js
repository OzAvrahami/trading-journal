import { describe, expect, it } from 'vitest';
import {
  quoteSymbolsForHoldings,
  valueInvestmentCurrencyGroups,
  valueInvestmentHolding,
  valueInvestmentHoldings,
} from './investmentValuation.js';

function holding(overrides = {}) {
  return {
    accountId: 'account-a',
    instrumentId: 'instrument-aapl',
    symbol: 'AAPL',
    assetType: 'stock',
    currency: 'USD',
    quantity: 10,
    averageCost: 250,
    costBasis: 2500,
    realizedPnl: 175,
    latestPrice: 275,
    latestPriceDate: '2026-08-01',
    marketValue: 2750,
    unrealizedPnl: 250,
    unrealizedReturnPercent: 0.1,
    valuationAvailable: true,
    ...overrides,
  };
}

function quote(symbol = 'AAPL', price = 312, overrides = {}) {
  return {
    symbol,
    price,
    change: 1.5,
    changePercent: 0.4831,
    previousClose: price - 1.5,
    asOf: '2026-08-10T18:30:00.000Z',
    ...overrides,
  };
}

describe('live investment valuation', () => {
  it('values a winning position from canonical quantity and cost basis', () => {
    const result = valueInvestmentHolding(holding(), quote());

    expect(result.marketValue).toBe(3120);
    expect(result.unrealizedPnl).toBe(620);
    expect(result.unrealizedReturnPercent).toBe(0.248);
    expect(result.dailyPnl).toBe(15);
    expect(result.valuationSource).toBe('live');
  });

  it('values a losing position without changing its book fields', () => {
    const ledger = {
      holding: holding({ averageCost: 350, costBasis: 3500, realizedPnl: -40 }),
      transactions: [{ transactionType: 'buy', quantity: 10, price: 350 }],
    };
    const snapshot = structuredClone(ledger);
    const result = valueInvestmentHolding(ledger.holding, quote());

    expect(result.marketValue).toBe(3120);
    expect(result.unrealizedPnl).toBe(-380);
    expect(result.averageCost).toBe(350);
    expect(result.costBasis).toBe(3500);
    expect(result.realizedPnl).toBe(-40);
    expect(ledger).toEqual(snapshot);
  });

  it('uses stored manual valuation as fallback and never invents zero for a missing quote', () => {
    const manual = valueInvestmentHolding(holding(), null);
    const unavailable = valueInvestmentHolding(holding({
      latestPrice: null,
      latestPriceDate: null,
      marketValue: null,
      unrealizedPnl: null,
      unrealizedReturnPercent: null,
      valuationAvailable: false,
    }), quote('AAPL', Number.NaN));

    expect(manual).toMatchObject({ valuationSource: 'manual', marketValue: 2750, unrealizedPnl: 250 });
    expect(unavailable).toMatchObject({ valuationSource: 'unavailable', marketValue: null, unrealizedPnl: null });
    expect(Number.isNaN(unavailable.marketValue)).toBe(false);
  });

  it('aggregates multiple live-valued holdings while preserving cash and realized PnL', () => {
    const positions = [
      valueInvestmentHolding(holding(), quote()),
      valueInvestmentHolding(holding({
        accountId: 'account-b', instrumentId: 'instrument-msft', symbol: 'MSFT',
        quantity: 5, averageCost: 200, costBasis: 1000, realizedPnl: 25,
      }), quote('MSFT', 200, { change: -2, changePercent: -0.9901 })),
    ];
    const [group] = valueInvestmentCurrencyGroups([{
      currency: 'USD', accountCount: 2, positionCount: 2, cashBalance: 100,
      totalCostBasis: 3500, realizedPnl: 200, dividendIncome: 0, totalFees: 5,
      netContributions: 4000, marketValue: 0, unrealizedPnl: 0, totalValue: 0,
      missingPriceCount: 0, valuationAvailable: true,
    }], positions);

    expect(group.marketValue).toBe(4120);
    expect(group.unrealizedPnl).toBe(620);
    expect(group.unrealizedReturnPercent).toBeCloseTo(620 / 3500);
    expect(group.totalValue).toBe(4220);
    expect(group.dailyPnl).toBe(5);
    expect(group.realizedPnl).toBe(200);
  });

  it('enforces selected-account isolation before applying shared symbol quotes', () => {
    const holdings = [holding(), holding({ accountId: 'account-b', quantity: 99, costBasis: 1 })];
    const valued = valueInvestmentHoldings(holdings, { AAPL: quote() }, { accountId: 'account-a' });

    expect(valued).toHaveLength(1);
    expect(valued[0].accountId).toBe('account-a');
    expect(valued[0].marketValue).toBe(3120);
  });

  it('deduplicates eligible symbols and conservatively excludes non-USD positions', () => {
    expect(quoteSymbolsForHoldings([
      holding({ symbol: ' aapl ' }),
      holding({ symbol: 'AAPL', accountId: 'account-b' }),
      holding({ symbol: 'MSFT' }),
      holding({ symbol: 'TEVA', currency: 'ILS' }),
    ])).toEqual(['AAPL', 'MSFT']);
  });
});
