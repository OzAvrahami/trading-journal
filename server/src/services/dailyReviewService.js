import pool from '../db/client.js';
import { createError } from '../middleware/errorHandler.js';
import { mapPostgresDate } from '../utils/dateTime.js';

const REVIEW_SELECT = `
  SELECT je.id, je.entry_type, je.entry_date, je.title, je.content,
         je.is_complete, je.created_at, je.updated_at,
         drd.went_well, drd.improve, drd.next_session_plan,
         drd.emotions, drd.mistakes
  FROM journal_entries je
  LEFT JOIN daily_review_details drd
    ON drd.journal_entry_id = je.id AND drd.user_id = je.user_id
  WHERE je.user_id = $1
    AND je.entry_type = 'daily_review'
    AND je.entry_date = $2
  ORDER BY je.created_at ASC, je.id ASC`;

export function mapDailyReview(row) {
  if (!row) return null;
  return {
    id: row.id,
    entryType: row.entry_type,
    entryDate: mapPostgresDate(row.entry_date),
    title: row.title,
    content: row.content,
    isComplete: row.is_complete,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    wentWell: row.went_well ?? null,
    improve: row.improve ?? null,
    nextSessionPlan: row.next_session_plan ?? null,
    emotions: row.emotions ?? [],
    mistakes: row.mistakes ?? [],
  };
}

function assertCanonical(rows) {
  if (rows.length > 1) {
    throw createError(
      'DAILY_REVIEW_DUPLICATE_ENTRIES',
      'More than one Daily Review Journal entry exists for this date. Resolve the duplicate entries in Journal before continuing.',
      409,
    );
  }
  return rows[0] ?? null;
}

export async function getDailyReview(userId, date, timezone, queryable = pool) {
  const result = await queryable.query(REVIEW_SELECT, [userId, date]);
  return { date, timezone, review: mapDailyReview(assertCanonical(result.rows)) };
}

async function withTransaction(work) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const value = await work(client);
    await client.query('COMMIT');
    return value;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

export async function putDailyReview(userId, date, timezone, data) {
  return withTransaction(async (client) => {
    const existingResult = await client.query(`${REVIEW_SELECT} FOR UPDATE OF je`, [userId, date]);
    const existing = assertCanonical(existingResult.rows);
    let entryId;

    if (existing) {
      entryId = existing.id;
      await client.query(
        `UPDATE journal_entries
         SET content = $3, is_complete = $4
         WHERE id = $1 AND user_id = $2`,
        [entryId, userId, data.content, data.isComplete],
      );
    } else {
      const inserted = await client.query(
        `INSERT INTO journal_entries
           (user_id, entry_type, entry_date, title, content, tags, is_complete)
         VALUES ($1, 'daily_review', $2, $3, $4, ARRAY[]::TEXT[], $5)
         RETURNING id`,
        [userId, date, `Daily Review — ${date}`, data.content, data.isComplete],
      );
      entryId = inserted.rows[0].id;
    }

    await client.query(
      `INSERT INTO daily_review_details
         (journal_entry_id, user_id, review_date, went_well, improve,
          next_session_plan, emotions, mistakes)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       ON CONFLICT (journal_entry_id) DO UPDATE SET
         went_well = EXCLUDED.went_well,
         improve = EXCLUDED.improve,
         next_session_plan = EXCLUDED.next_session_plan,
         emotions = EXCLUDED.emotions,
         mistakes = EXCLUDED.mistakes`,
      [entryId, userId, date, data.wentWell, data.improve, data.nextSessionPlan, data.emotions, data.mistakes],
    );

    const saved = await client.query(REVIEW_SELECT, [userId, date]);
    return { date, timezone, review: mapDailyReview(assertCanonical(saved.rows)) };
  });
}
