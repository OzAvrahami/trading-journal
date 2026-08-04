import { Router } from 'express';
import { z } from 'zod';
import { requireAuth } from '../middleware/auth.js';
import { validateBody, validateQuery } from '../middleware/validate.js';
import * as tradeService from '../services/tradeService.js';

const router = Router();
router.use(requireAuth);

// ---- Schemas ----------------------------------------------------------------

const MARKETS    = ['stocks', 'crypto', 'futures', 'forex'];
const DIRECTIONS = ['long', 'short'];
const TIMEFRAMES = ['1m', '2m', '3m', '5m', '10m', '15m', '30m', '1h', '2h', '4h', '1d', '1w'];

const emptyStringToNull = value => value === '' ? null : value;
const optionalExitDatetime = z.preprocess(
  emptyStringToNull,
  z.string().datetime({ offset: true }).optional().nullable()
);
const optionalExitPrice = z.preprocess(
  emptyStringToNull,
  z.number().positive().optional().nullable()
);

function validateCompleteExitState(data, ctx) {
  const hasExitDatetime = data.exitDatetime != null;
  const hasExitPrice = data.exitPrice != null;

  if (hasExitDatetime !== hasExitPrice) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: hasExitDatetime ? ['exitPrice'] : ['exitDatetime'],
      message: 'Exit datetime and exit price must be provided together.',
    });
    return;
  }

  if (hasExitDatetime && new Date(data.exitDatetime) < new Date(data.entryDatetime)) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['exitDatetime'],
      message: 'Exit datetime must be on or after entry datetime.',
    });
  }
}

export const createSchema = z.object({
  accountId:       z.string().uuid(),
  symbol:          z.string().min(1).max(20).transform(v => v.toUpperCase().trim()),
  market:          z.enum(MARKETS),
  direction:       z.enum(DIRECTIONS),
  entryDatetime:   z.string().datetime({ offset: true }),
  entryPrice:      z.number().positive(),
  quantity:        z.number().positive(),
  exitDatetime:    optionalExitDatetime,
  exitPrice:       optionalExitPrice,
  fees:            z.number().min(0).default(0),
  strategy:        z.string().max(100).optional().nullable(),
  setup:           z.string().max(100).optional().nullable(),
  timeframe:       z.enum(TIMEFRAMES).optional().nullable(),
  riskAmount:      z.number().positive().optional().nullable(),
  stopLoss:        z.number().positive().optional().nullable(),
  takeProfit:      z.number().positive().optional().nullable(),
  notes:           z.string().max(5000).optional().nullable(),
  emotions:        z.object({
    pre:    z.string().optional(),
    during: z.string().optional(),
    post:   z.string().optional(),
  }).optional().nullable(),
  screenshotLinks: z.array(z.string().url()).max(10).optional().nullable(),
}).superRefine(validateCompleteExitState);

export const updateSchema = z.object({
  exitDatetime:    optionalExitDatetime,
  exitPrice:       optionalExitPrice,
  quantity:        z.number().positive().optional(),
  fees:            z.number().min(0).optional(),
  strategy:        z.string().max(100).optional().nullable(),
  setup:           z.string().max(100).optional().nullable(),
  timeframe:       z.enum(TIMEFRAMES).optional().nullable(),
  riskAmount:      z.number().positive().optional().nullable(),
  stopLoss:        z.number().positive().optional().nullable(),
  takeProfit:      z.number().positive().optional().nullable(),
  notes:           z.string().max(5000).optional().nullable(),
  emotions:        z.object({
    pre:    z.string().optional(),
    during: z.string().optional(),
    post:   z.string().optional(),
  }).optional().nullable(),
  screenshotLinks: z.array(z.string().url()).max(10).optional().nullable(),
});

const filtersSchema = z.object({
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

// ---- Routes -----------------------------------------------------------------

// GET /api/trades
router.get('/', validateQuery(filtersSchema), async (req, res, next) => {
  try {
    const result = await tradeService.listTrades(req.user.id, req.query);
    res.json(result);
  } catch (err) { next(err); }
});

// GET /api/trades/export  — must come before /:id
router.get('/export', validateQuery(filtersSchema), async (req, res, next) => {
  try {
    const trades = await tradeService.exportTradesCsv(req.user.id, req.query);

    const headers = [
      'id', 'accountId', 'symbol', 'market', 'direction',
      'entryDatetime', 'exitDatetime', 'entryPrice', 'exitPrice',
      'quantity', 'fees', 'status',
      'pnlGross', 'pnlNet', 'rMultiple', 'durationMinutes',
      'strategy', 'setup', 'timeframe',
      'riskAmount', 'stopLoss', 'takeProfit', 'notes',
    ];

    const escape = (v) => {
      if (v == null) return '';
      const s = String(v);
      return s.includes(',') || s.includes('"') || s.includes('\n')
        ? `"${s.replace(/"/g, '""')}"`
        : s;
    };

    const csv = [
      headers.join(','),
      ...trades.map(t => headers.map(h => escape(t[h])).join(',')),
    ].join('\n');

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="trades-${new Date().toISOString().slice(0, 10)}.csv"`);
    res.send(csv);
  } catch (err) { next(err); }
});

// POST /api/trades
router.post('/', validateBody(createSchema), async (req, res, next) => {
  try {
    const trade = await tradeService.createTrade(req.user.id, req.body);
    res.status(201).json(trade);
  } catch (err) { next(err); }
});

// GET /api/trades/:id
router.get('/:id', async (req, res, next) => {
  try {
    const trade = await tradeService.getTrade(req.user.id, req.params.id);
    res.json(trade);
  } catch (err) { next(err); }
});

// PATCH /api/trades/:id
router.patch('/:id', validateBody(updateSchema), async (req, res, next) => {
  try {
    const trade = await tradeService.updateTrade(req.user.id, req.params.id, req.body);
    res.json(trade);
  } catch (err) { next(err); }
});

// DELETE /api/trades/:id
router.delete('/:id', async (req, res, next) => {
  try {
    const result = await tradeService.deleteTrade(req.user.id, req.params.id);
    res.json(result);
  } catch (err) { next(err); }
});

export default router;
