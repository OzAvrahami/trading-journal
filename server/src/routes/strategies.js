import { Router } from 'express';
import { z } from 'zod';
import { requireAuth } from '../middleware/auth.js';
import { validateBody, validateQuery } from '../middleware/validate.js';
import * as strategiesService from '../services/strategiesService.js';

const router = Router();
router.use(requireAuth);

const optionalDescription = z.preprocess(
  (value) => typeof value === 'string' ? (value.trim() || null) : value,
  z.string().max(2000).nullable().optional(),
);
const includeArchived = z.enum(['true', 'false']).optional().transform((value) => value === 'true');
const idSchema = z.string().uuid();

export const listStrategiesSchema = z.object({ includeArchived });
export const createStrategySchema = z.object({
  name: z.string().trim().min(1).max(100),
  description: optionalDescription,
}).strict();
export const updateStrategySchema = z.object({
  name: z.string().trim().min(1).max(100).optional(),
  description: optionalDescription,
  isActive: z.boolean().optional(),
}).strict().refine((value) => Object.keys(value).length > 0, 'At least one field is required.');

function validateStrategyId(req, res, next) {
  const parsed = idSchema.safeParse(req.params.strategyId);
  if (!parsed.success) {
    return res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: 'Route parameter validation failed.', details: { strategyId: ['Expected a UUID.'] } } });
  }
  req.params.strategyId = parsed.data;
  next();
}

router.get('/legacy-values', async (req, res, next) => {
  try { res.json(await strategiesService.listLegacyClassifications(req.user.id)); } catch (error) { next(error); }
});

router.get('/', validateQuery(listStrategiesSchema), async (req, res, next) => {
  try { res.json(await strategiesService.listStrategies(req.user.id, req.query)); } catch (error) { next(error); }
});

router.post('/', validateBody(createStrategySchema), async (req, res, next) => {
  try { res.status(201).json(await strategiesService.createStrategy(req.user.id, req.body)); } catch (error) { next(error); }
});

router.patch('/:strategyId', validateStrategyId, validateBody(updateStrategySchema), async (req, res, next) => {
  try { res.json(await strategiesService.updateStrategy(req.user.id, req.params.strategyId, req.body)); } catch (error) { next(error); }
});

export default router;
