import { Router } from 'express';
import { z } from 'zod';
import { requireAuth } from '../middleware/auth.js';
import { validateBody, validateQuery } from '../middleware/validate.js';
import * as rulesService from '../services/rulesService.js';

const router = Router();
router.use(requireAuth);

export const RULE_SCOPES = ['trade', 'daily', 'general'];
export const RULE_OUTCOMES = ['followed', 'broken', 'not_applicable'];
export const RULE_STATUSES = ['all', 'active', 'inactive'];

export const dateKeySchema = z.string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Expected YYYY-MM-DD.')
  .refine((value) => {
    const [year, month, day] = value.split('-').map(Number);
    const parsed = new Date(Date.UTC(year, month - 1, day));
    return parsed.getUTCFullYear() === year
      && parsed.getUTCMonth() === month - 1
      && parsed.getUTCDate() === day;
  }, 'Expected a valid calendar date.');

const nullableTrimmed = (maximum) => z.preprocess(
  (value) => typeof value === 'string' ? (value.trim() || null) : value,
  z.string().max(maximum).nullable().optional(),
);
const uuid = z.string().uuid();
const optionalUuid = z.preprocess((value) => value === '' ? null : value, uuid.nullable().optional());

const ruleFields = {
  name: z.string().trim().min(1).max(120),
  description: nullableTrimmed(1000),
  scope: z.enum(RULE_SCOPES),
  isActive: z.boolean().default(true),
  sortOrder: z.number().int().min(0).max(100000).optional(),
};

export const createRuleSchema = z.object(ruleFields).strict();
export const updateRuleSchema = z.object({
  name: ruleFields.name.optional(),
  description: ruleFields.description,
  scope: ruleFields.scope.optional(),
  isActive: z.boolean().optional(),
  sortOrder: ruleFields.sortOrder,
}).strict().refine((value) => Object.keys(value).length > 0, 'At least one field is required.');

function validateDateRange(value, context) {
  if (value.from && value.to && value.from > value.to) {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ['to'], message: 'End date must not precede start date.' });
  }
}

export const listRulesSchema = z.object({
  status: z.enum(RULE_STATUSES).default('active'),
  scope: z.enum(RULE_SCOPES).optional(),
  search: z.string().trim().max(100).optional().transform((value) => value || undefined),
});

export const adherenceSchema = z.object({
  from: dateKeySchema.optional(),
  to: dateKeySchema.optional(),
  scope: z.enum(RULE_SCOPES).optional(),
  ruleId: uuid.optional(),
}).superRefine(validateDateRange);

const checkFields = {
  ruleId: uuid,
  checkDate: dateKeySchema,
  outcome: z.enum(RULE_OUTCOMES),
  notes: nullableTrimmed(5000),
  tradeId: optionalUuid,
  journalEntryId: optionalUuid,
};

export const createCheckSchema = z.object(checkFields).strict();
export const updateCheckSchema = z.object({
  ruleId: checkFields.ruleId.optional(),
  checkDate: checkFields.checkDate.optional(),
  outcome: checkFields.outcome.optional(),
  notes: checkFields.notes,
  tradeId: checkFields.tradeId,
  journalEntryId: checkFields.journalEntryId,
}).strict().refine((value) => Object.keys(value).length > 0, 'At least one field is required.');

export const listChecksSchema = z.object({
  from: dateKeySchema.optional(),
  to: dateKeySchema.optional(),
  ruleId: uuid.optional(),
  outcome: z.enum(RULE_OUTCOMES).optional(),
  tradeId: uuid.optional(),
  journalEntryId: uuid.optional(),
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().min(1).max(100).default(25),
}).superRefine(validateDateRange);

function validateIdParam(name) {
  return (req, res, next) => {
    const result = uuid.safeParse(req.params[name]);
    if (!result.success) {
      return res.status(400).json({
        error: { code: 'VALIDATION_ERROR', message: 'Route parameter validation failed.', details: { [name]: ['Expected a UUID.'] } },
      });
    }
    req.params[name] = result.data;
    next();
  };
}

router.get('/', validateQuery(listRulesSchema), async (req, res, next) => {
  try { res.json(await rulesService.listRules(req.user.id, req.query)); } catch (error) { next(error); }
});

router.get('/adherence', validateQuery(adherenceSchema), async (req, res, next) => {
  try { res.json(await rulesService.getAdherence(req.user.id, req.query)); } catch (error) { next(error); }
});

router.get('/checks', validateQuery(listChecksSchema), async (req, res, next) => {
  try { res.json(await rulesService.listRuleChecks(req.user.id, req.query)); } catch (error) { next(error); }
});

router.post('/checks', validateBody(createCheckSchema), async (req, res, next) => {
  try { res.status(201).json(await rulesService.createRuleCheck(req.user.id, req.body)); } catch (error) { next(error); }
});

router.patch('/checks/:id', validateIdParam('id'), validateBody(updateCheckSchema), async (req, res, next) => {
  try { res.json(await rulesService.updateRuleCheck(req.user.id, req.params.id, req.body)); } catch (error) { next(error); }
});

router.delete('/checks/:id', validateIdParam('id'), async (req, res, next) => {
  try { res.json(await rulesService.deleteRuleCheck(req.user.id, req.params.id)); } catch (error) { next(error); }
});

router.get('/:id', validateIdParam('id'), async (req, res, next) => {
  try { res.json(await rulesService.getRule(req.user.id, req.params.id)); } catch (error) { next(error); }
});

router.post('/', validateBody(createRuleSchema), async (req, res, next) => {
  try { res.status(201).json(await rulesService.createRule(req.user.id, req.body)); } catch (error) { next(error); }
});

router.patch('/:id', validateIdParam('id'), validateBody(updateRuleSchema), async (req, res, next) => {
  try { res.json(await rulesService.updateRule(req.user.id, req.params.id, req.body)); } catch (error) { next(error); }
});

router.delete('/:id', validateIdParam('id'), async (req, res, next) => {
  try { res.json(await rulesService.deleteRule(req.user.id, req.params.id)); } catch (error) { next(error); }
});

export default router;
