import { beforeEach, describe, expect, it, vi } from 'vitest';

const client = vi.hoisted(() => ({ get: vi.fn() }));
vi.mock('./client.js', () => ({ default: client }));

import { marketDataApi } from './marketData.js';

describe('marketDataApi', () => {
  beforeEach(() => {
    client.get.mockReset();
    client.get.mockResolvedValue({ data: { quotes: [] } });
  });

  it('requests one authenticated-client batch with comma-separated symbols', async () => {
    await marketDataApi.quotes(['AAPL', 'MSFT', 'NVDA']);

    expect(client.get).toHaveBeenCalledOnce();
    expect(client.get).toHaveBeenCalledWith('/api/market-data/quotes', {
      params: { symbols: 'AAPL,MSFT,NVDA' },
    });
  });
});
