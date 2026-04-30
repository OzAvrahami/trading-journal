import { z } from 'zod';
import { ACCOUNT_STATUSES, ACCOUNT_TYPES } from '../constants/enums.js';

export const createAccountSchema = z.object({
  company:       z.string().min(1).max(100),
  accountNumber: z.string().min(1).max(100),
  accountName:   z.string().max(200).optional().nullable(),
  accountType:   z.enum(ACCOUNT_TYPES).optional().nullable(),
  status:        z.enum(ACCOUNT_STATUSES).default('active'),
});

export const updateAccountSchema = z.object({
  company:       z.string().min(1).max(100).optional(),
  accountNumber: z.string().min(1).max(100).optional(),
  accountName:   z.string().max(200).optional().nullable(),
  accountType:   z.enum(ACCOUNT_TYPES).optional().nullable(),
  status:        z.enum(ACCOUNT_STATUSES).optional(),
});
