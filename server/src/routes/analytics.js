import { Router } from 'express';
import { z } from 'zod';
import { requireAuth } from '../middleware/auth.js';
import { validateQuery } from '../middleware/validate.js';
import * as analyticsService from '../services/analyticsService.js';
import { getUserTimezone } from '../utils/dateTime.js';

const router = Router();
router.use(requireAuth);

const dateKeySchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Expected YYYY-MM-DD.').refine((value) => {
  const [year, month, day] = value.split('-').map(Number);
  const parsed = new Date(Date.UTC(year, month - 1, day));
  return parsed.getUTCFullYear() === year && parsed.getUTCMonth() === month - 1 && parsed.getUTCDate() === day;
}, 'Expected a valid calendar date.');

const baseFields = {
  from:      dateKeySchema.optional(),
  to:        dateKeySchema.optional(),
  accountId: z.string().uuid().optional(),
  company:   z.string().trim().min(1).max(100).optional(),
};

function validateDateRange(value, context) {
  if (value.from && value.to && value.from > value.to) {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ['to'], message: 'End date must not precede start date.' });
  }
}

export const baseSchema = z.object(baseFields).superRefine(validateDateRange);
export const daySummarySchema = z.object({ date: dateKeySchema });

router.get('/day-summary', validateQuery(daySummarySchema), async (req, res, next) => {
  try {
    const timezone = await getUserTimezone(req.user.id);
    res.json(await analyticsService.getDaySummary(req.user.id, req.query.date, timezone));
  } catch (err) { next(err); }
});

export const breakdownSchema = z.object({
  ...baseFields,
  by: z.enum(['symbol', 'strategy', 'timeframe', 'direction', 'account', 'company', 'market', 'weekday']).default('strategy'),
}).superRefine(validateDateRange);

// GET /api/analytics/summary
router.get('/summary', validateQuery(baseSchema), async (req, res, next) => {
  try {
    const timezone = await getUserTimezone(req.user.id);
    const data = await analyticsService.getSummary(req.user.id, req.query, timezone);
    res.json(data);
  } catch (err) { next(err); }
});

// GET /api/analytics/equity-curve
router.get('/equity-curve', validateQuery(baseSchema), async (req, res, next) => {
  try {
    const timezone = await getUserTimezone(req.user.id);
    const data = await analyticsService.getEquityCurve(req.user.id, req.query, timezone);
    res.json(data);
  } catch (err) { next(err); }
});

// GET /api/analytics/calendar
router.get('/calendar', validateQuery(baseSchema), async (req, res, next) => {
  try {
    const timezone = await getUserTimezone(req.user.id);
    const data = await analyticsService.getCalendar(req.user.id, req.query, timezone);
    res.json(data);
  } catch (err) { next(err); }
});

// GET /api/analytics/distribution
router.get('/distribution', validateQuery(baseSchema), async (req, res, next) => {
  try {
    const timezone = await getUserTimezone(req.user.id);
    const data = await analyticsService.getDistribution(req.user.id, req.query, timezone);
    res.json(data);
  } catch (err) { next(err); }
});

// GET /api/analytics/r-distribution
router.get('/r-distribution', validateQuery(baseSchema), async (req, res, next) => {
  try {
    const timezone = await getUserTimezone(req.user.id);
    const data = await analyticsService.getRDistribution(req.user.id, req.query, timezone);
    res.json(data);
  } catch (err) { next(err); }
});

// GET /api/analytics/breakdown?by=<supported dimension>
router.get('/breakdown', validateQuery(breakdownSchema), async (req, res, next) => {
  try {
    const timezone = await getUserTimezone(req.user.id);
    const data = await analyticsService.getBreakdown(req.user.id, req.query, timezone);
    res.json(data);
  } catch (err) { next(err); }
});

export default router;
