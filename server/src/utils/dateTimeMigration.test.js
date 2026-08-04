import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { describe, test } from 'node:test';

const migration = readFileSync(new URL('../db/migrations/009_user_timezone.sql', import.meta.url), 'utf8');
const journalService = readFileSync(new URL('../services/journalService.js', import.meta.url), 'utf8');
const rulesService = readFileSync(new URL('../services/rulesService.js', import.meta.url), 'utf8');

describe('user timezone migration and DATE-column contract', () => {
  test('adds only the user timezone with the required default and named constraint', () => {
    assert.match(migration, /BEGIN;/i);
    assert.match(migration, /ALTER TABLE users\s+ADD COLUMN IF NOT EXISTS timezone VARCHAR\(64\) NOT NULL DEFAULT 'Asia\/Jerusalem'/i);
    assert.match(migration, /users_timezone_not_blank/i);
    assert.match(migration, /CHECK \(btrim\(timezone\) <> ''\)/i);
    assert.match(migration, /COMMIT;\s*$/i);
    assert.doesNotMatch(migration, /ALTER TABLE (?!users)/i);
  });

  test('contains no timestamp rewrite, data update, deletion, or destructive statement', () => {
    assert.doesNotMatch(migration, /\b(?:UPDATE|DELETE|TRUNCATE|DROP TABLE|INSERT INTO)\b/i);
    assert.doesNotMatch(migration, /entry_datetime|exit_datetime|TIMESTAMPTZ/i);
  });

  test('Journal and Rules retain direct inclusive DATE comparisons', () => {
    assert.match(journalService, /je\.entry_date >=/);
    assert.match(journalService, /je\.entry_date <=/);
    assert.doesNotMatch(journalService, /entry_date AT TIME ZONE/);
    assert.match(rulesService, /rc\.check_date >=/);
    assert.match(rulesService, /rc\.check_date <=/);
    assert.doesNotMatch(rulesService, /check_date AT TIME ZONE/);
  });
});
