import { describe, expect, it, vi } from 'vitest';
import { invalidateTradeQueries } from './tradeQueryInvalidation.js';

describe('trade query invalidation', () => {
  it('refreshes only the real trade-dependent query families', async () => {
    const queryClient = { invalidateQueries: vi.fn().mockResolvedValue() };
    await invalidateTradeQueries(queryClient, 'trade-1');
    expect(queryClient.invalidateQueries.mock.calls.map(([value]) => value.queryKey)).toEqual([
      ['trades'], ['analytics'], ['daily-review'], ['accounts'], ['account'], ['strategies'], ['setups'], ['trade', 'trade-1'],
    ]);
    expect(queryClient.invalidateQueries).toHaveBeenCalledTimes(8);
  });
});
