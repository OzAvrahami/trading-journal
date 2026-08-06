import { Router } from 'express';
import { z } from 'zod';
import { requireAuth } from '../middleware/auth.js';
import { validateQuery } from '../middleware/validate.js';
import { isValidDateKey } from '../utils/dateTime.js';
import * as service from '../services/investmentWorkspaceService.js';

const router = Router();
router.use(requireAuth);

const id = z.string().uuid();
const date = z.string().refine(isValidDateKey, 'Expected a real YYYY-MM-DD date.');
const scope = { accountId: id.optional() };
export const scopeSchema = z.object(scope).strict();
export const holdingsSchema = z.object({
  ...scope,
  search: z.string().trim().max(100).optional(),
  assetType: z.enum(['stock', 'etf']).optional(),
  priceAvailability: z.enum(['available', 'missing']).optional(),
}).strict();
export const transactionsSchema = z.object({
  ...scope,
  instrumentId: id.optional(),
  transactionType: z.enum(['buy', 'sell', 'dividend', 'fee', 'deposit', 'withdrawal']).optional(),
  from: date.optional(),
  to: date.optional(),
  search: z.string().trim().max(100).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(50),
  offset: z.coerce.number().int().min(0).default(0),
}).strict().refine((value) => !value.from || !value.to || value.from <= value.to, { path: ['to'], message: 'End date cannot precede start date.' });
export const dateRangeSchema = z.object({ ...scope, from: date.optional(), to: date.optional() }).strict()
  .refine((value) => !value.from || !value.to || value.from <= value.to, { path: ['to'], message: 'End date cannot precede start date.' });

const endpoint = (handler) => async (req, res, next) => {
  try { res.json(await handler(req.user.id, req.query)); } catch (error) { next(error); }
};

router.get('/scope', validateQuery(scopeSchema), endpoint((userId, query) => service.getScope(userId, query.accountId)));
router.get('/overview', validateQuery(scopeSchema), endpoint(service.getOverview));
router.get('/holdings', validateQuery(holdingsSchema), endpoint(service.getHoldings));
router.get('/transactions', validateQuery(transactionsSchema), endpoint(service.getTransactions));
router.get('/dividends', validateQuery(dateRangeSchema), endpoint(service.getDividends));
router.get('/performance', validateQuery(dateRangeSchema), endpoint(service.getPerformance));
router.get('/allocation', validateQuery(scopeSchema), endpoint(service.getAllocation));

export default router;
