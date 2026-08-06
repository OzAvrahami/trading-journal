import { Router } from 'express';
import { z } from 'zod';
import { requireAuth } from '../middleware/auth.js';
import { validateBody } from '../middleware/validate.js';
import { isValidTimezone, normalizeTimezone } from '../utils/dateTime.js';
import { getPreferences, updatePreferences } from '../services/preferencesService.js';

const router = Router();
router.use(requireAuth);

export const updatePreferencesSchema = z.object({
  locale: z.enum(['en', 'he']).optional(),
  theme: z.enum(['system', 'light', 'dark']).optional(),
  tradeFormMode: z.enum(['simple', 'advanced']).optional(),
  timezone: z.string().transform(normalizeTimezone).refine(isValidTimezone, 'Expected a valid IANA timezone.').optional(),
}).strict().refine(value => Object.keys(value).length > 0, 'At least one preference is required.');

router.get('/', async (req, res, next) => {
  try { res.json(await getPreferences(req.user.id)); }
  catch (error) { next(error); }
});

router.patch('/', validateBody(updatePreferencesSchema), async (req, res, next) => {
  try { res.json(await updatePreferences(req.user.id, req.body)); }
  catch (error) { next(error); }
});

export default router;
