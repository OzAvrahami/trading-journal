import { Router } from 'express';
import { z } from 'zod';
import { requireAuth } from '../middleware/auth.js';
import { validateQuery } from '../middleware/validate.js';
import * as analyticsService from '../services/analyticsService.js';

const router = Router();
router.use(requireAuth);

const dateRangeSchema = z.object({
  from: z.string().optional(),
  to:   z.string().optional(),
});

const breakdownSchema = dateRangeSchema.extend({
  by: z.enum(['symbol', 'strategy', 'timeframe', 'direction']).default('strategy'),
});

// GET /api/analytics/summary
router.get('/summary', validateQuery(dateRangeSchema), async (req, res, next) => {
  try {
    const data = await analyticsService.getSummary(req.user.id, req.query);
    res.json(data);
  } catch (err) { next(err); }
});

// GET /api/analytics/equity-curve
router.get('/equity-curve', validateQuery(dateRangeSchema), async (req, res, next) => {
  try {
    const data = await analyticsService.getEquityCurve(req.user.id, req.query);
    res.json(data);
  } catch (err) { next(err); }
});

// GET /api/analytics/distribution
router.get('/distribution', validateQuery(dateRangeSchema), async (req, res, next) => {
  try {
    const data = await analyticsService.getDistribution(req.user.id, req.query);
    res.json(data);
  } catch (err) { next(err); }
});

// GET /api/analytics/breakdown?by=symbol|strategy|timeframe|direction
router.get('/breakdown', validateQuery(breakdownSchema), async (req, res, next) => {
  try {
    const data = await analyticsService.getBreakdown(req.user.id, req.query);
    res.json(data);
  } catch (err) { next(err); }
});

export default router;
