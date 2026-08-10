import api from './client.js';

export const MARKET_DATA_BATCH_SIZE = 25;

export const marketDataApi = {
  quotes: (symbols) => api
    .get('/api/market-data/quotes', {
      params: { symbols: symbols.join(',') },
    })
    .then((response) => response.data),
};
