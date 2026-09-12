import jwt from 'jsonwebtoken';
import pool from '../db/client.js';
import { clearRefreshCookie } from '../utils/authCookies.js';

/**
 * Express middleware — verifies the Bearer access token.
 * On success, attaches req.user = { id, email }.
 */
export function createRequireAuth(queryable = pool) {
  return async function requireAuth(req, res, next) {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        error: { code: 'UNAUTHORIZED', message: 'Missing or invalid authorization header.' },
      });
    }

    const token = authHeader.slice(7);
    let payload;
    try {
      payload = jwt.verify(token, process.env.JWT_SECRET, { algorithms: ['HS256'] });
    } catch (err) {
      if (err.name === 'TokenExpiredError') {
        return res.status(401).json({
          error: { code: 'TOKEN_EXPIRED', message: 'Access token has expired.' },
        });
      }
      clearRefreshCookie(res);
      return res.status(401).json({
        error: { code: 'INVALID_TOKEN', message: 'Invalid access token.' },
      });
    }
    if (typeof payload.sub !== 'string' || !/^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(payload.sub)) {
      clearRefreshCookie(res);
      return res.status(401).json({ error: { code: 'SESSION_INVALID', message: 'Sign in again.' } });
    }
    try {
      const { rows } = await queryable.query('SELECT id, email FROM users WHERE id = $1', [payload.sub]);
      if (!rows.length) {
        clearRefreshCookie(res);
        return res.status(401).json({ error: { code: 'SESSION_INVALID', message: 'Sign in again.' } });
      }
      req.user = { id: rows[0].id, email: rows[0].email };
      next();
    } catch (error) { next(error); } // DB/network failure is not invalid authentication.
  };
}
export const requireAuth = createRequireAuth();
