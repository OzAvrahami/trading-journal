import { Router } from 'express';
import { z } from 'zod';
import { requireAuth } from '../middleware/auth.js';
import { validateBody, validateQuery } from '../middleware/validate.js';
import { isValidDateKey } from '../utils/dateTime.js';
import * as portfolioService from '../services/portfolioService.js';

const router=Router(); router.use(requireAuth);
const id=z.string().uuid(); const date=z.string().refine(isValidDateKey,'Expected a real YYYY-MM-DD date.');
const currency=z.string().trim().toUpperCase().regex(/^[A-Z]{3}$/);
export const listPricesSchema=z.object({instrumentId:id.optional()});
export const priceSchema=z.object({price:z.number().finite().positive().max(1e15),currency}).strict();
function validateParams(req,res,next){const parsed=z.object({instrumentId:id,date}).safeParse(req.params);if(!parsed.success)return res.status(400).json({error:{code:'VALIDATION_ERROR',message:'Invalid Instrument or price date.'}});req.params=parsed.data;next();}
router.get('/',validateQuery(listPricesSchema),async(req,res,next)=>{try{res.json(await portfolioService.listPrices(req.user.id,req.query));}catch(error){next(error);}});
router.put('/:instrumentId/:date',validateParams,validateBody(priceSchema),async(req,res,next)=>{try{res.json(await portfolioService.upsertPrice(req.user.id,req.params.instrumentId,req.params.date,req.body));}catch(error){next(error);}});
router.delete('/:instrumentId/:date',validateParams,async(req,res,next)=>{try{res.json(await portfolioService.deletePrice(req.user.id,req.params.instrumentId,req.params.date));}catch(error){next(error);}});
export default router;
