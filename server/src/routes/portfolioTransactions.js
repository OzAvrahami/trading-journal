import { Router } from 'express';
import { z } from 'zod';
import { requireAuth } from '../middleware/auth.js';
import { validateBody, validateQuery } from '../middleware/validate.js';
import { isValidDateKey } from '../utils/dateTime.js';
import * as portfolioService from '../services/portfolioService.js';

const router = Router(); router.use(requireAuth);
const id = z.string().uuid();
const date = z.string().refine(isValidDateKey, 'Expected a real YYYY-MM-DD date.');
const positive = z.number().finite().positive().max(1e15);
const nonnegative = z.number().finite().min(0).max(1e15);
const optionalText = z.preprocess((value) => typeof value === 'string' ? (value.trim() || null) : value, z.string().max(2000).nullable().optional());
const type = z.enum(['buy','sell','dividend','fee','deposit','withdrawal']);

function shape(schema, update = false) {
  return schema.strict().superRefine((value, context) => {
    if (update) return;
    const needsInstrument = ['buy','sell','dividend'].includes(value.transactionType);
    if (needsInstrument && !value.instrumentId) context.addIssue({ code:z.ZodIssueCode.custom,path:['instrumentId'],message:'Instrument is required.' });
    if (['deposit','withdrawal'].includes(value.transactionType) && value.instrumentId) context.addIssue({ code:z.ZodIssueCode.custom,path:['instrumentId'],message:'Instrument is not allowed.' });
    if (['buy','sell'].includes(value.transactionType)) {
      if (value.quantity == null) context.addIssue({code:z.ZodIssueCode.custom,path:['quantity'],message:'Quantity is required.'});
      if (value.price == null) context.addIssue({code:z.ZodIssueCode.custom,path:['price'],message:'Price is required.'});
      if (value.amount != null) context.addIssue({code:z.ZodIssueCode.custom,path:['amount'],message:'Amount is not allowed.'});
    } else {
      if (value.quantity != null || value.price != null) context.addIssue({code:z.ZodIssueCode.custom,path:['quantity'],message:'Quantity and price are not allowed.'});
      if (value.amount == null) context.addIssue({code:z.ZodIssueCode.custom,path:['amount'],message:'Amount is required.'});
    }
    if (['fee','deposit','withdrawal'].includes(value.transactionType) && value.fees !== 0) context.addIssue({code:z.ZodIssueCode.custom,path:['fees'],message:'Use the amount field for this Transaction type.'});
  });
}

const fields = {
  portfolioId:id, instrumentId:id.nullable().optional(), transactionType:type, transactionDate:date,
  quantity:positive.nullable().optional(), price:positive.nullable().optional(), amount:positive.nullable().optional(),
  fees:nonnegative.default(0), notes:optionalText,
};
export const createTransactionSchema = shape(z.object(fields));
export const updateTransactionSchema = z.object(Object.fromEntries(Object.entries(fields).filter(([key])=>key!=='portfolioId').map(([key,value])=>[key,value.optional()]))).strict().refine((value)=>Object.keys(value).length>0,'At least one field is required.');
export const listTransactionsSchema = z.object({
  portfolioId:id.optional(), instrumentId:id.optional(), transactionType:type.optional(), from:date.optional(), to:date.optional(),
  limit:z.coerce.number().int().min(1).max(100).default(50), offset:z.coerce.number().int().min(0).default(0),
}).refine((value)=>!value.from||!value.to||value.from<=value.to,{path:['to'],message:'End date cannot precede start date.'});
function validateId(req,res,next){const parsed=id.safeParse(req.params.transactionId);if(!parsed.success)return res.status(400).json({error:{code:'VALIDATION_ERROR',message:'Expected a Transaction UUID.'}});req.params.transactionId=parsed.data;next();}

router.get('/',validateQuery(listTransactionsSchema),async(req,res,next)=>{try{res.json(await portfolioService.listTransactions(req.user.id,req.query));}catch(error){next(error);}});
router.post('/',validateBody(createTransactionSchema),async(req,res,next)=>{try{res.status(201).json(await portfolioService.createTransaction(req.user.id,req.body));}catch(error){next(error);}});
router.patch('/:transactionId',validateId,validateBody(updateTransactionSchema),async(req,res,next)=>{try{res.json(await portfolioService.updateTransaction(req.user.id,req.params.transactionId,req.body));}catch(error){next(error);}});
router.delete('/:transactionId',validateId,async(req,res,next)=>{try{res.json(await portfolioService.deleteTransaction(req.user.id,req.params.transactionId));}catch(error){next(error);}});
export default router;
