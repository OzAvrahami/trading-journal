import { z } from 'zod';
import { MARKETS, DIRECTIONS, TIMEFRAMES } from '../constants/enums.js';

const emotionsSchema = z.object({
  pre: z.string().optional(),
  during: z.string().optional(),
  post: z.string().optional(),
}).optional().nullable();

export const createTradeSchema = z.object({
  // Required
  accountId: z.string().uuid(),
  symbol: z.string().min(1).max(20).transform(v => v.toUpperCase().trim()),
  market: z.enum(MARKETS),
  direction: z.enum(DIRECTIONS),
  entryDatetime: z.string().datetime({ offset: true }),
  entryPrice: z.number().positive(),
  quantity: z.number().positive(),

  // Optional close fields
  exitDatetime: z.string().datetime({ offset: true }).optional().nullable(),
  exitPrice: z.number().positive().optional().nullable(),

  // Trading context
  fees: z.number().min(0).default(0),
  strategy: z.string().max(100).optional().nullable(),
  setup: z.string().max(100).optional().nullable(),
  timeframe: z.enum(TIMEFRAMES).optional().nullable(),
  riskAmount: z.number().positive().optional().nullable(),
  stopLoss: z.number().positive().optional().nullable(),
  takeProfit: z.number().positive().optional().nullable(),

  // Notes and media
  notes: z.string().max(5000).optional().nullable(),
  emotions: emotionsSchema,
  screenshotLinks: z.array(z.string().url()).max(10).optional().nullable(),
}).refine(
  data => {
    // Both must be set, or neither
    if (data.exitDatetime && !data.exitPrice) return false;
    if (data.exitPrice && !data.exitDatetime) return false;
    return true;
  },
  { message: 'exitDatetime and exitPrice must both be provided when closing a trade' }
);

export const updateTradeSchema = z.object({
  exitDatetime: z.string().datetime({ offset: true }).optional().nullable(),
  exitPrice: z.number().positive().optional().nullable(),
  fees: z.number().min(0).optional(),
  strategy: z.string().max(100).optional().nullable(),
  setup: z.string().max(100).optional().nullable(),
  timeframe: z.enum(TIMEFRAMES).optional().nullable(),
  riskAmount: z.number().positive().optional().nullable(),
  stopLoss: z.number().positive().optional().nullable(),
  takeProfit: z.number().positive().optional().nullable(),
  notes: z.string().max(5000).optional().nullable(),
  emotions: emotionsSchema,
  screenshotLinks: z.array(z.string().url()).max(10).optional().nullable(),
});

export const tradeFiltersSchema = z.object({
  from:      z.string().optional(),
  to:        z.string().optional(),
  symbol:    z.string().optional(),
  market:    z.enum(MARKETS).optional(),
  direction: z.enum(DIRECTIONS).optional(),
  status:    z.enum(['open', 'closed']).optional(),
  strategy:  z.string().optional(),
  timeframe: z.enum(TIMEFRAMES).optional(),
  outcome:   z.enum(['win', 'loss']).optional(),
  accountId: z.string().uuid().optional(),
  page:      z.coerce.number().int().positive().default(1),
  limit:     z.coerce.number().int().min(1).max(200).default(50),
  sort:      z.enum(['entry_datetime', 'pnl_net', 'symbol', 'created_at']).default('entry_datetime'),
  order:     z.enum(['asc', 'desc']).default('desc'),
});
