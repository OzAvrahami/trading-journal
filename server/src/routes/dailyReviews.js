import { Router } from 'express';
import { z } from 'zod';
import { requireAuth } from '../middleware/auth.js';
import { validateBody } from '../middleware/validate.js';
import { getUserTimezone, isValidDateKey } from '../utils/dateTime.js';
import * as dailyReviewService from '../services/dailyReviewService.js';

const router = Router();
router.use(requireAuth);

export const dailyReviewDateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine(isValidDateKey, 'Expected a valid calendar date.');

const optionalText = z.string().max(2000, 'Use 2,000 characters or fewer.').transform((value) => value.trim() || null).optional().default(null);
const stringList = z.array(z.string().transform((value) => value.trim()).pipe(z.string().max(48)))
  .max(10)
  .transform((values) => {
    const seen = new Set();
    return values.filter((value) => {
      if (!value) return false;
      const key = value.toLocaleLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  });

export const dailyReviewPayloadSchema = z.object({
  content: z.string().transform((value) => value.trim()).pipe(z.string().min(1, 'Session notes are required.').max(10000)),
  wentWell: optionalText,
  improve: optionalText,
  nextSessionPlan: optionalText,
  emotions: stringList,
  mistakes: stringList,
  isComplete: z.boolean(),
}).strict();

function validateDateParam(req, res, next) {
  const result = dailyReviewDateSchema.safeParse(req.params.date);
  if (!result.success) {
    return res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: 'Expected a valid YYYY-MM-DD review date.' } });
  }
  req.params.date = result.data;
  next();
}

router.get('/:date', validateDateParam, async (req, res, next) => {
  try {
    const timezone = await getUserTimezone(req.user.id);
    res.json(await dailyReviewService.getDailyReview(req.user.id, req.params.date, timezone));
  }
  catch (error) { next(error); }
});

router.put('/:date', validateDateParam, validateBody(dailyReviewPayloadSchema), async (req, res, next) => {
  try {
    const timezone = await getUserTimezone(req.user.id);
    res.json(await dailyReviewService.putDailyReview(req.user.id, req.params.date, timezone, req.body));
  }
  catch (error) { next(error); }
});

export default router;
