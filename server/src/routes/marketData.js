import { Router } from 'express';
import { z } from 'zod';
import { requireAuth } from '../middleware/auth.js';
import { validateQuery } from '../middleware/validate.js';
import {
    getQuote,
    getQuotes,
    MAX_QUOTE_SYMBOLS,
} from '../services/marketDataService.js';

const router = Router();

router.use(requireAuth);

const quoteParamsSchema = z.object({
    symbol: z
        .string()
        .trim()
        .min(1)
        .max(20)
        .regex(/^[A-Z0-9.-]+$/i),
});

const stockSymbolSchema = z
    .string()
    .trim()
    .min(1)
    .max(20)
    .regex(/^[A-Z0-9.-]+$/i);

export const quotesQuerySchema = z.object({
    symbols: z
        .string()
        .trim()
        .min(1)
        .transform((value) => value.split(',').map((symbol) => symbol.trim()))
        .pipe(z.array(stockSymbolSchema).min(1).max(MAX_QUOTE_SYMBOLS)),
});

function validateQuoteParams(req, res, next) {
    const parsed = quoteParamsSchema.safeParse(req.params);

    if (!parsed.success) {
        return res.status(400).json({
            error: {
                code: 'VALIDATION_ERROR',
                message: 'Invalid stock symbol.',
            },
        });
    }

    req.params = parsed.data;
    next();
}

router.get(
    '/quote/:symbol',
    validateQuoteParams,
    async (req, res, next) => {
        try {
            const quote = await getQuote(req.params.symbol);

            res.json(quote);
        } catch (error) {
            next(error);
        }
    },
);

router.get(
    '/quotes',
    validateQuery(quotesQuerySchema),
    async (req, res, next) => {
        try {
            const quotes = await getQuotes(req.query.symbols);

            res.json({ quotes });
        } catch (error) {
            next(error);
        }
    },
);

export default router;
