import { Router } from 'express';
import { z } from 'zod';
import { requireAuth } from '../middleware/auth.js';
import { validateBody } from '../middleware/validate.js';
import { createError } from '../middleware/errorHandler.js';
import pool from '../db/client.js';
import { DEFAULT_TIMEZONE, isValidTimezone, normalizeTimezone } from '../utils/dateTime.js';

const router = Router();
router.use(requireAuth);

export const updateProfileSchema = z.object({
  displayName: z.string().min(1).max(100).optional(),
  defaultMarket: z.enum(['stocks', 'crypto', 'futures', 'forex']).optional(),
  defaultTimeframe: z.enum(['1m', '2m', '3m', '5m', '10m', '15m', '30m', '1h', '2h', '4h', '1d', '1w']).optional(),
  timezone: z.string().transform(normalizeTimezone).refine(isValidTimezone, 'Expected a valid IANA timezone.').optional(),
}).strict();

export function formatProfile(user, { includeCreatedAt = false } = {}) {
  return {
    id: user.id,
    email: user.email,
    displayName: user.display_name,
    timezone: isValidTimezone(user.timezone) ? user.timezone : DEFAULT_TIMEZONE,
    defaults: {
      market: user.default_market,
      timeframe: user.default_timeframe,
    },
    ...(includeCreatedAt ? { createdAt: user.created_at } : {}),
  };
}

// GET /api/me
router.get('/', async (req, res, next) => {
  try {
    const result = await pool.query('SELECT * FROM users WHERE id = $1', [req.user.id]);
    const user = result.rows[0];
    if (!user) throw createError('USER_NOT_FOUND', 'User not found.', 404);

    res.json(formatProfile(user, { includeCreatedAt: true }));
  } catch (err) {
    next(err);
  }
});

// PATCH /api/me
router.patch('/', validateBody(updateProfileSchema), async (req, res, next) => {
  try {
    const { displayName, defaultMarket, defaultTimeframe, timezone } = req.body;
    const result = await pool.query(
      `UPDATE users SET
        display_name      = COALESCE($1, display_name),
        default_market    = COALESCE($2, default_market),
        default_timeframe = COALESCE($3, default_timeframe),
        timezone          = COALESCE($4, timezone)
       WHERE id = $5
       RETURNING *`,
      [displayName ?? null, defaultMarket ?? null, defaultTimeframe ?? null, timezone ?? null, req.user.id]
    );
    const user = result.rows[0];
    res.json(formatProfile(user));
  } catch (err) {
    next(err);
  }
});

export default router;
