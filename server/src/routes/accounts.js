import { Router } from 'express';
import { z } from 'zod';
import { requireAuth } from '../middleware/auth.js';
import { validateBody } from '../middleware/validate.js';
import * as accountService from '../services/accountService.js';

const router = Router();
router.use(requireAuth);

const ACCOUNT_STATUSES = ['active', 'inactive', 'archived'];
const ACCOUNT_TYPES    = ['funded', 'evaluation', 'demo', 'live'];

const createSchema = z.object({
  company:       z.string().min(1).max(100),
  accountNumber: z.string().min(1).max(100),
  accountName:   z.string().max(200).optional().nullable(),
  accountType:   z.enum(ACCOUNT_TYPES).optional().nullable(),
  status:        z.enum(ACCOUNT_STATUSES).default('active'),
});

const updateSchema = z.object({
  company:       z.string().min(1).max(100).optional(),
  accountNumber: z.string().min(1).max(100).optional(),
  accountName:   z.string().max(200).optional().nullable(),
  accountType:   z.enum(ACCOUNT_TYPES).optional().nullable(),
  status:        z.enum(ACCOUNT_STATUSES).optional(),
});

// GET /api/accounts
router.get('/', async (req, res, next) => {
  try {
    res.json(await accountService.listAccounts(req.user.id));
  } catch (err) { next(err); }
});

// POST /api/accounts
router.post('/', validateBody(createSchema), async (req, res, next) => {
  try {
    res.status(201).json(await accountService.createAccount(req.user.id, req.body));
  } catch (err) { next(err); }
});

// PATCH /api/accounts/:id
router.patch('/:id', validateBody(updateSchema), async (req, res, next) => {
  try {
    res.json(await accountService.updateAccount(req.user.id, req.params.id, req.body));
  } catch (err) { next(err); }
});

// DELETE /api/accounts/:id
router.delete('/:id', async (req, res, next) => {
  try {
    res.json(await accountService.deleteAccount(req.user.id, req.params.id));
  } catch (err) { next(err); }
});

export default router;
