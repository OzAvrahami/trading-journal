export function invalidateInvestmentWorkspace(queryClient, { transaction = false, price = false, participation = false } = {}) {
  queryClient.invalidateQueries({ queryKey: ['investments'] });
  queryClient.invalidateQueries({ queryKey: ['portfolios'] });
  queryClient.invalidateQueries({ queryKey: ['portfolio'] });
  queryClient.invalidateQueries({ queryKey: ['accounts'] });
  if (transaction) queryClient.invalidateQueries({ queryKey: ['portfolio-transactions'] });
  if (price) queryClient.invalidateQueries({ queryKey: ['investment-prices'] });
  if (participation) queryClient.invalidateQueries({ queryKey: ['preferences'] });
}
