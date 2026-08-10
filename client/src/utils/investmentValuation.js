const MARKET_SYMBOL_PATTERN = /^[A-Z0-9.-]{1,20}$/;
const LIVE_QUOTE_CURRENCY = 'USD';

function finiteNumber(value) {
  if (value == null || value === '') return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function round(value, decimals = 2) {
  const numericValue = finiteNumber(value);
  return numericValue == null ? null : Number(numericValue.toFixed(decimals));
}

export function normalizeMarketSymbol(symbol) {
  if (typeof symbol !== 'string') return null;
  const normalized = symbol.trim().toUpperCase();
  return MARKET_SYMBOL_PATTERN.test(normalized) ? normalized : null;
}

export function canUseLiveQuote(holding) {
  return Boolean(
    holding
    && ['stock', 'etf'].includes(holding.assetType)
    && holding.currency === LIVE_QUOTE_CURRENCY
    && normalizeMarketSymbol(holding.symbol),
  );
}

export function quoteSymbolsForHoldings(holdings = []) {
  return [...new Set(
    holdings
      .filter(canUseLiveQuote)
      .map((item) => normalizeMarketSymbol(item.symbol)),
  )].sort();
}

export function usableQuote(quote) {
  const price = finiteNumber(quote?.price);
  const asOf = typeof quote?.asOf === 'string' ? Date.parse(quote.asOf) : NaN;
  return Boolean(normalizeMarketSymbol(quote?.symbol) && price != null && price > 0 && Number.isFinite(asOf));
}

export function quotesBySymbol(quotes = []) {
  const lookup = {};
  for (const quote of quotes) {
    if (usableQuote(quote)) lookup[normalizeMarketSymbol(quote.symbol)] = quote;
  }
  return lookup;
}

function storedValuation(holding) {
  const storedAvailable = Boolean(holding.valuationAvailable)
    && finiteNumber(holding.marketValue) != null
    && finiteNumber(holding.unrealizedPnl) != null;
  const storedPrice = finiteNumber(holding.latestPrice);
  return {
    ...holding,
    marketValue: storedAvailable ? finiteNumber(holding.marketValue) : null,
    unrealizedPnl: storedAvailable ? finiteNumber(holding.unrealizedPnl) : null,
    unrealizedReturnPercent: storedAvailable ? finiteNumber(holding.unrealizedReturnPercent) : null,
    valuationAvailable: storedAvailable,
    valuationPrice: storedAvailable && storedPrice != null && storedPrice > 0 ? storedPrice : null,
    valuationAsOf: storedAvailable ? holding.latestPriceDate ?? null : null,
    valuationSource: storedAvailable ? 'manual' : 'unavailable',
    liveQuote: null,
    dailyPnl: null,
    dailyReturnPercent: null,
  };
}

export function valueInvestmentHolding(holding, quote = null) {
  const fallback = storedValuation(holding);
  if (!canUseLiveQuote(holding) || !usableQuote(quote)) return fallback;

  const quantity = finiteNumber(holding.quantity);
  const costBasis = finiteNumber(holding.costBasis);
  const livePrice = finiteNumber(quote.price);
  if (quantity == null || quantity <= 0 || costBasis == null || costBasis < 0 || livePrice == null) return fallback;

  const marketValue = round(quantity * livePrice);
  const unrealizedPnl = round(marketValue - costBasis);
  const quoteChange = finiteNumber(quote.change);
  const quoteChangePercent = finiteNumber(quote.changePercent);
  return {
    ...holding,
    marketValue,
    unrealizedPnl,
    unrealizedReturnPercent: costBasis !== 0 ? round(unrealizedPnl / costBasis, 8) : null,
    valuationAvailable: true,
    valuationPrice: livePrice,
    valuationAsOf: quote.asOf,
    valuationSource: 'live',
    liveQuote: quote,
    dailyPnl: quoteChange == null ? null : round(quantity * quoteChange),
    dailyReturnPercent: quoteChangePercent == null ? null : round(quoteChangePercent / 100, 8),
  };
}

export function valueInvestmentHoldings(holdings = [], quoteLookup = {}, { accountId = null } = {}) {
  return holdings
    .filter((holding) => !accountId || holding.accountId === accountId)
    .map((holding) => {
      const symbol = normalizeMarketSymbol(holding.symbol);
      return valueInvestmentHolding(holding, symbol ? quoteLookup[symbol] : null);
    });
}

export function valueInvestmentCurrencyGroups(groups = [], holdings = []) {
  return groups.map((group) => {
    const positions = holdings.filter((holding) => holding.currency === group.currency);
    const hasEveryPosition = positions.length === Number(group.positionCount || 0);
    const valuationAvailable = hasEveryPosition && positions.every((position) => position.valuationAvailable);
    const marketValue = valuationAvailable
      ? round(positions.reduce((sum, position) => sum + position.marketValue, 0))
      : null;
    const unrealizedPnl = valuationAvailable
      ? round(positions.reduce((sum, position) => sum + position.unrealizedPnl, 0))
      : null;
    const totalCostBasis = finiteNumber(group.totalCostBasis) ?? 0;
    const dailyChangeAvailable = positions.length > 0
      && positions.every((position) => position.valuationSource === 'live' && position.dailyPnl != null);
    const livePriceCount = positions.filter((position) => position.valuationSource === 'live').length;
    const manualPriceCount = positions.filter((position) => position.valuationSource === 'manual').length;
    const liveTimes = positions
      .filter((position) => position.valuationSource === 'live' && position.valuationAsOf)
      .map((position) => position.valuationAsOf)
      .sort();
    return {
      ...group,
      marketValue,
      unrealizedPnl,
      unrealizedReturnPercent: valuationAvailable && totalCostBasis !== 0
        ? round(unrealizedPnl / totalCostBasis, 8)
        : null,
      totalValue: valuationAvailable ? round((finiteNumber(group.cashBalance) ?? 0) + marketValue) : null,
      valuationAvailable,
      missingPriceCount: positions.filter((position) => !position.valuationAvailable).length,
      livePriceCount,
      manualPriceCount,
      dailyPnl: dailyChangeAvailable
        ? round(positions.reduce((sum, position) => sum + position.dailyPnl, 0))
        : null,
      dailyChangeAvailable,
      latestLiveAsOf: liveTimes.at(-1) ?? null,
    };
  });
}
