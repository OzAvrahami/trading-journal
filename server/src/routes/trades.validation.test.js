import assert from 'node:assert/strict';
import { test } from 'node:test';
import { validateTradeId } from './trades.js';

test('Trade routes reject malformed IDs before querying PostgreSQL', () => {
  let statusCode;
  let body;
  let nextCalled = false;
  const request = { params: { id: 'not-a-uuid' } };
  const response = {
    status(value) { statusCode = value; return this; },
    json(value) { body = value; return this; },
  };

  validateTradeId(request, response, () => { nextCalled = true; });

  assert.equal(nextCalled, false);
  assert.equal(statusCode, 400);
  assert.equal(body.error.code, 'VALIDATION_ERROR');
  assert.deepEqual(body.error.details.id, ['Expected a UUID.']);
});

test('Trade routes pass a canonical UUID to the owned service lookup', () => {
  let nextCalled = false;
  const request = { params: { id: '550e8400-e29b-41d4-a716-446655440000' } };
  validateTradeId(request, {}, () => { nextCalled = true; });
  assert.equal(nextCalled, true);
});
