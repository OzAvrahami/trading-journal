import { Router } from 'express';
import multer from 'multer';
import { requireAuth } from '../middleware/auth.js';
import { parseImport, commitImport } from '../services/importService.js';
import { validateAccountOwnership } from '../services/accountService.js';
import { IMPORTERS } from '../importers/index.js';
import { createError } from '../middleware/errorHandler.js';

const router = Router();

// In-memory storage — no files written to disk
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 }, // 5 MB max
  fileFilter(_req, file, cb) {
    if (file.mimetype === 'text/csv' || file.originalname.endsWith('.csv')) {
      cb(null, true);
    } else {
      cb(createError('INVALID_FILE', 'Only CSV files are accepted.', 400));
    }
  },
});

// In-process session store: userId -> parsed rows (keyed by a sessionId)
// Sufficient for a single-server setup; swap for Redis in a multi-instance deploy.
const parseSessions = new Map();
const SESSION_TTL_MS = 10 * 60 * 1000; // 10 minutes

function storeSession(userId, sessionId, rows) {
  parseSessions.set(`${userId}:${sessionId}`, {
    rows,
    expiresAt: Date.now() + SESSION_TTL_MS,
  });
}

function getSession(userId, sessionId) {
  const entry = parseSessions.get(`${userId}:${sessionId}`);
  if (!entry) return null;
  if (Date.now() > entry.expiresAt) {
    parseSessions.delete(`${userId}:${sessionId}`);
    return null;
  }
  return entry.rows;
}

function deleteSession(userId, sessionId) {
  parseSessions.delete(`${userId}:${sessionId}`);
}

// Periodically clean up expired sessions
setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of parseSessions) {
    if (now > entry.expiresAt) parseSessions.delete(key);
  }
}, 60_000);

/**
 * POST /api/imports/parse
 * Body: multipart/form-data  { broker: string, file: CSV }
 * Response: { sessionId, preview, stats }
 */
router.post('/parse', requireAuth, upload.single('file'), async (req, res, next) => {
  try {
    const { broker } = req.body;

    if (!broker) {
      throw createError('VALIDATION_ERROR', '"broker" field is required.', 400);
    }
    if (!IMPORTERS[broker]) {
      const supported = Object.keys(IMPORTERS).join(', ');
      throw createError('VALIDATION_ERROR', `Unknown broker "${broker}". Supported: ${supported}`, 400);
    }
    if (!req.file) {
      throw createError('VALIDATION_ERROR', 'No file uploaded.', 400);
    }

    const { preview, stats, rows } = await parseImport(broker, req.file.buffer);

    // Store full row set for the commit step
    const sessionId = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    storeSession(req.user.id, sessionId, rows);

    res.json({ sessionId, preview, stats });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/imports/commit
 * Body: JSON { sessionId: string, accountId: string }
 * Response: { inserted, dbDuplicates }
 */
router.post('/commit', requireAuth, async (req, res, next) => {
  try {
    const { sessionId, accountId } = req.body;

    if (!sessionId) {
      throw createError('VALIDATION_ERROR', '"sessionId" is required.', 400);
    }
    if (!accountId) {
      throw createError('VALIDATION_ERROR', '"accountId" is required.', 400);
    }

    const rows = getSession(req.user.id, sessionId);
    if (!rows) {
      throw createError('SESSION_EXPIRED', 'Import session not found or expired. Please re-upload the file.', 410);
    }

    // Verify the account belongs to this user before writing any trades
    await validateAccountOwnership(req.user.id, accountId);

    const result = await commitImport(req.user.id, rows, accountId);
    deleteSession(req.user.id, sessionId);

    res.json(result);
  } catch (err) {
    next(err);
  }
});

export default router;
