import { createError } from '../middleware/errorHandler.js';

const EPSILON = 1e-8;

function numeric(value, fallback = 0) {
  const parsed = value == null ? fallback : Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function round(value, decimals = 8) {
  if (value == null || !Number.isFinite(Number(value))) return null;
  return Number(Number(value).toFixed(decimals));
}

function chronology(left, right) {
  return String(left.transactionDate).localeCompare(String(right.transactionDate))
    || String(left.createdAt ?? '').localeCompare(String(right.createdAt ?? ''))
    || String(left.id ?? '').localeCompare(String(right.id ?? ''));
}

function emptyPosition(transaction) {
  return {
    instrumentId: transaction.instrumentId,
    symbol: transaction.instrumentSymbol ?? null,
    name: transaction.instrumentName ?? null,
    exchange: transaction.instrumentExchange ?? null,
    assetType: transaction.instrumentAssetType ?? null,
    currency: transaction.currency,
    quantity: 0,
    costBasis: 0,
    realizedPnl: 0,
    dividendIncome: 0,
  };
}

function invalidHoldings(transaction, available) {
  throw createError(
    'PORTFOLIO_INSUFFICIENT_HOLDINGS',
    'This change would make a Sell exceed the available holdings.',
    409,
    { transactionId: transaction.id ?? null, transactionDate: transaction.transactionDate, availableQuantity: round(available) },
  );
}

function invalidCash(transaction, available) {
  throw createError(
    'PORTFOLIO_INSUFFICIENT_CASH',
    'This change would make the Portfolio cash balance negative.',
    409,
    { transactionId: transaction.id ?? null, transactionDate: transaction.transactionDate, availableCash: round(available, 2) },
  );
}

/**
 * Canonical moving weighted-average replay. Transactions must already have
 * valid shapes and one Portfolio currency; this function independently sorts
 * by DATE, creation instant, then ID so historical edits are deterministic.
 */
export function replayInvestmentTransactions(transactions, { enforceCash = true } = {}) {
  const positions = new Map();
  let cashBalance = 0;
  let netContributions = 0;
  let realizedPnl = 0;
  let dividendIncome = 0;
  let totalFees = 0;

  for (const transaction of [...transactions].sort(chronology)) {
    const type = transaction.transactionType;
    const quantity = numeric(transaction.quantity);
    const price = numeric(transaction.price);
    const amount = numeric(transaction.amount);
    const fees = numeric(transaction.fees);
    const position = transaction.instrumentId
      ? (positions.get(transaction.instrumentId) ?? emptyPosition(transaction))
      : null;

    if (type === 'buy') {
      const gross = quantity * price;
      const requiredCash = gross + fees;
      if (enforceCash && cashBalance + EPSILON < requiredCash) invalidCash(transaction, cashBalance);
      position.quantity += quantity;
      position.costBasis += requiredCash;
      cashBalance -= requiredCash;
      totalFees += fees;
      positions.set(transaction.instrumentId, position);
    } else if (type === 'sell') {
      if (!position || position.quantity + EPSILON < quantity) invalidHoldings(transaction, position?.quantity ?? 0);
      const averageCost = position.quantity > EPSILON ? position.costBasis / position.quantity : 0;
      const removedBasis = averageCost * quantity;
      const salePnl = quantity * price - removedBasis - fees;
      position.quantity -= quantity;
      position.costBasis -= removedBasis;
      if (Math.abs(position.quantity) <= EPSILON) {
        position.quantity = 0;
        position.costBasis = 0;
      }
      position.realizedPnl += salePnl;
      realizedPnl += salePnl;
      cashBalance += quantity * price - fees;
      totalFees += fees;
      positions.set(transaction.instrumentId, position);
    } else if (type === 'dividend') {
      position.dividendIncome += amount;
      dividendIncome += amount;
      cashBalance += amount - fees;
      totalFees += fees;
      positions.set(transaction.instrumentId, position);
    } else if (type === 'fee') {
      if (enforceCash && cashBalance + EPSILON < amount) invalidCash(transaction, cashBalance);
      cashBalance -= amount;
      totalFees += amount;
    } else if (type === 'deposit') {
      cashBalance += amount;
      netContributions += amount;
    } else if (type === 'withdrawal') {
      if (enforceCash && cashBalance + EPSILON < amount) invalidCash(transaction, cashBalance);
      cashBalance -= amount;
      netContributions -= amount;
    }
  }

  const allPositions = [...positions.values()].map((position) => ({
    ...position,
    quantity: round(position.quantity),
    averageCost: position.quantity > EPSILON ? round(position.costBasis / position.quantity) : null,
    costBasis: round(position.costBasis, 2),
    realizedPnl: round(position.realizedPnl, 2),
    dividendIncome: round(position.dividendIncome, 2),
  }));

  return {
    positions: allPositions.filter((position) => position.quantity > EPSILON),
    allPositions,
    cashBalance: round(cashBalance, 2),
    netContributions: round(netContributions, 2),
    totalCostBasis: round(allPositions.reduce((sum, position) => sum + position.costBasis, 0), 2),
    realizedPnl: round(realizedPnl, 2),
    dividendIncome: round(dividendIncome, 2),
    totalFees: round(totalFees, 2),
  };
}

export function applyManualPrices(replay, latestPrices = new Map()) {
  let missingPriceCount = 0;
  let marketValue = 0;
  let unrealizedPnl = 0;
  let lastPriceDate = null;

  const positions = replay.positions.map((position) => {
    const pricePoint = latestPrices.get(position.instrumentId) ?? null;
    const latestPrice = pricePoint == null ? null : numeric(pricePoint.price, null);
    const valuationAvailable = latestPrice != null;
    if (!valuationAvailable) missingPriceCount += 1;
    const positionMarketValue = valuationAvailable ? round(position.quantity * latestPrice, 2) : null;
    const positionUnrealized = valuationAvailable ? round(positionMarketValue - position.costBasis, 2) : null;
    if (valuationAvailable) {
      marketValue += positionMarketValue;
      unrealizedPnl += positionUnrealized;
      if (!lastPriceDate || pricePoint.priceDate > lastPriceDate) lastPriceDate = pricePoint.priceDate;
    }
    return {
      ...position,
      latestPrice,
      latestPriceDate: pricePoint?.priceDate ?? null,
      marketValue: positionMarketValue,
      unrealizedPnl: positionUnrealized,
      unrealizedReturnPercent: valuationAvailable && position.costBasis > 0
        ? round(positionUnrealized / position.costBasis, 6)
        : null,
      valuationAvailable,
    };
  });

  const valuationAvailable = missingPriceCount === 0;
  const totalValue = valuationAvailable ? round(replay.cashBalance + marketValue, 2) : null;
  return {
    ...replay,
    positions,
    positionCount: positions.length,
    marketValue: valuationAvailable ? round(marketValue, 2) : null,
    unrealizedPnl: valuationAvailable ? round(unrealizedPnl, 2) : null,
    totalValue,
    totalReturn: valuationAvailable ? round(totalValue - replay.netContributions, 2) : null,
    valuationAvailable,
    missingPriceCount,
    lastPriceDate,
  };
}

