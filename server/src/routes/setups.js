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
const idSchema = z.string().uuid();
const includeArchived = z.enum(['true', 'false']).optional().transform((value) => value === 'true');

export const listSetupsSchema = z.object({
  strategyId: idSchema.optional(),
  includeArchived,
});
export const createSetupSchema = z.object({
  strategyId: idSchema,
  name: z.string().trim().min(1).max(100),
  description: optionalDescription,
}).strict();
export const updateSetupSchema = z.object({
  name: z.string().trim().min(1).max(100).optional(),
  description: optionalDescription,
  isActive: z.boolean().optional(),
}).strict().refine((value) => Object.keys(value).length > 0, 'At least one field is required.');

function validateSetupId(req, res, next) {
  const parsed = idSchema.safeParse(req.params.setupId);
  if (!parsed.success) {
    return res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: 'Route parameter validation failed.', details: { setupId: ['Expected a UUID.'] } } });
  }
  req.params.setupId = parsed.data;
  next();
}

router.get('/', validateQuery(listSetupsSchema), async (req, res, next) => {
  try { res.json(await strategiesService.listSetups(req.user.id, req.query)); } catch (error) { next(error); }
});

router.post('/', validateBody(createSetupSchema), async (req, res, next) => {
  try { res.status(201).json(await strategiesService.createSetup(req.user.id, req.body)); } catch (error) { next(error); }
});

router.patch('/:setupId', validateSetupId, validateBody(updateSetupSchema), async (req, res, next) => {
  try { res.json(await strategiesService.updateSetup(req.user.id, req.params.setupId, req.body)); } catch (error) { next(error); }
});

export default router;
