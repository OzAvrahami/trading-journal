export function invalidateTradeQueries(queryClient, tradeId) {
  const operations = [
    queryClient.invalidateQueries({ queryKey: ['trades'] }),
    queryClient.invalidateQueries({ queryKey: ['analytics'] }),
    queryClient.invalidateQueries({ queryKey: ['daily-review'] }),
    queryClient.invalidateQueries({ queryKey: ['accounts'] }),
  ];
  if (tradeId) operations.push(queryClient.invalidateQueries({ queryKey: ['trade', tradeId] }));
  return Promise.all(operations);
}
