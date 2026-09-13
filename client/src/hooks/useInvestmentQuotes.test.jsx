import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook, waitFor } from '@testing-library/react';
import { expect, it, vi } from 'vitest';
const quotes = vi.hoisted(() => vi.fn());
vi.mock('../api/marketData.js', () => ({ MARKET_DATA_BATCH_SIZE: 25, marketDataApi: { quotes } }));
import { useInvestmentQuotes } from './useInvestmentQuotes.js';
import { valueInvestmentHolding } from '../utils/investmentValuation.js';

it('uses dated manual fallback after a failed refresh instead of retained live data', async () => {
  const holding = { symbol: 'TJUSD', assetType: 'stock', currency: 'USD', quantity: 3, costBasis: 333,
    latestPrice: 110, latestPriceDate: '2026-01-02', marketValue: 330, unrealizedPnl: -3, valuationAvailable: true };
  quotes.mockResolvedValueOnce({ quotes: [{ symbol: 'TJUSD', price: 120, asOf: '2026-09-12T12:00:00Z' }] });
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const wrapper = ({ children }) => <QueryClientProvider client={client}>{children}</QueryClientProvider>;
  const { result, unmount } = renderHook(() => useInvestmentQuotes([holding]), { wrapper });
  await waitFor(() => expect(result.current.isSuccess).toBe(true));
  expect(valueInvestmentHolding(holding, result.current.quoteLookup.TJUSD).marketValue).toBe(360);
  quotes.mockRejectedValueOnce(new Error('MARKET_DATA_STALE'));
  await act(async () => { await result.current.refetch(); });
  await waitFor(() => expect(result.current.isError).toBe(true));
  expect(valueInvestmentHolding(holding, result.current.quoteLookup.TJUSD)).toMatchObject({ valuationSource: 'manual', marketValue: 330, unrealizedPnl: -3 });
  expect(quotes).toHaveBeenCalledTimes(2);
  unmount(); client.clear();
});
