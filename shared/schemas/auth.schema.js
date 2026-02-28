import { z } from 'zod';

export const signupSchema = z.object({
  email: z.string().email('Invalid email'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
  displayName: z.string().min(1).max(100).optional(),
});

export const loginSchema = z.object({
  email: z.string().email('Invalid email'),
  password: z.string().min(1, 'Password required'),
});

export const updateProfileSchema = z.object({
  displayName: z.string().min(1).max(100).optional(),
  defaultMarket: z.enum(['stocks', 'crypto', 'futures', 'forex']).optional(),
  defaultTimeframe: z.enum(['1m', '2m', '3m', '5m', '10m', '15m', '30m', '1h', '2h', '4h', '1d', '1w']).optional(),
}).strict();
