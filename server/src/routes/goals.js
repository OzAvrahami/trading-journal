import { Router } from 'express';
import { z } from 'zod';
import { requireAuth } from '../middleware/auth.js';
import { validateBody, validateQuery } from '../middleware/validate.js';
import * as goalsService from '../services/goalsService.js';
import { getUserTimezone } from '../utils/dateTime.js';

const router = Router();
router.use(requireAuth);

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
export const goalIdSchema = z.string().uuid();
const uuid = goalIdSchema;
const metric = z.enum(goalsService.GOAL_METRICS);
const comparison = z.enum(goalsService.GOAL_COMPARISONS);
const status = z.enum(goalsService.GOAL_STATUSES);
const targetValue = z.number().finite().min(-1000000000).max(1000000000);

function validateDefinition(value, context) {
  if (value.startDate && value.endDate && value.startDate > value.endDate) {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ['endDate'], message: 'End date must not precede start date.' });
  }
  if (value.metricKey && value.comparison && value.targetValue !== undefined) {
    const issue = goalsService.validateGoalDefinition(value);
    if (issue) context.addIssue({ code: z.ZodIssueCode.custom, path: [issue.field], message: issue.message });
  } else if (value.metricKey && value.comparison) {
    const expected = goalsService.METRIC_CONFIG[value.metricKey].comparison;
    if (value.comparison !== expected) {
      context.addIssue({ code: z.ZodIssueCode.custom, path: ['comparison'], message: `${value.metricKey} must use ${expected}.` });
    }
  }
}

const goalFields = {
  name: z.string().trim().min(1).max(120),
  description: nullableTrimmed(1000),
  metricKey: metric,
  comparison,
  targetValue,
  startDate: dateKeySchema,
  endDate: dateKeySchema,
  status: status.default('active'),
};

export const createGoalSchema = z.object(goalFields).strict().superRefine(validateDefinition);
export const updateGoalSchema = z.object({
  name: goalFields.name.optional(),
  description: goalFields.description,
  metricKey: metric.optional(),
  comparison: comparison.optional(),
  targetValue: targetValue.optional(),
  startDate: dateKeySchema.optional(),
  endDate: dateKeySchema.optional(),
  status: status.optional(),
}).strict()
  .refine((value) => Object.keys(value).length > 0, 'At least one field is required.')
  .superRefine(validateDefinition);

export const listGoalsSchema = z.object({
  status: z.enum(['all', ...goalsService.GOAL_STATUSES]).default('all'),
  metric: metric.optional(),
  search: z.string().trim().max(100).optional().transform((value) => value || undefined),
});

function validateIdParam(req, res, next) {
  const result = uuid.safeParse(req.params.id);
  if (!result.success) {
    return res.status(400).json({
      error: { code: 'VALIDATION_ERROR', message: 'Route parameter validation failed.', details: { id: ['Expected a UUID.'] } },
    });
  }
  req.params.id = result.data;
  next();
}

router.get('/', validateQuery(listGoalsSchema), async (req, res, next) => {
  try {
    const timezone = await getUserTimezone(req.user.id);
    res.json(await goalsService.listGoals(req.user.id, req.query, timezone));
  } catch (error) { next(error); }
});

router.get('/:id', validateIdParam, async (req, res, next) => {
  try {
    const timezone = await getUserTimezone(req.user.id);
    res.json(await goalsService.getGoal(req.user.id, req.params.id, timezone));
  } catch (error) { next(error); }
});

router.post('/', validateBody(createGoalSchema), async (req, res, next) => {
  try {
    const timezone = await getUserTimezone(req.user.id);
    res.status(201).json(await goalsService.createGoal(req.user.id, req.body, timezone));
  } catch (error) { next(error); }
});

router.patch('/:id', validateIdParam, validateBody(updateGoalSchema), async (req, res, next) => {
  try {
    const timezone = await getUserTimezone(req.user.id);
    res.json(await goalsService.updateGoal(req.user.id, req.params.id, req.body, timezone));
  } catch (error) { next(error); }
});

router.delete('/:id', validateIdParam, async (req, res, next) => {
  try { res.json(await goalsService.deleteGoal(req.user.id, req.params.id)); } catch (error) { next(error); }
});

export default router;
