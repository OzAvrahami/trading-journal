import assert from 'node:assert/strict';
import { test } from 'node:test';
import { validateEntryId } from './journal.js';

test('Journal routes reject malformed IDs before owned database lookups', () => {
  let statusCode;
  let body;
  let nextCalled = false;
  const response = {
    status(value) { statusCode = value; return this; },
    json(value) { body = value; return this; },
  };
  validateEntryId({ params: { id: 'not-a-uuid' } }, response, () => { nextCalled = true; });
  assert.equal(nextCalled, false);
  assert.equal(statusCode, 400);
  assert.equal(body.error.code, 'VALIDATION_ERROR');
});
