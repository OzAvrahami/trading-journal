import { Router } from 'express';
import { z } from 'zod';
import { requireAuth } from '../middleware/auth.js';
import { validateBody, validateQuery } from '../middleware/validate.js';
import * as journalService from '../services/journalService.js';

const router = Router();
router.use(requireAuth);

export const ENTRY_TYPES = ['note', 'trade_review', 'daily_review', 'weekly_review'];
export const ENTRY_STATUSES = ['all', 'complete', 'incomplete'];

export const dateKeySchema = z.string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Expected YYYY-MM-DD.')
  .refine((value) => {
    const [year, month, day] = value.split('-').map(Number);
    const parsed = new Date(Date.UTC(year, month - 1, day));
    return parsed.getUTCFullYear() === year
      && parsed.getUTCMonth() === month - 1
      && parsed.getUTCDate() === day;
  }, 'Expected a valid calendar date.');

function normalizeTags(value) {
  if (!Array.isArray(value)) return value;
  const seen = new Set();
  return value.reduce((tags, item) => {
    const tag = typeof item === 'string' ? item.trim() : item;
    if (tag === '') return tags;
    if (typeof tag !== 'string') return [...tags, tag];
    const key = tag.toLocaleLowerCase();
    if (!seen.has(key)) {
      seen.add(key);
      tags.push(tag);
    }
    return tags;
  }, []);
}

function uniqueIds(value) {
  return Array.isArray(value) ? [...new Set(value)] : value;
}

const tagsSchema = z.preprocess(normalizeTags, z.array(z.string().max(32)).max(10));
const tradeIdsSchema = z.preprocess(uniqueIds, z.array(z.string().uuid()).max(20));
const entryIdSchema = z.string().uuid();
const trimmedRequired = (maximum) => z.string().trim().min(1).max(maximum);

const entryFields = {
  entryType: z.enum(ENTRY_TYPES),
  entryDate: dateKeySchema,
  title: trimmedRequired(160),
  content: trimmedRequired(100000),
  tags: tagsSchema.default([]),
  isComplete: z.boolean().default(false),
  tradeIds: tradeIdsSchema.default([]),
};

export const createEntrySchema = z.object(entryFields).strict();
export const updateEntrySchema = z.object({
  entryType: entryFields.entryType.optional(),
  entryDate: entryFields.entryDate.optional(),
  title: entryFields.title.optional(),
  content: entryFields.content.optional(),
  tags: tagsSchema.optional(),
  isComplete: z.boolean().optional(),
  tradeIds: tradeIdsSchema.optional(),
}).strict().refine((value) => Object.keys(value).length > 0, 'At least one field is required.');

function validateDateRange(value, context) {
  if (value.from && value.to && value.from > value.to) {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ['to'], message: 'End date must not precede start date.' });
  }
}

export const listJournalSchema = z.object({
  from: dateKeySchema.optional(),
  to: dateKeySchema.optional(),
  type: z.enum(ENTRY_TYPES).optional(),
  status: z.enum(ENTRY_STATUSES).default('all'),
  search: z.string().trim().max(100).optional().transform((value) => value || undefined),
  tradeId: z.string().uuid().optional(),
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().min(1).max(100).default(25),
}).superRefine(validateDateRange);

export const calendarSchema = z.object({
  month: z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/, 'Expected YYYY-MM.'),
});

export function validateEntryId(req, res, next) {
  const parsed = entryIdSchema.safeParse(req.params.id);
  if (!parsed.success) {
    return res.status(400).json({
      error: { code: 'VALIDATION_ERROR', message: 'Route parameter validation failed.', details: { id: ['Expected a UUID.'] } },
    });
  }
  req.params.id = parsed.data;
  next();
}

router.get('/', validateQuery(listJournalSchema), async (req, res, next) => {
  try {
    res.json(await journalService.listJournalEntries(req.user.id, req.query));
  } catch (error) { next(error); }
});

router.get('/calendar', validateQuery(calendarSchema), async (req, res, next) => {
  try {
    res.json(await journalService.getJournalCalendar(req.user.id, req.query.month));
  } catch (error) { next(error); }
});

router.get('/:id', validateEntryId, async (req, res, next) => {
  try {
    res.json(await journalService.getJournalEntry(req.user.id, req.params.id));
  } catch (error) { next(error); }
});

router.post('/', validateBody(createEntrySchema), async (req, res, next) => {
  try {
    res.status(201).json(await journalService.createJournalEntry(req.user.id, req.body));
  } catch (error) { next(error); }
});

router.patch('/:id', validateEntryId, validateBody(updateEntrySchema), async (req, res, next) => {
  try {
    res.json(await journalService.updateJournalEntry(req.user.id, req.params.id, req.body));
  } catch (error) { next(error); }
});

router.delete('/:id', validateEntryId, async (req, res, next) => {
  try {
    res.json(await journalService.deleteJournalEntry(req.user.id, req.params.id));
  } catch (error) { next(error); }
});

export default router;
