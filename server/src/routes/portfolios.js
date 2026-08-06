import { Router } from 'express';
import { z } from 'zod';
import { requireAuth } from '../middleware/auth.js';
import { validateBody, validateQuery } from '../middleware/validate.js';
import * as portfolioService from '../services/portfolioService.js';

const router = Router();
router.use(requireAuth);

const id = z.string().uuid();
const optionalText = z.preprocess((value) => typeof value === 'string' ? (value.trim() || null) : value, z.string().max(2000).nullable().optional());
const currency = z.string().trim().toUpperCase().regex(/^[A-Z]{3}$/);
const includeArchived = z.enum(['true', 'false']).optional().transform((value) => value === 'true');

export const listPortfoliosSchema = z.object({ includeArchived });
export const createPortfolioSchema = z.object({
  name: z.string().trim().min(1).max(120), description: optionalText,
  baseCurrency: currency.default('USD'), isDefault: z.boolean().default(false),
}).strict();
export const updatePortfolioSchema = z.object({
  name: z.string().trim().min(1).max(120).optional(), description: optionalText,
  baseCurrency: currency.optional(), isDefault: z.boolean().optional(), status: z.enum(['active', 'archived']).optional(),
}).strict().refine((value) => Object.keys(value).length > 0, 'At least one field is required.');

function validateId(req, res, next) {
  const parsed = id.safeParse(req.params.portfolioId);
  if (!parsed.success) return res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: 'Expected a Portfolio UUID.' } });
  req.params.portfolioId = parsed.data; next();
}

router.get('/', validateQuery(listPortfoliosSchema), async (req, res, next) => {
  try { res.json(await portfolioService.listPortfolios(req.user.id, req.query)); } catch (error) { next(error); }
});
router.post('/', validateBody(createPortfolioSchema), async (req, res, next) => {
  try { res.status(201).json(await portfolioService.createPortfolio(req.user.id, req.body)); } catch (error) { next(error); }
});
router.get('/:portfolioId', validateId, async (req, res, next) => {
  try { res.json(await portfolioService.getPortfolio(req.user.id, req.params.portfolioId)); } catch (error) { next(error); }
});
router.patch('/:portfolioId', validateId, validateBody(updatePortfolioSchema), async (req, res, next) => {
  try { res.json(await portfolioService.updatePortfolio(req.user.id, req.params.portfolioId, req.body)); } catch (error) { next(error); }
});

export default router;
