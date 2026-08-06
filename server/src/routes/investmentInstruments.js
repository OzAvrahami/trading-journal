import { Router } from 'express';
import { z } from 'zod';
import { requireAuth } from '../middleware/auth.js';
import { validateBody, validateQuery } from '../middleware/validate.js';
import * as portfolioService from '../services/portfolioService.js';

const router = Router(); router.use(requireAuth);
const id = z.string().uuid();
const optionalText = (max) => z.preprocess((value) => typeof value === 'string' ? (value.trim() || null) : value, z.string().max(max).nullable().optional());
const currency = z.string().trim().toUpperCase().regex(/^[A-Z]{3}$/);
export const listInstrumentsSchema = z.object({
  assetType: z.enum(['stock', 'etf']).optional(), currency: currency.optional(),
  includeInactive: z.enum(['true', 'false']).optional().transform((value) => value === 'true'),
  search: z.string().trim().max(100).optional(),
});
export const createInstrumentSchema = z.object({
  symbol: z.string().trim().toUpperCase().regex(/^[A-Z0-9.-]{1,24}$/), name: optionalText(200),
  exchange: optionalText(40), assetType: z.enum(['stock', 'etf']), currency,
}).strict();
export const updateInstrumentSchema = z.object({
  name: optionalText(200), exchange: optionalText(40), isActive: z.boolean().optional(),
}).strict().refine((value) => Object.keys(value).length > 0, 'At least one field is required.');
function validateId(req, res, next) { const parsed=id.safeParse(req.params.instrumentId); if(!parsed.success) return res.status(400).json({error:{code:'VALIDATION_ERROR',message:'Expected an Instrument UUID.'}}); req.params.instrumentId=parsed.data; next(); }

router.get('/', validateQuery(listInstrumentsSchema), async (req,res,next) => { try { res.json(await portfolioService.listInstruments(req.user.id,req.query)); } catch(error){next(error);} });
router.post('/', validateBody(createInstrumentSchema), async (req,res,next) => { try { res.status(201).json(await portfolioService.createInstrument(req.user.id,req.body)); } catch(error){next(error);} });
router.patch('/:instrumentId', validateId, validateBody(updateInstrumentSchema), async (req,res,next) => { try { res.json(await portfolioService.updateInstrument(req.user.id,req.params.instrumentId,req.body)); } catch(error){next(error);} });
export default router;
