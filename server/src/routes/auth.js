import { Router } from 'express';
import { z } from 'zod';
import { validateBody } from '../middleware/validate.js';
import { requireAuth } from '../middleware/auth.js';
import * as authService from '../services/authService.js';
import { refreshCookieOptions, clearRefreshCookie } from '../utils/authCookies.js';

const router = Router();

const signupSchema = z.object({
  email: z.string().email('Invalid email'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
  displayName: z.string().min(1).max(100).optional(),
});

const loginSchema = z.object({
  email: z.string().email('Invalid email'),
  password: z.string().min(1, 'Password required'),
});

function setRefreshCookie(res, token) {
  res.cookie('refreshToken', token, {
    ...refreshCookieOptions(),
    maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days in ms
  });
}

// POST /api/auth/signup
router.post('/signup', validateBody(signupSchema), async (req, res, next) => {
  try {
    const result = await authService.signup(req.body);
    setRefreshCookie(res, result.refreshToken);
    res.status(201).json({ user: result.user, accessToken: result.accessToken });
  } catch (err) {
    next(err);
  }
});

// POST /api/auth/login
router.post('/login', validateBody(loginSchema), async (req, res, next) => {
  try {
    const result = await authService.login(req.body);
    setRefreshCookie(res, result.refreshToken);
    res.json({ user: result.user, accessToken: result.accessToken });
  } catch (err) {
    next(err);
  }
});

// POST /api/auth/refresh  — uses httpOnly cookie, no Bearer token needed
router.post('/refresh', async (req, res, next) => {
  try {
    const token = req.cookies?.refreshToken;
    if (!token) {
      clearRefreshCookie(res);
      return res.status(401).json({ error: { code: 'NO_REFRESH_TOKEN', message: 'No refresh token provided.' } });
    }
    const result = await authService.refresh(token);
    setRefreshCookie(res, result.refreshToken);
    res.json({ accessToken: result.accessToken });
  } catch (err) {
    if (err.code === 'INVALID_REFRESH_TOKEN' && err.statusCode === 401) clearRefreshCookie(res);
    next(err);
  }
});

// POST /api/auth/logout
router.post('/logout', requireAuth, async (req, res, next) => {
  try {
    const token = req.cookies?.refreshToken;
    if (token) await authService.logout(token);
    clearRefreshCookie(res);
    res.json({ message: 'Logged out successfully.' });
  } catch (err) {
    next(err);
  }
});

export default router;
