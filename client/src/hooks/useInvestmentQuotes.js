import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { MARKET_DATA_BATCH_SIZE, marketDataApi } from '../api/marketData.js';
import { quoteSymbolsForHoldings, quotesBySymbol } from '../utils/investmentValuation.js';

async function loadQuoteBatches(symbols) {
  const batches = [];
  for (let index = 0; index < symbols.length; index += MARKET_DATA_BATCH_SIZE) {
    batches.push(symbols.slice(index, index + MARKET_DATA_BATCH_SIZE));
  }
  const results = await Promise.all(batches.map((batch) => marketDataApi.quotes(batch)));
  return results.flatMap((result) => Array.isArray(result?.quotes) ? result.quotes : []);
}

export function useInvestmentQuotes(holdings = [], { enabled = true } = {}) {
  const symbols = useMemo(() => quoteSymbolsForHoldings(holdings), [holdings]);
  const query = useQuery({
    queryKey: ['market-data', 'quotes', symbols],
    queryFn: () => loadQuoteBatches(symbols),
    enabled: enabled && symbols.length > 0,
    retry: false,
    staleTime: 30_000,
  });
  const quoteLookup = useMemo(() => quotesBySymbol(query.data), [query.data]);
  return { ...query, quoteLookup, symbols };
}
