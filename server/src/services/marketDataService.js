import { createError } from "../middleware/errorHandler.js";

const quoteCache = new Map();

const QUOTE_CACHE_TTL_MS = 30_000;
export const MAX_QUOTE_SYMBOLS = 25;

const SYMBOL_PATTERN = /^[A-Z0-9.-]+$/;

export function clearQuoteCache() {
  quoteCache.clear();
}

function getCachedQuote(symbol) {
    const cached = quoteCache.get(symbol);

    if (!cached) {
        return null;
    }

    const age = Date.now() - cached.cachedAt;

    if (age >= QUOTE_CACHE_TTL_MS) {
        quoteCache.delete(symbol);
        return null;
    }

    return cached.quote;
}

function cacheQuote(symbol, quote) {
    quoteCache.set(symbol, {
        quote,
        cachedAt: Date.now(),
    });
}

function normalizeSymbol(symbol) {
    if (typeof symbol !== 'string' || !symbol.trim()) {
        throw createError('INVALID_SYMBOL', 'Stock symbol is required.', 400);
    }

    const normalizedSymbol = symbol.trim().toUpperCase();

    if (normalizedSymbol.length > 20 || !SYMBOL_PATTERN.test(normalizedSymbol)) {
        throw createError('INVALID_SYMBOL', `Invalid stock symbol: ${normalizedSymbol}.`, 400);
    }

    return normalizedSymbol;
}

export function mapFinnhubQuote(symbol, quote) {
    return {
        symbol,
        price: quote.c,
        change: quote.d,
        changePercent: quote.dp,
        dayHigh: quote.h,
        dayLow: quote.l,
        open: quote.o,
        previousClose: quote.pc,
        asOf: quote.t ? new Date(quote.t * 1000).toISOString() : null,
    };
}

export async function getQuote(symbol) {
    const normalizedSymbol = normalizeSymbol(symbol);
    const cachedQuote = getCachedQuote(normalizedSymbol);

    if (cachedQuote) {
        return cachedQuote;
    }

    const apiKey = process.env.FINNHUB_API_KEY;
    
    if (!apiKey) {
        throw createError(
            'MARKET_DATA_NOT_CONFIGURED',
            'Market data provider is not configured.',
            500,
        );
    }

    const url = new URL('https://finnhub.io/api/v1/quote');
    url.searchParams.set('symbol', normalizedSymbol);

    let response;

    try {
        response = await fetch(url, {
            headers: {
                'X-Finnhub-Token': apiKey,
            },
        });
    } catch {
        throw createError(
            'MARKET_DATA_UNAVAILABLE',
            'Market data provider is currently unavailable.',
            503,
        );
    }

    if (!response.ok) {
        throw createError(
            'MARKET_DATA_PROVIDER_ERROR',
            `Market data provider returned HTTP ${response.status}.`,
            502,
        );
    }

    const quote = await response.json();

    if (!quote.t) {
        throw createError(
            'QUOTE_NOT_FOUND',
            `No market quote was found for ${normalizedSymbol}.`,
            404,
        );
    }

    const normalizedQuote = mapFinnhubQuote(
        normalizedSymbol,
        quote,
    );

    cacheQuote(normalizedSymbol, normalizedQuote);

    return normalizedQuote;
}

export async function getQuotes(symbols) {
    if (!Array.isArray(symbols) || symbols.length === 0) {
        throw createError(
            'INVALID_SYMBOLS',
            'At least one stock symbol is required.',
            400,
        );
    }

    if (symbols.length > MAX_QUOTE_SYMBOLS) {
        throw createError(
            'TOO_MANY_SYMBOLS',
            `A maximum of ${MAX_QUOTE_SYMBOLS} stock symbols is allowed.`,
            400,
        );
    }

    const normalizedSymbols = symbols.map(normalizeSymbol);
    const uniqueSymbols = [...new Set(normalizedSymbols)];

    return Promise.all(uniqueSymbols.map(getQuote));
}
