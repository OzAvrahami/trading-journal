import { Router } from 'express';
import { z } from 'zod';
import { requireAuth } from '../middleware/auth.js';
import { validateBody, validateQuery } from '../middleware/validate.js';
import * as accountService from '../services/accountService.js';

const router = Router();
router.use(requireAuth);

const ACCOUNT_STATUSES = ['active', 'inactive', 'archived'];
const ACCOUNT_TYPES    = ['funded', 'evaluation', 'demo', 'live'];
const ACCOUNT_GROUPS   = ['personal_investment', 'active_trading', 'prop_firm'];

const idSchema = z.string().uuid();
const optionalText = (max) => z.preprocess(
  value => typeof value === 'string' ? (value.trim() || null) : value,
  z.string().max(max).nullable().optional(),
);
const currencySchema = z.string().trim().toUpperCase().regex(/^[A-Z]{3}$/);
const balanceSchema = z.number().finite().min(-1_000_000_000_000_000).max(1_000_000_000_000_000);

export const listSchema = z.object({
  includeArchived: z.enum(['true', 'false']).optional().transform(value => value === 'true'),
});

export const createSchema = z.object({
  company:       z.string().trim().min(1).max(100),
  accountNumber: z.string().trim().min(1).max(100),
  accountName:   optionalText(200),
  accountType:   z.enum(ACCOUNT_TYPES).optional().nullable(),
  status:        z.enum(ACCOUNT_STATUSES).default('active'),
  baseCurrency:  currencySchema.default('USD'),
  openingBalance: balanceSchema.default(0),
  isDefault:     z.boolean().default(false),
  accountGroup: z.enum(ACCOUNT_GROUPS).default('active_trading'),
  includeInInvestmentValue: z.boolean().default(false),
  includeInNetWorth: z.boolean().default(false),
  includeInTradingAnalytics: z.boolean().default(true),
  investmentDisplayName: optionalText(120),
  linkPortfolioId: idSchema.optional(),
}).strict().superRefine((value, context) => {
  if (value.isDefault && value.status !== 'active') {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ['isDefault'], message: 'Only an active Account can be the default.' });
  }
  if (value.accountGroup === 'prop_firm' && (value.includeInInvestmentValue || value.includeInNetWorth)) {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ['accountGroup'], message: 'Prop Firm Accounts can participate only in Trading Analytics.' });
  }
  if (value.linkPortfolioId && !value.includeInInvestmentValue) {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ['includeInInvestmentValue'], message: 'Linked investment data requires investment participation.' });
  }
});

export const updateSchema = z.object({
  company:       z.string().trim().min(1).max(100).optional(),
  accountNumber: z.string().trim().min(1).max(100).optional(),
  accountName:   optionalText(200),
  accountType:   z.enum(ACCOUNT_TYPES).optional().nullable(),
  status:        z.enum(ACCOUNT_STATUSES).optional(),
  baseCurrency:  currencySchema.optional(),
  openingBalance: balanceSchema.optional(),
  isDefault:     z.boolean().optional(),
  accountGroup: z.enum(ACCOUNT_GROUPS).optional(),
  includeInInvestmentValue: z.boolean().optional(),
  includeInNetWorth: z.boolean().optional(),
  includeInTradingAnalytics: z.boolean().optional(),
  investmentDisplayName: optionalText(120),
}).strict().refine(value => Object.keys(value).length > 0, 'At least one field is required.');

export const linkPortfolioSchema = z.object({ portfolioId: idSchema }).strict();

function validateAccountId(req, res, next) {
  const parsed = idSchema.safeParse(req.params.id);
  if (!parsed.success) return res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: 'Route parameter validation failed.', details: { id: ['Expected a UUID.'] } } });
  req.params.id = parsed.data;
  next();
}

// GET /api/accounts
router.get('/', validateQuery(listSchema), async (req, res, next) => {
  try {
    res.json(await accountService.listAccounts(req.user.id, req.query));
  } catch (err) { next(err); }
});

router.get('/:id', validateAccountId, async (req, res, next) => {
  try { res.json(await accountService.getAccount(req.user.id, req.params.id)); }
  catch (err) { next(err); }
});

// POST /api/accounts
router.post('/', validateBody(createSchema), async (req, res, next) => {
  try {
    res.status(201).json(await accountService.createAccount(req.user.id, req.body));
  } catch (err) { next(err); }
});

// PATCH /api/accounts/:id
router.patch('/:id', validateAccountId, validateBody(updateSchema), async (req, res, next) => {
  try {
    res.json(await accountService.updateAccount(req.user.id, req.params.id, req.body));
  } catch (err) { next(err); }
});

router.post('/:id/link-investment-portfolio', validateAccountId, validateBody(linkPortfolioSchema), async (req, res, next) => {
  try {
    res.json(await accountService.linkInvestmentPortfolio(req.user.id, req.params.id, req.body.portfolioId));
  } catch (err) { next(err); }
});

// DELETE /api/accounts/:id
router.delete('/:id', validateAccountId, async (req, res, next) => {
  try {
    res.json(await accountService.deleteAccount(req.user.id, req.params.id));
  } catch (err) { next(err); }
});

export default router;
