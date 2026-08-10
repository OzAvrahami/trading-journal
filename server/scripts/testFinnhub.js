import 'dotenv/config';
import { getQuote } from '../src/services/marketDataService.js';

//const quote = await getQuote('AAPL');

const first = await getQuote('AAPL');
console.log(first);

const second = await getQuote('AAPL');
console.log(second);

//console.log(quote);