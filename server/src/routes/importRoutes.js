import { Router } from 'express';
import multer from 'multer';
import { createHash, randomUUID } from 'node:crypto';
import { z } from 'zod';
import { requireAuth } from '../middleware/auth.js';
import { parseImport } from '../services/importService.js';
import { executeImportRun, findSuccessfulDuplicate, getImportRun, listImportRuns } from '../services/importHistoryService.js';
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

function storeSession(userId, sessionId, session) {
  parseSessions.set(`${userId}:${sessionId}`, {
    session,
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
  return entry.session;
}

function deleteSession(userId, sessionId) {
  parseSessions.delete(`${userId}:${sessionId}`);
}

// Periodically clean up expired sessions
const cleanupTimer = setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of parseSessions) {
    if (now > entry.expiresAt) parseSessions.delete(key);
  }
}, 60_000);
cleanupTimer.unref?.();

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

    const originalFilename = req.file.originalname.trim();
    if (!originalFilename || originalFilename.length > 255) {
      throw createError('IMPORT_INVALID_FILE', 'The uploaded filename must contain 1 to 255 characters.', 400);
    }

    const { preview, stats, rows, sourceRows } = await parseImport(broker, req.file.buffer);
    const fileSha256 = createHash('sha256').update(req.file.buffer).digest('hex');
    const duplicateRun = await findSuccessfulDuplicate(req.user.id, fileSha256);

    // Store full row set for the commit step
    const sessionId = randomUUID();
    storeSession(req.user.id, sessionId, {
      rows, sourceRows, fileSha256, originalFilename, fileSizeBytes: req.file.size,
      sourceType: broker, mapping: { importer: broker },
    });

    res.json({ sessionId, preview, stats, file: { originalFilename, fileSizeBytes: req.file.size }, duplicateRun });
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

    const session = getSession(req.user.id, sessionId);
    if (!session) {
      throw createError('SESSION_EXPIRED', 'Import session not found or expired. Please re-upload the file.', 410);
    }

    const result = await executeImportRun(req.user.id, session, accountId);
    deleteSession(req.user.id, sessionId);

    res.json(result);
  } catch (err) {
    next(err);
  }
});

const runStatuses = ['processing', 'completed', 'completed_with_errors', 'failed'];
const listSchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(20),
  offset: z.coerce.number().int().min(0).default(0),
  status: z.enum(runStatuses).optional(),
  accountId: z.string().uuid().optional(),
});

router.get('/runs', requireAuth, async (req, res, next) => {
  try {
    const parsed = listSchema.safeParse(req.query);
    if (!parsed.success) throw createError('VALIDATION_ERROR', 'Invalid Import History filters.', 400, parsed.error.flatten().fieldErrors);
    res.json(await listImportRuns(req.user.id, parsed.data));
  } catch (error) { next(error); }
});

router.get('/runs/:runId', requireAuth, async (req, res, next) => {
  try {
    const parsed = z.string().uuid().safeParse(req.params.runId);
    if (!parsed.success) throw createError('VALIDATION_ERROR', 'Invalid Import Run ID.', 400);
    const options = z.object({
      rowLimit: z.coerce.number().int().min(1).max(500).default(100),
      rowOffset: z.coerce.number().int().min(0).default(0),
      rowStatus: z.enum(['imported', 'skipped_duplicate', 'failed_validation', 'failed_insert', 'failed']).optional(),
    }).safeParse(req.query);
    if (!options.success) throw createError('VALIDATION_ERROR', 'Invalid Import row filters.', 400, options.error.flatten().fieldErrors);
    res.json(await getImportRun(req.user.id, parsed.data, options.data));
  } catch (error) { next(error); }
});

export default router;
